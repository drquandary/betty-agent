import { CHART_PALETTE } from './palette';

export interface HeatmapCell {
  key: string;
  value: number;
  label?: string;
  color?: string;
}

export interface HeatmapRow {
  label: string;
  cells: Array<{ key: string; value: number; label?: string; color?: string }>;
}

export interface HeatmapProps {
  rows: Array<{
    label: string;
    cells: Array<{ key: string; value: number; label?: string; color?: string }>;
  }>;
  columnLabels?: string[];
  /** Override the default value→color mapping. */
  colorScale?: (v: number) => string;
  /** Pixel width/height of each cell. Defaults to 18. Use smaller values when
   * rendering wide rows (e.g. 64+ nodes) inside a fixed-width container so
   * the SVG fits without horizontal scroll. */
  cellSize?: number;
  ariaLabel?: string;
}

/**
 * Inline-SVG heatmap. Server-renderable.
 *
 * - Empty `rows` → "no data" placeholder.
 * - Each cell renders a <rect data-testid="heatmap-cell"> with a <title> tooltip.
 */
export function Heatmap({
  rows,
  columnLabels,
  colorScale,
  cellSize: cellSizeOverride,
  ariaLabel,
}: HeatmapProps) {
  const labelGutter = 70;
  const cellSize = cellSizeOverride ?? 18;
  const cellGap = 2;
  const padTop = columnLabels && columnLabels.length > 0 ? 18 : 6;
  const padBottom = 4;
  const padRight = 6;

  const usableRows = (rows ?? []).filter((r) => r.cells.length > 0);
  if (usableRows.length === 0) {
    const fallbackW = 240;
    const fallbackH = 80;
    return (
      <svg
        data-testid="heatmap"
        data-empty="true"
        role="img"
        aria-label={ariaLabel ?? 'Heatmap (no data)'}
        width={fallbackW}
        height={fallbackH}
        viewBox={`0 0 ${fallbackW} ${fallbackH}`}
      >
        <rect
          x={2}
          y={2}
          width={fallbackW - 4}
          height={fallbackH - 4}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeDasharray="3 3"
          rx={3}
        />
        <text
          x={fallbackW / 2}
          y={fallbackH / 2 + 3}
          textAnchor="middle"
          className="fill-zinc-600"
          style={{ fontSize: 10 }}
        >
          no data
        </text>
      </svg>
    );
  }

  const maxCols = usableRows.reduce((m, r) => Math.max(m, r.cells.length), 0);
  const width = labelGutter + maxCols * (cellSize + cellGap) + padRight;
  const height = padTop + usableRows.length * (cellSize + cellGap) + padBottom;

  // Determine min/max for the default color scale.
  let minV = Infinity;
  let maxV = -Infinity;
  for (const row of usableRows) {
    for (const cell of row.cells) {
      if (!Number.isFinite(cell.value)) continue;
      if (cell.value < minV) minV = cell.value;
      if (cell.value > maxV) maxV = cell.value;
    }
  }
  if (!Number.isFinite(minV)) minV = 0;
  if (!Number.isFinite(maxV)) maxV = 1;
  const range = maxV - minV || 1;

  const defaultScale = (v: number) => {
    if (!Number.isFinite(v)) return 'rgba(255,255,255,0.04)';
    const t = Math.min(1, Math.max(0, (v - minV) / range));
    // Blend indigo (cool) → amber (hot) for a familiar Datadog-style ramp.
    return blendHex(CHART_PALETTE.alloc, CHART_PALETTE.mix, t);
  };
  const scale = colorScale ?? defaultScale;

  return (
    <svg
      data-testid="heatmap"
      role="img"
      aria-label={ariaLabel ?? 'Heatmap'}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {columnLabels && columnLabels.length > 0 && (
        <g data-testid="heatmap-columns">
          {columnLabels.slice(0, maxCols).map((cl, ci) => (
            <text
              key={`col-${ci}`}
              x={labelGutter + ci * (cellSize + cellGap) + cellSize / 2}
              y={padTop - 6}
              textAnchor="middle"
              className="fill-zinc-500"
              style={{ fontSize: 9 }}
            >
              {truncate(cl, 6)}
            </text>
          ))}
        </g>
      )}
      {usableRows.map((row, ri) => {
        const y = padTop + ri * (cellSize + cellGap);
        return (
          <g key={`${row.label}-${ri}`} data-testid="heatmap-row" data-label={row.label}>
            <text
              x={labelGutter - 4}
              y={y + cellSize / 2 + 3}
              textAnchor="end"
              className="fill-zinc-400"
              style={{ fontSize: 10 }}
            >
              {truncate(row.label, 12)}
            </text>
            {row.cells.map((cell, ci) => {
              const x = labelGutter + ci * (cellSize + cellGap);
              const fill = cell.color ?? scale(cell.value);
              const titleLabel = cell.label ?? cell.key;
              return (
                <rect
                  key={`${cell.key}-${ci}`}
                  data-testid="heatmap-cell"
                  data-key={cell.key}
                  data-value={cell.value}
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  fill={fill}
                  rx={2}
                >
                  <title>
                    {row.label} · {titleLabel}: {formatNumber(cell.value)}
                  </title>
                </rect>
              );
            })}
          </g>
        );
      })}
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
  return n.toFixed(2);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const v = h.length === 3
    ? h.split('').map((c) => c + c).join('')
    : h;
  const num = parseInt(v, 16);
  return { r: (num >> 16) & 0xff, g: (num >> 8) & 0xff, b: num & 0xff };
}

function blendHex(a: string, b: string, t: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  const r = Math.round(ra.r + (rb.r - ra.r) * t);
  const g = Math.round(ra.g + (rb.g - ra.g) * t);
  const bl = Math.round(ra.b + (rb.b - ra.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}
