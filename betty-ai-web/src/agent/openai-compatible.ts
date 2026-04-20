import { buildSystemPrompt } from './system-prompt';
import type { ChatPreferences } from './providers';
import type { ChatTurn } from './server';

export type ProviderStreamEvent =
  | { type: 'system'; tools: string[]; model: string }
  | { type: 'text'; delta: string }
  | { type: 'done'; result?: string }
  | { type: 'error'; message: string };

interface OpenAIChatChunk {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
}

export async function* runOpenAICompatibleQuery(
  history: ChatTurn[],
  preferences: ChatPreferences,
): AsyncGenerator<ProviderStreamEvent> {
  const baseUrl = preferences.baseUrl?.replace(/\/+$/, '');
  if (!baseUrl) throw new Error('OpenAI-compatible provider is missing a base URL.');

  const apiKey =
    preferences.provider === 'openai'
      ? process.env.OPENAI_API_KEY
      : process.env.LOCAL_LLM_API_KEY || process.env.OPENAI_API_KEY;

  if (preferences.provider === 'openai' && !apiKey?.trim()) {
    throw new Error('OPENAI_API_KEY is required for OpenAI API-key mode.');
  }

  yield { type: 'system', tools: [], model: preferences.model };

  const systemPrompt = await buildSystemPrompt();
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey?.trim() ? { Authorization: `Bearer ${apiKey.trim()}` } : {}),
    },
    body: JSON.stringify({
      model: preferences.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.map((turn) => ({ role: turn.role, content: turn.content })),
      ],
      stream: true,
      temperature: 0.2,
    }),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `${preferences.label} request failed: ${res.status} ${res.statusText}${body ? ` - ${body.slice(0, 400)}` : ''}`,
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

        const chunk = JSON.parse(payload) as OpenAIChatChunk;
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) yield { type: 'text', delta };
      }
    }
  }

  yield { type: 'done', result: 'success' };
}
