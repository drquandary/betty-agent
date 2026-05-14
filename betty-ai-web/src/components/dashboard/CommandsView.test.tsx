import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommandsView } from './CommandsView';

describe('CommandsView', () => {
  it('renders all five command groups', () => {
    render(<CommandsView />);
    expect(screen.getByTestId('commands-group-auth')).toBeInTheDocument();
    expect(screen.getByTestId('commands-group-permissions')).toBeInTheDocument();
    expect(screen.getByTestId('commands-group-modules')).toBeInTheDocument();
    expect(screen.getByTestId('commands-group-slurm')).toBeInTheDocument();
    expect(screen.getByTestId('commands-group-storage')).toBeInTheDocument();
  });

  it('shows ryb-facilitation permissions commands (stat, chmod, chgrp, setfacl, getfacl)', () => {
    render(<CommandsView />);
    expect(screen.getByText(/^stat /)).toBeInTheDocument();
    expect(screen.getByText(/^chmod /)).toBeInTheDocument();
    expect(screen.getByText(/^chgrp /)).toBeInTheDocument();
    expect(screen.getByText(/^setfacl /)).toBeInTheDocument();
    expect(screen.getByText(/^getfacl /)).toBeInTheDocument();
  });

  it('tags the daily-use commands with a "daily" badge', () => {
    render(<CommandsView />);
    const badges = screen.getAllByText(/^daily$/);
    // We expect at least 5 daily-tagged commands across all groups.
    expect(badges.length).toBeGreaterThanOrEqual(5);
  });

  it('copies the example (when provided) or the command on click', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CommandsView />);

    const statBtn = screen.getByText(/^stat /).closest('button');
    expect(statBtn).not.toBeNull();
    fireEvent.click(statBtn!);
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('stat /vast/projects/beast2-jcombar1/run.sh'),
    );
  });

  it('falls back to the command itself when no example is set', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CommandsView />);

    const sfreeBtn = screen.getByText('parcc_sfree.py').closest('button');
    expect(sfreeBtn).not.toBeNull();
    fireEvent.click(sfreeBtn!);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('parcc_sfree.py'));
  });
});
