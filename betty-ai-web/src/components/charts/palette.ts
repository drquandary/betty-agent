/**
 * Deterministic color palette for monitoring charts.
 *
 * Tokens are sourced from the Tailwind color system but locked to specific hex
 * values so charts render identically across the entire monitoring tab.
 *
 * Slurm-state semantics:
 *   idle   - partition has spare capacity
 *   mix    - partition is partially allocated
 *   alloc  - fully allocated
 *   drain  - administratively draining
 *   down   - unavailable / failed
 *   maint  - under maintenance
 *   resv   - reserved
 *   other  - uncategorized
 */

export const CHART_PALETTE = {
  idle: '#10b981', // emerald-500
  mix: '#f59e0b', // amber-500
  alloc: '#6366f1', // indigo-500
  drain: '#f97316', // orange-500
  down: '#ef4444', // red-500
  maint: '#a855f7', // violet-500
  resv: '#06b6d4', // cyan-500
  other: '#71717a', // zinc-500
} as const;

export type ChartPaletteToken = keyof typeof CHART_PALETTE;

/**
 * Ordered fallback colors when a caller does not pass an explicit color per
 * slice/segment. Up to 8 distinct values, in a stable order that keeps
 * legend/series alignment predictable.
 */
export const DEFAULT_SERIES_COLORS: readonly string[] = [
  CHART_PALETTE.alloc,
  CHART_PALETTE.idle,
  CHART_PALETTE.mix,
  CHART_PALETTE.resv,
  CHART_PALETTE.drain,
  CHART_PALETTE.maint,
  CHART_PALETTE.down,
  CHART_PALETTE.other,
];

/** Pick the i-th default color, wrapping when callers exceed the palette. */
export function paletteColor(index: number): string {
  if (DEFAULT_SERIES_COLORS.length === 0) return CHART_PALETTE.other;
  const i = ((index % DEFAULT_SERIES_COLORS.length) + DEFAULT_SERIES_COLORS.length) %
    DEFAULT_SERIES_COLORS.length;
  return DEFAULT_SERIES_COLORS[i]!;
}
