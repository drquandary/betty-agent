import { paletteColor } from './palette';

export interface DonutSlice {
  label: string;
  value: number;
  color?: string;
}

export interface DonutProps {
  slices: Array<{ label: string; value: number; color?: string }>;
  size?: number;
  /** If provided, used as the denominator; otherwise the sum of values. */
  total?: number;
  ariaLabel?: string;
}

/**
 * Inline-SVG donut chart. Server-renderable.
 *
 * - Empty `slices` (or zero sum and no `total`) → dashed "no data" ring.
 * - Up to 8 distinct default colors from the chart palette.
 * - Renders a center label with the total + per-slice <title> tooltips.
 */
export function Donut({
  slices,
  size = 120,
  total: totalOverride,
  ariaLabel,
}: DonutProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 2;
  const ringWidth = Math.max(6, size * 0.16);
  const innerR = radius - ringWidth;

  const positive = (slices ?? []).filter((s) => Number.isFinite(s.value) && s.value > 0);
  const sum = positive.reduce((acc, s) => acc + s.value, 0);
  const denom = typeof totalOverride === 'number' && totalOverride > 0 ? totalOverride : sum;

  if (positive.length === 0 || denom <= 0) {
    return (
      <svg
        data-testid="donut"
        data-empty="true"
        role="img"
        aria-label={ariaLabel ?? 'Donut chart (no data)'}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={cx}
          cy={cy}
          r={radius - ringWidth / 2}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={ringWidth}
          strokeDasharray="4 4"
        />
        <text
          x={cx}
          y={cy + 3}
          textAnchor="middle"
          className="fill-zinc-600"
          style={{ fontSize: 10 }}
        >
          no data
        </text>
      </svg>
    );
  }

  let cumulative = 0;
  const arcs = positive.map((s, i) => {
    const start = cumulative / denom;
    cumulative += s.value;
    const end = Math.min(1, cumulative / denom);
    const color = s.color ?? paletteColor(i);
    return { ...s, color, start, end };
  });

  return (
    <svg
      data-testid="donut"
      role="img"
      aria-label={ariaLabel ?? `Donut chart, total ${formatNumber(denom)}`}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
    >
      <circle
        cx={cx}
        cy={cy}
        r={radius - ringWidth / 2}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={ringWidth}
      />
      {arcs.map((arc, i) => {
        const path = describeArc(cx, cy, radius - ringWidth / 2, arc.start, arc.end);
        return (
          <path
            key={`${arc.label}-${i}`}
            data-testid="donut-slice"
            data-label={arc.label}
            d={path}
            fill="none"
            stroke={arc.color}
            strokeWidth={ringWidth}
            strokeLinecap="butt"
          >
            <title>
              {arc.label}: {formatNumber(arc.value)} ({((arc.value / denom) * 100).toFixed(1)}%)
            </title>
          </path>
        );
      })}
      <text
        data-testid="donut-total"
        x={cx}
        y={cy + 2}
        textAnchor="middle"
        className="fill-zinc-100"
        style={{ fontSize: Math.max(11, size * 0.14), fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
      >
        {formatNumber(denom)}
      </text>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        className="fill-zinc-500"
        style={{ fontSize: Math.max(8, size * 0.08), letterSpacing: '0.08em', textTransform: 'uppercase' }}
      >
        total
      </text>
      {innerR /* swallow var to keep TS happy */ ? null : null}
    </svg>
  );
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startFrac: number,
  endFrac: number,
): string {
  // For a complete circle we have to draw it as two half arcs because a single
  // arc with the same start and end is degenerate.
  if (endFrac - startFrac >= 0.9999) {
    const halfA = describeArc(cx, cy, r, 0, 0.5);
    const halfB = describeArc(cx, cy, r, 0.5, 1);
    return `${halfA} ${halfB}`;
  }
  const start = polarToCartesian(cx, cy, r, startFrac);
  const end = polarToCartesian(cx, cy, r, endFrac);
  const largeArcFlag = endFrac - startFrac > 0.5 ? 1 : 0;
  return [
    'M',
    start.x.toFixed(2),
    start.y.toFixed(2),
    'A',
    r.toFixed(2),
    r.toFixed(2),
    0,
    largeArcFlag,
    1,
    end.x.toFixed(2),
    end.y.toFixed(2),
  ].join(' ');
}

function polarToCartesian(cx: number, cy: number, r: number, frac: number) {
  const angle = frac * Math.PI * 2 - Math.PI / 2;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(1);
}
