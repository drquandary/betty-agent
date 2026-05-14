import { paletteColor } from './palette';

export interface StackedBarSegment {
  key: string;
  value: number;
  color?: string;
}

export interface StackedBarGroup {
  label: string;
  segments: Array<{ key: string; value: number; color?: string }>;
}

export interface StackedBarProps {
  groups: Array<{
    label: string;
    segments: Array<{ key: string; value: number; color?: string }>;
  }>;
  legend?: boolean;
  /** Total chart height in px. Bar height per row is computed from this. */
  height?: number;
  ariaLabel?: string;
}

/**
 * Inline-SVG horizontal stacked bar. Server-renderable.
 *
 * Each row is a "group". Per-segment hover surfaces value via <title>.
 * - Empty `groups` → "no data" placeholder.
 * - Each segment is rendered as its own <rect data-testid="stacked-bar-segment">.
 */
export function StackedBar({
  groups,
  legend = true,
  height = 140,
  ariaLabel,
}: StackedBarProps) {
  const width = 320;
  const labelGutter = 70;
  const rowGap = 6;
  const padTop = 6;
  const padBottom = legend ? 26 : 6;

  const nonEmpty = (groups ?? []).filter((g) => g.segments.length > 0);
  if (nonEmpty.length === 0) {
    return (
      <svg
        data-testid="stacked-bar"
        data-empty="true"
        role="img"
        aria-label={ariaLabel ?? 'Stacked bar chart (no data)'}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <rect
          x={2}
          y={height / 2 - 6}
          width={width - 4}
          height={12}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeDasharray="3 3"
          rx={3}
        />
        <text
          x={width / 2}
          y={height / 2 + 18}
          textAnchor="middle"
          className="fill-zinc-600"
          style={{ fontSize: 10 }}
        >
          no data
        </text>
      </svg>
    );
  }

  const usableH = Math.max(20, height - padTop - padBottom);
  const rowH = Math.max(8, (usableH - rowGap * (nonEmpty.length - 1)) / nonEmpty.length);

  const chartX = labelGutter + 4;
  const chartW = width - chartX - 6;

  // Determine the maximum group total so all bars share a horizontal scale.
  const maxTotal = nonEmpty.reduce((m, g) => {
    const total = g.segments.reduce((a, s) => a + Math.max(0, s.value), 0);
    return Math.max(m, total);
  }, 0) || 1;

  // Build a legend keyed by segment.key in order of first appearance.
  const legendOrder: Array<{ key: string; color: string }> = [];
  const seen = new Set<string>();
  let paletteIdx = 0;
  for (const g of nonEmpty) {
    for (const s of g.segments) {
      if (!seen.has(s.key)) {
        seen.add(s.key);
        legendOrder.push({ key: s.key, color: s.color ?? paletteColor(paletteIdx) });
        paletteIdx += 1;
      }
    }
  }
  const colorByKey: Record<string, string> = {};
  for (const item of legendOrder) colorByKey[item.key] = item.color;

  return (
    <svg
      data-testid="stacked-bar"
      role="img"
      aria-label={ariaLabel ?? 'Stacked bar chart'}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {nonEmpty.map((g, gi) => {
        const total = g.segments.reduce((a, s) => a + Math.max(0, s.value), 0);
        const rowY = padTop + gi * (rowH + rowGap);
        let cursorX = chartX;
        return (
          <g key={`${g.label}-${gi}`} data-testid="stacked-bar-row" data-label={g.label}>
            <text
              x={labelGutter}
              y={rowY + rowH / 2 + 3}
              textAnchor="end"
              className="fill-zinc-400"
              style={{ fontSize: 10 }}
            >
              {truncate(g.label, 12)}
            </text>
            {/* Track background */}
            <rect
              x={chartX}
              y={rowY}
              width={chartW}
              height={rowH}
              fill="rgba(255,255,255,0.04)"
              rx={2}
            />
            {g.segments.map((seg, si) => {
              const v = Math.max(0, seg.value);
              const w = (v / maxTotal) * chartW;
              const x = cursorX;
              cursorX += w;
              const color = seg.color ?? colorByKey[seg.key] ?? paletteColor(si);
              return (
                <rect
                  key={`${seg.key}-${si}`}
                  data-testid="stacked-bar-segment"
                  data-key={seg.key}
                  data-value={v}
                  x={x}
                  y={rowY}
                  width={Math.max(0, w)}
                  height={rowH}
                  fill={color}
                  opacity={0.85}
                >
                  <title>
                    {g.label} · {seg.key}: {formatNumber(v)} ({total > 0 ? ((v / total) * 100).toFixed(1) : '0.0'}%)
                  </title>
                </rect>
              );
            })}
          </g>
        );
      })}
      {legend && legendOrder.length > 0 && (
        <g data-testid="stacked-bar-legend" transform={`translate(${chartX}, ${height - padBottom + 10})`}>
          {legendOrder.slice(0, 6).map((item, i) => (
            <g key={item.key} transform={`translate(${i * 56}, 0)`}>
              <rect width={8} height={8} y={-7} fill={item.color} rx={1.5} />
              <text x={11} y={0} className="fill-zinc-400" style={{ fontSize: 9 }}>
                {truncate(item.key, 8)}
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

function truncate(s: string, n: number): string {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(1);
}
