/**
 * Parser for `parcc_quota.py`. The helper prints a pipe-delimited table
 * with header `| Src | Path | Used | Limit | INodes Used | INode Limit | State |`
 * surrounded by ASCII rules. Example body row:
 *
 *   | vast | /vast/home/j/jvadala | 31.35 GB | 50.00 GB | 175.95 K | 250.00 K | OK |
 *
 * We extract Path, Used, Limit, and compute usedPct from the size values.
 * Rows that don't parse cleanly are dropped — never raise.
 *
 * Sits outside route.ts because Next.js 15 rejects non-route exports.
 */

export interface QuotaRow {
  filesystem: string;
  used: string;
  quota: string;
  usedPct: number;
}

const UNIT_FACTORS: Record<string, number> = {
  B: 1,
  KB: 1e3,
  KIB: 1024,
  MB: 1e6,
  MIB: 1024 ** 2,
  GB: 1e9,
  GIB: 1024 ** 3,
  TB: 1e12,
  TIB: 1024 ** 4,
  PB: 1e15,
  PIB: 1024 ** 5,
  K: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
  P: 1e15,
};

const SIZE_RE = /^([\d.]+)\s*([A-Za-z]*)$/;

function toBytes(s: string): number | null {
  const m = SIZE_RE.exec(s.trim());
  if (!m) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value)) return null;
  const unit = (m[2] || 'B').toUpperCase();
  const factor = UNIT_FACTORS[unit];
  if (factor == null) return null;
  return value * factor;
}

export function parseParccQuota(stdout: string): QuotaRow[] {
  const rows: QuotaRow[] = [];
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || !line.startsWith('|')) continue;
    // Skip ASCII rule lines and the table header.
    if (/^[|\-+\s]+$/.test(line)) continue;
    const cells = line.split('|').map((c) => c.trim());
    // First and last are empty strings from the leading/trailing `|`.
    // Body rows look like ['', Src, Path, Used, Limit, INodesUsed, INodeLimit, State, ''].
    if (cells.length < 6) continue;
    if (/^Src$/i.test(cells[1]) || /^Path$/i.test(cells[2])) continue;
    const path = cells[2];
    const usedStr = cells[3];
    const limitStr = cells[4];
    if (!path || !usedStr || !limitStr) continue;
    const usedBytes = toBytes(usedStr);
    const limitBytes = toBytes(limitStr);
    if (usedBytes == null || limitBytes == null || limitBytes <= 0) continue;
    const usedPct = Math.round((usedBytes / limitBytes) * 1000) / 10;
    rows.push({
      filesystem: path,
      used: usedStr,
      quota: limitStr,
      usedPct,
    });
  }
  return rows;
}
