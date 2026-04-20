/**
 * POST /api/chat — streaming chat endpoint.
 *
 * Accepts: { history: ChatTurn[] } where the last turn is the new user message.
 * Returns: Server-Sent Events stream of:
 *   - { type: 'text', delta: string }                              — assistant text tokens
 *   - { type: 'tool', name: string, status: 'start' | 'end' }      — tool calls
 *   - { type: 'tool_permission', id, toolName, tier, summary, input } — awaiting user Approve/Deny
 *   - { type: 'done', result?, cost? }                             — stream terminator
 *   - { type: 'error', message: string }                           — any failure
 *
 * Permission handshake:
 *   When the agent requests a tool that requires confirmation (tier 1/2 per D4),
 *   the server emits a `tool_permission` frame and blocks the tool call until
 *   the client POSTs to `/api/chat/permission` with `{ id, decision: 'allow' | 'deny' }`.
 *   The UI renders the frame as an Approve/Deny card (Track B).
 *
 * The existing `text` frames and their shape are unchanged — older clients that
 * only know `text` / `tool` / `done` simply ignore `tool_permission` and will
 * time out on tier-1/2 writes (which is the safe default).
 */

import { NextRequest } from 'next/server';
import { runAgentQuery, extractTextDelta } from '@/agent/server';
import type {
  ChatTurn,
  PermissionRequest,
  PermissionDecision,
  PermissionPrompter,
} from '@/agent/server';
import { runOpenAICompatibleQuery } from '@/agent/openai-compatible';
import { resolveChatPreferences, type ChatPreferencesInput } from '@/lib/chat-preferences';
import {
  registerPendingPermission,
  resolvePendingPermission,
  cancelPendingPermission,
} from '@/lib/permission-store';

// Use Node.js runtime — the SDK needs native modules
export const runtime = 'nodejs';
// No static caching
export const dynamic = 'force-dynamic';
// Stream can run longer than default
export const maxDuration = 300;

interface ChatRequestBody {
  history: ChatTurn[];
  preferences?: ChatPreferencesInput;
}

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/** Default timeout for awaiting a user decision on a tool_permission frame. */
const PERMISSION_TIMEOUT_MS = Number(
  process.env.BETTY_PERMISSION_TIMEOUT_MS ?? 5 * 60 * 1000,
);

export async function POST(req: NextRequest): Promise<Response> {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!Array.isArray(body.history) || body.history.length === 0) {
    return new Response('history must be a non-empty array', { status: 400 });
  }

  const encoder = new TextEncoder();
  // Track pending permission IDs so we can release them if the stream aborts.
  const pendingIds = new Set<string>();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(sseEvent(obj)));
      const preferences = resolveChatPreferences(body.preferences);

      // Build a prompter that streams a tool_permission frame to the client
      // and awaits a POST to /api/chat/permission.
      const prompter: PermissionPrompter = async (pr: PermissionRequest) => {
        const decision = registerPendingPermission(pr.id, PERMISSION_TIMEOUT_MS);
        pendingIds.add(pr.id);
        send({
          type: 'tool_permission',
          id: pr.id,
          toolName: pr.toolName,
          tier: pr.tier,
          summary: pr.summary,
          input: pr.input,
        });
        try {
          const result = await decision;
          pendingIds.delete(pr.id);
          return result;
        } catch (err) {
          pendingIds.delete(pr.id);
          const message = err instanceof Error ? err.message : String(err);
          return { behavior: 'deny', message } as PermissionDecision;
        }
      };

      try {
        if (preferences.provider !== 'claude-code') {
          for await (const event of runOpenAICompatibleQuery(body.history, preferences)) {
            send(event);
          }
          controller.close();
          return;
        }

        // Track per-assistant-message text emitted so that when the model
        // emits a second assistant turn (after a tool call), we don't drop
        // its text by comparing against the previous turn's accumulated length.
        let lastAssistantId: string | null = null;
        let lastTextEmitted = '';
        for await (const msg of runAgentQuery(body.history, preferences, prompter)) {
          switch (msg.type) {
            case 'assistant': {
              // Reset delta tracking when a new assistant message starts
              if (msg.uuid !== lastAssistantId) {
                lastAssistantId = msg.uuid;
                lastTextEmitted = '';
              }
              const full = extractTextDelta(msg);
              if (full.length > lastTextEmitted.length) {
                const delta = full.slice(lastTextEmitted.length);
                lastTextEmitted = full;
                send({ type: 'text', delta });
              }
              break;
            }
            case 'result': {
              send({
                type: 'done',
                result: msg.subtype,
                durationMs: msg.duration_ms,
                costUsd: msg.total_cost_usd,
                turns: msg.num_turns,
              });
              break;
            }
            case 'system': {
              // Surface init info so the client can confirm tools are wired
              if (msg.subtype === 'init') {
                send({ type: 'system', tools: msg.tools, model: msg.model });
              }
              break;
            }
            default:
              // Silently drop other message types for Phase 1 (stream_event, etc.)
              break;
          }
        }
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[api/chat] error:', err);
        send({ type: 'error', message });
        controller.close();
      } finally {
        // Fail-closed: any pending permission request that was never answered
        // is implicitly denied so the SDK promise can resolve.
        for (const id of pendingIds) {
          cancelPendingPermission(id, 'Stream closed before user responded.');
        }
      }
    },
    cancel() {
      for (const id of pendingIds) {
        cancelPendingPermission(id, 'Client cancelled stream.');
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * POST /api/chat — permission handshake companion.
 *
 * The UI Approve/Deny card posts to this route (or `/api/chat/permission`) with
 * `{ id, decision: 'allow'|'deny', message? }`. We just unblock the in-memory
 * pending promise registered by the `prompter`.
 *
 * We expose this on the same route via the `permission=1` query flag so Track B
 * doesn't need to ship a separate file; a dedicated /permission route can be
 * added later if routing hygiene demands it.
 */
export async function PUT(req: NextRequest): Promise<Response> {
  // PUT is used as the permission handshake verb to avoid colliding with POST /api/chat.
  let payload: {
    id?: string;
    decision?: 'allow' | 'deny';
    message?: string;
    updatedInput?: Record<string, unknown>;
  };
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (!payload.id || (payload.decision !== 'allow' && payload.decision !== 'deny')) {
    return new Response('Missing id or decision', { status: 400 });
  }
  const ok = resolvePendingPermission(
    payload.id,
    payload.decision === 'allow'
      ? { behavior: 'allow', updatedInput: payload.updatedInput }
      : { behavior: 'deny', message: payload.message ?? 'User denied' },
  );
  if (!ok) {
    return new Response('No pending permission with that id (already resolved or timed out).', {
      status: 404,
    });
  }
  return new Response('ok', { status: 200 });
}
