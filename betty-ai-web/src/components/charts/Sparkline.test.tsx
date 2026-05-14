import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sparkline } from './Sparkline';

describe('Sparkline', () => {
  it('renders an empty-state placeholder for an empty point list', () => {
    render(<Sparkline points={[]} ariaLabel="Empty spark" />);
    const svg = screen.getByLabelText('Empty spark');
    expect(svg).toHaveAttribute('data-empty', 'true');
    expect(svg.textContent).toMatch(/no data/i);
  });

  it('renders a smoothed path + last-value dot + label for the given points', () => {
    const { container } = render(
      <Sparkline
        points={[
          { x: 0, y: 1 },
          { x: 1, y: 3 },
          { x: 2, y: 2 },
          { x: 3, y: 5 },
        ]}
        label="5"
        ariaLabel="Backfill spark"
      />,
    );
    const path = container.querySelector('[data-testid="sparkline-path"]');
    expect(path).not.toBeNull();
    const d = path?.getAttribute('d') ?? '';
    // Catmull-Rom smoothing emits cubic Beziers between successive points.
    expect(d).toMatch(/^M /);
    expect(d).toContain('C');

    const dot = container.querySelector('[data-testid="sparkline-last-dot"]');
    expect(dot).not.toBeNull();

    const label = container.querySelector('[data-testid="sparkline-last-label"]');
    expect(label?.textContent).toBe('5');
  });

  it('propagates aria-label to the root svg', () => {
    render(<Sparkline points={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} ariaLabel="Latency" />);
    expect(screen.getByLabelText('Latency')).toHaveAttribute('role', 'img');
  });

  it('handles a single-point series without crashing', () => {
    const { container } = render(<Sparkline points={[{ x: 0, y: 7 }]} />);
    const path = container.querySelector('[data-testid="sparkline-path"]');
    expect(path).not.toBeNull();
    expect(path?.getAttribute('d') ?? '').toMatch(/^M /);
  });
});
