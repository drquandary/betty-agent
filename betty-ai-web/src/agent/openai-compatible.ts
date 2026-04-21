import { buildToollessSystemPrompt, buildSystemPrompt } from './system-prompt';
import type { ChatPreferences } from './providers';
import type { ChatTurn } from './server';
import { OPENAI_TOOLS, dispatchOpenAITool } from './openai-tools';

export type ProviderStreamEvent =
  | { type: 'system'; tools: string[]; model: string }
  | { type: 'tool'; name: string; status: 'start' | 'end' }
  | { type: 'text'; delta: string }
  | { type: 'done'; result?: string }
  | { type: 'error'; message: string };

interface OpenAIToolCall {
  id?: string;
  index?: number;
  type?: 'function';
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface OpenAIChatChunk {
  choices?: Array<{
    delta?: {
      content?: string;
      tool_calls?: OpenAIToolCall[];
    };
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason?: string | null;
  }>;
}

type ChatMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | {
      role: 'assistant';
      content: string | null;
      tool_calls: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    }
  | { role: 'tool'; tool_call_id: string; content: string };

const MAX_TOOL_ITERATIONS = 6;

function resolveApiKey(preferences: ChatPreferences): string | undefined {
  if (preferences.provider === 'openai') return process.env.OPENAI_API_KEY;
  if (preferences.provider === 'litellm-parcc') return process.env.LITELLM_API_KEY;
  return process.env.LOCAL_LLM_API_KEY || process.env.OPENAI_API_KEY;
}

export async function* runOpenAICompatibleQuery(
  history: ChatTurn[],
  preferences: ChatPreferences,
): AsyncGenerator<ProviderStreamEvent> {
  const baseUrl = preferences.baseUrl?.replace(/\/+$/, '');
  if (!baseUrl) throw new Error('OpenAI-compatible provider is missing a base URL.');

  const apiKey = resolveApiKey(preferences);
  if (preferences.provider === 'openai' && !apiKey?.trim()) {
    throw new Error('OPENAI_API_KEY is required for OpenAI API-key mode.');
  }
  if (preferences.provider === 'litellm-parcc' && !apiKey?.trim()) {
    throw new Error('LITELLM_API_KEY is required for PARCC LiteLLM mode.');
  }

  // Only LiteLLM gets the tool-enabled path. OpenAI and local-qwen stay
  // text-only for now since those deployments may not all support tools.
  const toolsEnabled = preferences.provider === 'litellm-parcc';
  const systemPrompt = toolsEnabled ? await buildSystemPrompt() : await buildToollessSystemPrompt();

  yield {
    type: 'system',
    tools: toolsEnabled ? OPENAI_TOOLS.map((t) => t.function.name) : [],
    model: preferences.model,
  };

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((turn) => ({ role: turn.role, content: turn.content })) as ChatMessage[],
  ];

  // Tool loop — each iteration is a full request. We stream the final
  // (text-only) iteration and block on intermediate (tool-call) ones.
  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    // If the model is going to emit tool calls, we want the response whole so
    // we can dispatch cleanly. For the last iteration's text we stream.
    // Strategy: first try non-streaming to see if tool_calls appear; if not,
    // we have a complete text body already — just emit it as one delta.
    const body = {
      model: preferences.model,
      messages,
      temperature: 0.2,
      ...(toolsEnabled
        ? { tools: OPENAI_TOOLS, tool_choice: 'auto' as const }
        : { stream: true }),
    };

    // For the tool-enabled path we call non-streaming (simpler and LiteLLM's
    // tool_calls streaming support varies across upstream backends). For the
    // tool-less path we keep the original streaming flow below.
    if (!toolsEnabled) {
      yield* streamTextOnly(baseUrl, apiKey, body as object, preferences);
      return;
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey?.trim() ? { Authorization: `Bearer ${apiKey.trim()}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(
        `${preferences.label} request failed: ${res.status} ${res.statusText}${errBody ? ` - ${errBody.slice(0, 400)}` : ''}`,
      );
    }
    const json = (await res.json()) as OpenAIChatChunk;
    const choice = json.choices?.[0];
    const msg = choice?.message;
    const toolCalls = (msg?.tool_calls ?? []).filter((tc) => tc.function?.name);

    if (toolCalls.length === 0) {
      // No more tool calls — emit the final text and stop.
      const text = msg?.content ?? '';
      if (text) yield { type: 'text', delta: text };
      yield { type: 'done', result: 'success' };
      return;
    }

    // Record the assistant message (with tool_calls) so the next iteration
    // sees it as prior context.
    messages.push({
      role: 'assistant',
      content: msg?.content ?? null,
      tool_calls: toolCalls.map((tc, i) => ({
        id: tc.id ?? `call_${iter}_${i}`,
        type: 'function',
        function: {
          name: tc.function!.name!,
          arguments: tc.function?.arguments ?? '{}',
        },
      })),
    });

    // Dispatch each tool sequentially, append tool result messages.
    for (let i = 0; i < toolCalls.length; i++) {
      const tc = toolCalls[i];
      const name = tc.function!.name!;
      const argStr = tc.function?.arguments ?? '{}';
      yield { type: 'tool', name, status: 'start' };
      const result = await dispatchOpenAITool(name, argStr);
      yield { type: 'tool', name, status: 'end' };
      messages.push({
        role: 'tool',
        tool_call_id: tc.id ?? `call_${iter}_${i}`,
        content: result,
      });
    }
  }

  yield {
    type: 'error',
    message: `Tool iteration budget exhausted (${MAX_TOOL_ITERATIONS}). The model kept asking for tools without giving a final answer.`,
  };
}

async function* streamTextOnly(
  baseUrl: string,
  apiKey: string | undefined,
  body: object,
  preferences: ChatPreferences,
): AsyncGenerator<ProviderStreamEvent> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey?.trim() ? { Authorization: `Bearer ${apiKey.trim()}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const errBody = await res.text().catch(() => '');
    throw new Error(
      `${preferences.label} request failed: ${res.status} ${res.statusText}${errBody ? ` - ${errBody.slice(0, 400)}` : ''}`,
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 2);
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const chunk = JSON.parse(payload) as OpenAIChatChunk;
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) yield { type: 'text', delta };
        } catch {
          /* malformed frame — ignore */
        }
      }
    }
  }

  yield { type: 'done', result: 'success' };
}
