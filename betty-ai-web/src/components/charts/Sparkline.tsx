import { CHART_PALETTE } from './palette';

export interface SparklinePoint {
  x: number;
  y: number;
}

export interface SparklineProps {
  points: Array<{ x: number; y: number }>;
  width?: number;
  height?: number;
  color?: string;
  label?: string;
  ariaLabel?: string;
}

/**
 * Inline-SVG sparkline. Server-renderable: no useState/useEffect.
 *
 * - Empty `points` → renders a dashed "no data" placeholder.
 * - Uses a Catmull-Rom-to-Bezier smoothing for the trend line.
 * - Final point is highlighted with a dot and optional `label`.
 */
export function Sparkline({
  points,
  width = 160,
  height = 40,
  color = CHART_PALETTE.alloc,
  label,
  ariaLabel,
}: SparklineProps) {
  const pad = 2;
  const innerW = Math.max(1, width - pad * 2);
  const innerH = Math.max(1, height - pad * 2);

  if (!points || points.length === 0) {
    return (
      <svg
        data-testid="sparkline"
        data-empty="true"
        role="img"
        aria-label={ariaLabel ?? 'Sparkline (no data)'}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        <line
          x1={pad}
          y1={height / 2}
          x2={width - pad}
          y2={height / 2}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <text
          x={width / 2}
          y={height / 2 - 4}
          textAnchor="middle"
          className="fill-zinc-600"
          style={{ fontSize: 9 }}
        >
          no data
        </text>
      </svg>
    );
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  const scaled = points.map((p) => ({
    x: pad + ((p.x - minX) / spanX) * innerW,
    y: pad + innerH - ((p.y - minY) / spanY) * innerH,
  }));

  // Build a smoothed path via Catmull-Rom → cubic Bezier.
  let d = `M ${scaled[0]!.x.toFixed(2)} ${scaled[0]!.y.toFixed(2)}`;
  if (scaled.length === 1) {
    // Single point — just draw a dot via a tiny line.
    d += ` L ${scaled[0]!.x.toFixed(2)} ${scaled[0]!.y.toFixed(2)}`;
  } else {
    for (let i = 0; i < scaled.length - 1; i += 1) {
      const p0 = scaled[i - 1] ?? scaled[i]!;
      const p1 = scaled[i]!;
      const p2 = scaled[i + 1]!;
      const p3 = scaled[i + 2] ?? p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
  }

  const last = scaled[scaled.length - 1]!;
  const lastValue = points[points.length - 1]!.y;
  const labelText = label ?? formatCompact(lastValue);

  return (
    <svg
      data-testid="sparkline"
      role="img"
      aria-label={ariaLabel ?? `Sparkline, latest ${labelText}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <path
        data-testid="sparkline-path"
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        data-testid="sparkline-last-dot"
        cx={last.x}
        cy={last.y}
        r={2}
        fill={color}
      />
      <text
        data-testid="sparkline-last-label"
        x={Math.min(width - 1, last.x + 4)}
        y={Math.max(8, last.y - 4)}
        textAnchor={last.x > width - 24 ? 'end' : 'start'}
        className="fill-zinc-300"
        style={{ fontSize: 9, fontVariantNumeric: 'tabular-nums' }}
      >
        {labelText}
      </text>
    </svg>
  );
}

function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1000) return `${(n / 1000).toFixed(1)}k`;
  if (abs >= 100) return n.toFixed(0);
  if (abs >= 10) return n.toFixed(1);
  return n.toFixed(2);
}
