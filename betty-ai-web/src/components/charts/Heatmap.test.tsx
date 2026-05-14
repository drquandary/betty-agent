import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Heatmap } from './Heatmap';

describe('Heatmap', () => {
  it('renders an empty-state placeholder when rows is empty', () => {
    render(<Heatmap rows={[]} ariaLabel="Empty heatmap" />);
    const svg = screen.getByLabelText('Empty heatmap');
    expect(svg).toHaveAttribute('data-empty', 'true');
    expect(svg.textContent).toMatch(/no data/i);
  });

  it('renders the correct number of cells with hover titles', () => {
    const { container } = render(
      <Heatmap
        rows={[
          {
            label: 'queue1',
            cells: [
              { key: '00', value: 1, label: '00:00' },
              { key: '01', value: 5, label: '01:00' },
              { key: '02', value: 3, label: '02:00' },
            ],
          },
          {
            label: 'queue2',
            cells: [
              { key: '00', value: 0 },
              { key: '01', value: 2 },
              { key: '02', value: 9 },
            ],
          },
        ]}
        columnLabels={['00', '01', '02']}
        ariaLabel="Submission heat"
      />,
    );
    const cells = container.querySelectorAll('[data-testid="heatmap-cell"]');
    expect(cells.length).toBe(6);

    const titles = Array.from(container.querySelectorAll('title')).map(
      (n) => n.textContent ?? '',
    );
    expect(titles.some((t) => t.includes('queue1') && t.includes('01:00'))).toBe(true);
    expect(titles.some((t) => t.includes('queue2') && t.includes('9'))).toBe(true);
  });

  it('propagates aria-label to the root svg', () => {
    render(
      <Heatmap
        rows={[{ label: 'r1', cells: [{ key: 'a', value: 1 }] }]}
        ariaLabel="Heatmap Q"
      />,
    );
    expect(screen.getByLabelText('Heatmap Q')).toHaveAttribute('role', 'img');
  });

  it('uses a custom colorScale when provided', () => {
    const { container } = render(
      <Heatmap
        rows={[{ label: 'r', cells: [{ key: 'a', value: 5 }] }]}
        colorScale={() => '#abcdef'}
      />,
    );
    const cell = container.querySelector('[data-testid="heatmap-cell"]');
    expect(cell?.getAttribute('fill')).toBe('#abcdef');
  });
});
