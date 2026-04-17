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
import { buildSystemPrompt } from './system-prompt';

const MODEL = process.env.BETTY_AI_MODEL ?? 'claude-sonnet-4-5';

const bettyTools = createSdkMcpServer({
  name: 'betty-ai-tools',
  version: '0.1.0',
  tools: [wikiSearchTool, wikiReadTool, gpuCalculateTool],
});

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Run one turn of the agent with the full conversation history folded into
 * the prompt. Yields SDKMessage events so the caller can stream to the client.
 *
 * Phase 1: we reassemble the transcript on each turn rather than using the
 * SDK's session resume, because we're stateless-per-request and the transcript
 * is the UI's source of truth. Phase 4 will switch to persistent sessions.
 */
export async function* runAgentQuery(history: ChatTurn[]): AsyncGenerator<SDKMessage> {
  const systemPrompt = await buildSystemPrompt();
  const prompt = formatHistoryAsPrompt(history);

  for await (const message of query({
    prompt,
    options: {
      model: MODEL,
      systemPrompt,
      mcpServers: {
        'betty-ai-tools': bettyTools,
      },
      // Phase 1: only our SDK tools are available. No built-in Bash/Write/etc.
      allowedTools: [
        'mcp__betty-ai-tools__wiki_search',
        'mcp__betty-ai-tools__wiki_read',
        'mcp__betty-ai-tools__gpu_calculate',
      ],
      // Unused paths the SDK might otherwise try to auto-load
      settingSources: [],
      maxTurns: 8,
    },
  })) {
    yield message;
  }
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
