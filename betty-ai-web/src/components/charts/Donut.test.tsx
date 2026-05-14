import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Donut } from './Donut';

describe('Donut', () => {
  it('renders an empty-state placeholder for an empty slice list', () => {
    render(<Donut slices={[]} ariaLabel="Empty donut" />);
    const svg = screen.getByLabelText('Empty donut');
    expect(svg).toHaveAttribute('data-empty', 'true');
    expect(svg.textContent).toMatch(/no data/i);
  });

  it('renders one path per positive slice and a center total', () => {
    const { container } = render(
      <Donut
        slices={[
          { label: 'idle', value: 10 },
          { label: 'alloc', value: 30 },
          { label: 'drain', value: 5 },
        ]}
        ariaLabel="Node states"
      />,
    );
    const slices = container.querySelectorAll('[data-testid="donut-slice"]');
    expect(slices.length).toBe(3);

    const labels = Array.from(slices).map((s) => s.getAttribute('data-label'));
    expect(labels).toEqual(['idle', 'alloc', 'drain']);

    const total = container.querySelector('[data-testid="donut-total"]');
    // Sum = 45.
    expect(total?.textContent).toBe('45');
  });

  it('uses an explicit total override as the denominator', () => {
    const { container } = render(
      <Donut
        slices={[
          { label: 'alloc', value: 4 },
          { label: 'idle', value: 6 },
        ]}
        total={20}
      />,
    );
    const total = container.querySelector('[data-testid="donut-total"]');
    expect(total?.textContent).toBe('20');
    // Each slice's <title> should include the slice value and a percentage
    // computed against the override (4/20 = 20%).
    const titles = Array.from(
      container.querySelectorAll('[data-testid="donut-slice"] title'),
    ).map((n) => n.textContent ?? '');
    expect(titles.some((t) => t.includes('20.0%'))).toBe(true);
  });

  it('propagates aria-label to the root svg', () => {
    render(<Donut slices={[{ label: 'a', value: 1 }]} ariaLabel="Donut chart Z" />);
    expect(screen.getByLabelText('Donut chart Z')).toHaveAttribute('role', 'img');
  });
});
