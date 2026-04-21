/**
 * GET /api/litellm/models — list models exposed by the PARCC LiteLLM
 * gateway. Keeps the API key server-side (the key in .env.local never
 * reaches the browser).
 *
 * Cached for 60s so the Options dropdown doesn't hammer the gateway.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface LiteLLMModelsResponse {
  data?: Array<{ id?: string }>;
}

let cache: { models: string[]; expiresAt: number } | null = null;
const TTL_MS = 60_000;

const DEFAULT_BASE = 'https://litellm.parcc.upenn.edu/v1';

export async function GET() {
  const apiKey = process.env.LITELLM_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'LITELLM_API_KEY not set in env', models: [] },
      { status: 200 },
    );
  }
  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json({ ok: true, models: cache.models, cached: true });
  }
  const base = (process.env.LITELLM_BASE_URL ?? DEFAULT_BASE).replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `gateway responded ${res.status}`, models: [] },
        { status: 200 },
      );
    }
    const body = (await res.json()) as LiteLLMModelsResponse;
    const models = (body.data ?? []).map((m) => m.id ?? '').filter(Boolean).sort();
    cache = { models, expiresAt: Date.now() + TTL_MS };
    return NextResponse.json({ ok: true, models });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message, models: [] },
      { status: 200 },
    );
  }
}
