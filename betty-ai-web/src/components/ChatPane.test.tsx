import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ChatPane } from './ChatPane';

function streamingFetch(): typeof fetch {
  // ReadableStream that emits one SSE "done" event then closes.
  return vi.fn(async () => {
    const body = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        controller.enqueue(enc.encode('data: {"type":"done"}\n\n'));
        controller.close();
      },
    });
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }) as unknown as typeof fetch;
}

const originalFetch = global.fetch;

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('ChatPane initialPrompt', () => {
  it('dispatches the initial prompt exactly once on mount', async () => {
    const fetchMock = streamingFetch();
    global.fetch = fetchMock;
    const onConsumed = vi.fn();
    const { rerender } = render(
      <ChatPane initialPrompt="hello betty" onInitialPromptConsumed={onConsumed} />,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(onConsumed).toHaveBeenCalledOnce();
    // Re-rendering with the same prompt string should NOT re-trigger fetch.
    rerender(
      <ChatPane initialPrompt="hello betty" onInitialPromptConsumed={onConsumed} />,
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does nothing when initialPrompt is null/empty', async () => {
    const fetchMock = streamingFetch();
    global.fetch = fetchMock;
    render(<ChatPane initialPrompt={null} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
