/**
 * POST /api/chat — streaming chat endpoint.
 *
 * Accepts: { history: ChatTurn[] } where the last turn is the new user message.
 * Returns: Server-Sent Events stream of:
 *   - { type: 'text', delta: string }       — assistant text tokens
 *   - { type: 'tool', name: string, status: 'start' | 'end' } — tool calls
 *   - { type: 'done', result?, cost? }      — stream terminator
 *   - { type: 'error', message: string }    — any failure
 */

import { NextRequest } from 'next/server';
import { runAgentQuery, extractTextDelta, type ChatTurn } from '@/agent/server';

// Use Node.js runtime — the SDK needs native modules
export const runtime = 'nodejs';
// No static caching
export const dynamic = 'force-dynamic';
// Stream can run longer than default
export const maxDuration = 300;

interface ChatRequestBody {
  history: ChatTurn[];
}

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

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
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(sseEvent(obj)));

      try {
        // Track per-assistant-message text emitted so that when the model
        // emits a second assistant turn (after a tool call), we don't drop
        // its text by comparing against the previous turn's accumulated length.
        let lastAssistantId: string | null = null;
        let lastTextEmitted = '';
        for await (const msg of runAgentQuery(body.history)) {
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
