import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Stub heavy children so the test focuses on the shell's routing logic.
// xterm + SSE streaming aren't friendly to jsdom; we don't need them here.
vi.mock('./ChatPane', () => ({
  ChatPane: ({ initialPrompt }: { initialPrompt?: string | null }) => (
    <div data-testid="chat-pane">chat:{initialPrompt ?? ''}</div>
  ),
}));
vi.mock('./JobsPane', () => ({ JobsPane: () => <div data-testid="jobs-pane" /> }));
vi.mock('./TerminalPane', () => ({ TerminalPane: () => <div data-testid="terminal-pane" /> }));
vi.mock('./StatusBar', () => ({ StatusBar: () => <div data-testid="status-bar" /> }));
vi.mock('./HeaderMenu', () => ({
  HeaderMenu: () => <div data-testid="header-menu" />,
  HeaderProviderBadge: () => <div data-testid="header-provider" />,
}));
vi.mock('./ConnectionBadge', () => ({ ConnectionBadge: () => <div data-testid="conn-badge" /> }));
vi.mock('./WikiLintButton', () => ({ WikiLintButton: () => <div data-testid="wiki-lint" /> }));
vi.mock('./NextDevToolsOffset', () => ({ NextDevToolsOffset: () => null }));
vi.mock('./dashboard/ClusterOverviewCard', () => ({
  ClusterOverviewCard: () => <div data-testid="cluster-overview-card" />,
}));
vi.mock('./dashboard/UserStatsCard', () => ({
  UserStatsCard: () => <div data-testid="user-stats-card" />,
}));
vi.mock('./dashboard/DocsLinksCard', () => ({
  DocsLinksCard: () => <div data-testid="docs-links-card" />,
}));
vi.mock('./dashboard/DashboardChatPanel', () => ({
  DashboardChatPanel: ({ onOpenWorkspace }: { onOpenWorkspace?: () => void }) => (
    <div data-testid="dashboard-chat-panel">
      <button type="button" onClick={onOpenWorkspace}>open-ws</button>
    </div>
  ),
}));
vi.mock('./dashboard/CommandsView', () => ({
  CommandsView: () => <div data-testid="commands-view" />,
}));
vi.mock('./monitoring/MonitoringView', () => ({
  MonitoringView: () => <div data-testid="monitoring-view" />,
}));
// SchedulingCard is the integration glue we *do* want to keep alive so we can
// drive its onSubmit handler from AppShell.
import { AppShell } from './AppShell';

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = '';
});

describe('AppShell', () => {
  it('lands on dashboard view by default', () => {
    render(<AppShell deployTarget="local" initialView="dashboard" />);
    expect(screen.getByTestId('dashboard-view')).toBeInTheDocument();
    expect(screen.queryByTestId('workspace-view')).toBeNull();
    expect(screen.getByTestId('cluster-overview-card')).toBeInTheDocument();
    expect(screen.getByTestId('user-stats-card')).toBeInTheDocument();
    expect(screen.getByTestId('docs-links-card')).toBeInTheDocument();
    expect(screen.getByTestId('scheduling-card')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-chat-panel')).toBeInTheDocument();
  });

  it('switches to workspace view when the Workspace tab is clicked', () => {
    render(<AppShell deployTarget="local" initialView="dashboard" />);
    fireEvent.click(screen.getByRole('tab', { name: /Workspace/i }));
    expect(screen.getByTestId('workspace-view')).toBeInTheDocument();
    expect(screen.getByTestId('chat-pane')).toBeInTheDocument();
    expect(screen.getByTestId('jobs-pane')).toBeInTheDocument();
    expect(screen.getByTestId('terminal-pane')).toBeInTheDocument();
    expect(window.location.hash).toBe('#workspace');
  });

  it('hides the terminal under OOD', () => {
    render(<AppShell deployTarget="ood" initialView="workspace" />);
    expect(screen.queryByTestId('terminal-pane')).toBeNull();
    expect(screen.getByTestId('jobs-pane')).toBeInTheDocument();
  });

  it('routes a scheduling submission into the workspace chat with prefilled prompt', () => {
    render(<AppShell deployTarget="local" initialView="dashboard" />);
    fireEvent.click(screen.getByRole('button', { name: /Ask Betty AI/i }));
    // Submitting the scheduling form switches to workspace and forwards prompt.
    const chat = screen.getByTestId('chat-pane');
    expect(chat.textContent).toMatch(/chat:Recommend an sbatch shape/);
  });

  it('responds to the Dashboard chat panel "open workspace" affordance', () => {
    render(<AppShell deployTarget="local" initialView="dashboard" />);
    fireEvent.click(screen.getByRole('button', { name: /open-ws/i }));
    expect(screen.getByTestId('workspace-view')).toBeInTheDocument();
  });

  it('switches to commands view when the Commands tab is clicked', () => {
    render(<AppShell deployTarget="local" initialView="dashboard" />);
    fireEvent.click(screen.getByRole('tab', { name: /Commands/i }));
    expect(screen.getByTestId('commands-view')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-view')).toBeNull();
    expect(screen.queryByTestId('workspace-view')).toBeNull();
    expect(window.location.hash).toBe('#commands');
  });

  it('restores the commands view from the URL hash on mount', () => {
    window.location.hash = '#commands';
    render(<AppShell deployTarget="local" />);
    expect(screen.getByTestId('commands-view')).toBeInTheDocument();
  });

  it('switches to monitoring view when the Monitoring tab is clicked', () => {
    render(<AppShell deployTarget="local" initialView="dashboard" />);
    fireEvent.click(screen.getByRole('tab', { name: /Monitoring/i }));
    expect(screen.getByTestId('monitoring-view')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-view')).toBeNull();
    expect(screen.queryByTestId('commands-view')).toBeNull();
    expect(screen.queryByTestId('workspace-view')).toBeNull();
    expect(window.location.hash).toBe('#monitoring');
  });

  it('restores the monitoring view from the URL hash on mount', () => {
    window.location.hash = '#monitoring';
    render(<AppShell deployTarget="local" />);
    expect(screen.getByTestId('monitoring-view')).toBeInTheDocument();
  });
});
