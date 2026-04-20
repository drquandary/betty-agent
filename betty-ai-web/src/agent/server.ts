/**
 * Agent server module — single source of truth for how the Betty AI agent is
 * configured on the server side. The API route imports runAgentQuery() and
 * forwards the streamed messages over SSE.
 *
 * Phase 1 scope: chat only with read-only wiki tools + gpu_calculate.
 * No Bash, no Write, no shell access. Phase 2+ will add pty tools with
 * an explicit canUseTool confirmation loop.
 */

import { createSdkMcpServer, query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { wikiSearchTool } from './tools/wiki-search';
import { wikiReadTool } from './tools/wiki-read';
import { gpuCalculateTool } from './tools/gpu-calculate';
import { wikiWriteTool } from './tools/wiki-write';
import { clusterRunTool } from './tools/cluster-run';
import { clusterSubmitTool } from './tools/cluster-submit';
import { clusterStatusTool } from './tools/cluster-status';
import { buildSystemPrompt } from './system-prompt';
import { prepareClaudeEnvironment, type ChatPreferences } from './providers';

// Re-export so Track C (and other server-side callers) can do:
//   import { writeWikiPage } from '@/agent/server';
export { writeWikiPage } from './tools/wiki-write';

const MODEL = process.env.BETTY_AI_MODEL ?? 'claude-sonnet-4-5';

const bettyTools = createSdkMcpServer({
  name: 'betty-ai-tools',
  version: '0.1.0',
  tools: [
    wikiSearchTool,
    wikiReadTool,
    gpuCalculateTool,
    wikiWriteTool,
    clusterRunTool,
    clusterSubmitTool,
    clusterStatusTool,
  ],
});

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Permission tiers for tool calls (decision D4 in PLAN.md).
 *
 *   Tier 0 — auto-approve silently.
 *     - wiki_search, wiki_read, gpu_calculate
 *     - wiki_write mode="append" targeting wiki/log.md
 *
 *   Tier 1 — prompt once per session. The agent session runs per-request today,
 *            so "once per session" is effectively once per `runAgentQuery` call.
 *     - wiki_write mode="update"
 *     - wiki_write mode="create" under experiments/
 *     - (future: whitelisted cluster_run commands)
 *
 *   Tier 2 — always prompt.
 *     - wiki_write mode="create" outside experiments/
 *     - (future: cluster_submit)
 */
export type PermissionTier = 0 | 1 | 2;

export interface PermissionRequest {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  tier: PermissionTier;
  summary: string;
}

export type PermissionDecision =
  | { behavior: 'allow'; updatedInput?: Record<string, unknown> }
  | { behavior: 'deny'; message: string };

/** Pluggable UI prompter — the HTTP route supplies one per request. */
export type PermissionPrompter = (
  req: PermissionRequest,
) => Promise<PermissionDecision>;

const WIKI_WRITE_TOOL = 'mcp__betty-ai-tools__wiki_write';
const CLUSTER_RUN_TOOL = 'mcp__betty-ai-tools__cluster_run';
const CLUSTER_SUBMIT_TOOL = 'mcp__betty-ai-tools__cluster_submit';
const CLUSTER_STATUS_TOOL = 'mcp__betty-ai-tools__cluster_status';

export function classifyPermissionTier(
  toolName: string,
  input: Record<string, unknown>,
): PermissionTier {
  if (toolName === WIKI_WRITE_TOOL) {
    const mode = typeof input.mode === 'string' ? input.mode : '';
    const page = typeof input.page === 'string' ? input.page : '';
    const normPage = page.endsWith('.md') ? page : `${page}.md`;
    if (mode === 'append' && normPage === 'log.md') return 0;
    if (mode === 'update') return 1;
    if (mode === 'create') {
      if (normPage.startsWith('experiments/')) return 1;
      return 2;
    }
    return 2;
  }
  // Cluster tools
  if (toolName === CLUSTER_RUN_TOOL) return 1;
  if (toolName === CLUSTER_STATUS_TOOL) return 1;
  if (toolName === CLUSTER_SUBMIT_TOOL) return 2;
  // Unknown tools default to always-prompt.
  return 2;
}

export function summarizePermissionRequest(
  toolName: string,
  input: Record<string, unknown>,
): string {
  if (toolName === WIKI_WRITE_TOOL) {
    const mode = String(input.mode ?? '?');
    const page = String(input.page ?? '?');
    return `wiki_write ${mode} → wiki/${page}`;
  }
  if (toolName === CLUSTER_RUN_TOOL) {
    const cmd = String(input.command ?? '?');
    return `cluster_run: ${cmd}`;
  }
  if (toolName === CLUSTER_SUBMIT_TOOL) {
    const slug = String(input.experiment_slug ?? '?');
    const args = Array.isArray(input.sbatch_args) ? (input.sbatch_args as string[]).join(' ') : '';
    return `cluster_submit: slug="${slug}"${args ? ` args="${args}"` : ''}`;
  }
  if (toolName === CLUSTER_STATUS_TOOL) {
    const jobId = String(input.job_id ?? '?');
    return `cluster_status: job ${jobId}`;
  }
  return toolName;
}

/**
 * Run one turn of the agent with the full conversation history folded into
 * the prompt. Yields SDKMessage events so the caller can stream to the client.
 *
 * Phase 1: we reassemble the transcript on each turn rather than using the
 * SDK's session resume, because we're stateless-per-request and the transcript
 * is the UI's source of truth. Phase 4 will switch to persistent sessions.
 */
export async function* runAgentQuery(
  history: ChatTurn[],
  preferences?: ChatPreferences,
  prompter?: PermissionPrompter,
): AsyncGenerator<SDKMessage> {
  prepareClaudeEnvironment();

  const systemPrompt = await buildSystemPrompt();
  const prompt = formatHistoryAsPrompt(history);

  // Per-session memo of tier-1 approvals (mirrors D4: "prompt once per session").
  const tier1Approved = new Set<string>();

  for await (const message of query({
    prompt,
    options: {
      model: preferences?.model || MODEL,
      systemPrompt,
      mcpServers: {
        'betty-ai-tools': bettyTools,
      },
      // Phase 2: wiki_write is now available. Confirmation is handled via canUseTool.
      allowedTools: [
        'mcp__betty-ai-tools__wiki_search',
        'mcp__betty-ai-tools__wiki_read',
        'mcp__betty-ai-tools__gpu_calculate',
        'mcp__betty-ai-tools__wiki_write',
        'mcp__betty-ai-tools__cluster_run',
        'mcp__betty-ai-tools__cluster_submit',
        'mcp__betty-ai-tools__cluster_status',
      ],
      canUseTool: async (toolName, input) => {
        const tier = classifyPermissionTier(toolName, input);
        if (tier === 0) {
          return { behavior: 'allow', updatedInput: input };
        }
        // Tier 1: once-per-session
        if (tier === 1) {
          const key =
            toolName === WIKI_WRITE_TOOL
              ? `${toolName}:${(input.page as string) ?? ''}:${(input.mode as string) ?? ''}`
              : toolName;
          if (tier1Approved.has(key)) {
            return { behavior: 'allow', updatedInput: input };
          }
          if (!prompter) {
            // No UI attached — fail closed.
            return {
              behavior: 'deny',
              message: 'No permission prompter attached; tier-1 tool denied.',
            };
          }
          const decision = await prompter({
            id: cryptoRandomId(),
            toolName,
            input,
            tier,
            summary: summarizePermissionRequest(toolName, input),
          });
          if (decision.behavior === 'allow') {
            tier1Approved.add(key);
            return { behavior: 'allow', updatedInput: decision.updatedInput ?? input };
          }
          return { behavior: 'deny', message: decision.message };
        }
        // Tier 2: always prompt
        if (!prompter) {
          return {
            behavior: 'deny',
            message: 'No permission prompter attached; tier-2 tool denied.',
          };
        }
        const decision = await prompter({
          id: cryptoRandomId(),
          toolName,
          input,
          tier,
          summary: summarizePermissionRequest(toolName, input),
        });
        if (decision.behavior === 'allow') {
          return { behavior: 'allow', updatedInput: decision.updatedInput ?? input };
        }
        return { behavior: 'deny', message: decision.message };
      },
      // Unused paths the SDK might otherwise try to auto-load
      settingSources: [],
      maxTurns: 8,
    },
  })) {
    yield message;
  }
}

function cryptoRandomId(): string {
  // Prefer crypto.randomUUID() where available; fall back to Math.random.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `perm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Format conversation history as a single prompt string.
 * The SDK's streaming input mode supports multi-turn directly, but for a
 * stateless HTTP endpoint this is simpler and good enough for Phase 1.
 */
function formatHistoryAsPrompt(history: ChatTurn[]): string {
  if (history.length === 0) return '';
  // The last user message is the "current turn". Everything before is context.
  const last = history[history.length - 1];
  if (history.length === 1 && last.role === 'user') return last.content;

  const contextTurns = history.slice(0, -1);
  const contextBlock = contextTurns
    .map((t) => (t.role === 'user' ? `User: ${t.content}` : `Assistant: ${t.content}`))
    .join('\n\n');

  return `Previous conversation so far:\n\n${contextBlock}\n\n---\n\nUser's new message:\n${last.content}`;
}

/** Extract plain-text content from an SDKAssistantMessage for streaming. */
export function extractTextDelta(message: SDKMessage): string {
  if (message.type !== 'assistant') return '';
  const content = (message.message as { content: unknown }).content;
  if (!Array.isArray(content)) return '';
  let text = '';
  for (const block of content) {
    if (block && typeof block === 'object' && 'type' in block && (block as { type: string }).type === 'text') {
      const t = (block as { text?: string }).text;
      if (typeof t === 'string') text += t;
    }
  }
  return text;
}
