import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolPermissionCard, type ToolPermissionRequest } from './ToolPermissionCard';

const baseRequest: ToolPermissionRequest = {
  id: 'req-1',
  toolName: 'cluster_submit',
  tier: 2,
  input: { script_body: '#!/bin/bash\nsrun hostname', experiment_slug: 'demo' },
  summary: 'Submit a 1-node test job to dgx-b200',
};

function mockFetchOk() {
  return vi.fn(async () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

describe('ToolPermissionCard', () => {
  it('renders tool name, summary, and serialized args', () => {
    render(<ToolPermissionCard request={baseRequest} fetchImpl={mockFetchOk()} />);

    expect(screen.getByText('cluster_submit')).toBeInTheDocument();
    expect(screen.getByTestId('tool-permission-summary')).toHaveTextContent(
      'Submit a 1-node test job to dgx-b200',
    );
    const args = screen.getByTestId('tool-permission-args');
    expect(args.textContent).toContain('script_body');
    expect(args.textContent).toContain('experiment_slug');
    expect(args.textContent).toContain('demo');
    expect(screen.getByTestId('tool-permission-approve')).toBeEnabled();
    expect(screen.getByTestId('tool-permission-deny')).toBeEnabled();
  });

  it('Approve PUTs { id, decision: "allow" } to /api/chat', async () => {
    const user = userEvent.setup();
    const fetchImpl = mockFetchOk();
    const onResolved = vi.fn();
    render(
      <ToolPermissionCard
        request={baseRequest}
        fetchImpl={fetchImpl}
        onResolved={onResolved}
      />,
    );

    await user.click(screen.getByTestId('tool-permission-approve'));

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/chat');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({
      id: 'req-1',
      decision: 'allow',
    });
    await waitFor(() =>
      expect(screen.getByTestId('tool-permission-status')).toHaveTextContent(/approved/i),
    );
    expect(onResolved).toHaveBeenCalledWith('allow');
  });

  it('Deny PUTs { id, decision: "deny" }', async () => {
    const user = userEvent.setup();
    const fetchImpl = mockFetchOk();
    const onResolved = vi.fn();
    render(
      <ToolPermissionCard
        request={baseRequest}
        fetchImpl={fetchImpl}
        onResolved={onResolved}
      />,
    );

    await user.click(screen.getByTestId('tool-permission-deny'));

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({
      id: 'req-1',
      decision: 'deny',
    });
    await waitFor(() =>
      expect(screen.getByTestId('tool-permission-status')).toHaveTextContent(/denied/i),
    );
    expect(onResolved).toHaveBeenCalledWith('deny');
  });

  it('fails closed to deny when the PUT aborts (disconnect)', async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn(async () => {
      throw new DOMException('aborted', 'AbortError');
    }) as unknown as typeof fetch;
    const onResolved = vi.fn();

    render(
      <ToolPermissionCard
        request={baseRequest}
        fetchImpl={fetchImpl}
        onResolved={onResolved}
      />,
    );

    await user.click(screen.getByTestId('tool-permission-approve'));

    await waitFor(() => expect(onResolved).toHaveBeenCalledWith('deny'));
    expect(screen.getByTestId('tool-permission-status')).toHaveTextContent(/denied/i);
    expect(screen.getByTestId('tool-permission-error')).toBeInTheDocument();
  });
});
