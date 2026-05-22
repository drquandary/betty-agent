import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabStrip } from './TabStrip';

describe('TabStrip', () => {
  it('renders five tabs: Dashboard, Commands, Monitoring, Legend, Workspace', () => {
    render(<TabStrip current="dashboard" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Commands/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Monitoring/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Legend/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Workspace/i })).toBeInTheDocument();
  });

  it('marks the current tab as selected', () => {
    render(<TabStrip current="commands" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: /Dashboard/i })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: /Commands/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Monitoring/i })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: /Workspace/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('marks Monitoring as selected when current is monitoring', () => {
    render(<TabStrip current="monitoring" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: /Monitoring/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Workspace/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('invokes onChange with the clicked id', () => {
    const onChange = vi.fn();
    render(<TabStrip current="dashboard" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: /Commands/i }));
    expect(onChange).toHaveBeenCalledWith('commands');
    fireEvent.click(screen.getByRole('tab', { name: /Monitoring/i }));
    expect(onChange).toHaveBeenCalledWith('monitoring');
    fireEvent.click(screen.getByRole('tab', { name: /Workspace/i }));
    expect(onChange).toHaveBeenCalledWith('workspace');
    fireEvent.click(screen.getByRole('tab', { name: /Legend/i }));
    expect(onChange).toHaveBeenCalledWith('legend');
  });
});
