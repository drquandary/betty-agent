import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StackedBar } from './StackedBar';

describe('StackedBar', () => {
  it('renders an empty-state placeholder when groups is empty', () => {
    render(<StackedBar groups={[]} ariaLabel="Empty bars" />);
    const svg = screen.getByLabelText('Empty bars');
    expect(svg).toHaveAttribute('data-empty', 'true');
    expect(svg.textContent).toMatch(/no data/i);
  });

  it('renders one segment rect per segment with tooltip titles', () => {
    const { container } = render(
      <StackedBar
        groups={[
          {
            label: 'gpu-a100',
            segments: [
              { key: 'alloc', value: 3 },
              { key: 'idle', value: 7 },
            ],
          },
          {
            label: 'gpu-b200',
            segments: [
              { key: 'alloc', value: 8 },
              { key: 'idle', value: 2 },
              { key: 'drain', value: 1 },
            ],
          },
        ]}
        ariaLabel="Partition fill"
      />,
    );
    const segments = container.querySelectorAll('[data-testid="stacked-bar-segment"]');
    expect(segments.length).toBe(5);

    const titles = Array.from(container.querySelectorAll('title')).map(
      (n) => n.textContent ?? '',
    );
    // First-row alloc tooltip is "gpu-a100 · alloc: 3 (30.0%)" (3 of 10).
    expect(titles.some((t) => t.includes('gpu-a100') && t.includes('alloc') && t.includes('30.0%'))).toBe(true);
  });

  it('propagates aria-label to the root svg', () => {
    render(
      <StackedBar
        groups={[{ label: 'p1', segments: [{ key: 'a', value: 1 }] }]}
        ariaLabel="Stacked partitions"
      />,
    );
    expect(screen.getByLabelText('Stacked partitions')).toHaveAttribute('role', 'img');
  });

  it('renders a legend by default and hides it when legend=false', () => {
    const { container, rerender } = render(
      <StackedBar
        groups={[{ label: 'p1', segments: [{ key: 'a', value: 1 }, { key: 'b', value: 2 }] }]}
      />,
    );
    expect(container.querySelector('[data-testid="stacked-bar-legend"]')).not.toBeNull();

    rerender(
      <StackedBar
        groups={[{ label: 'p1', segments: [{ key: 'a', value: 1 }, { key: 'b', value: 2 }] }]}
        legend={false}
      />,
    );
    expect(container.querySelector('[data-testid="stacked-bar-legend"]')).toBeNull();
  });
});
