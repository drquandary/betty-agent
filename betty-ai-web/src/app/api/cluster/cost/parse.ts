/**
 * Parser for `parcc_sreport.py --user <pennkey>` rows like:
 *   jcombar1-betty-testing   PC 61.06    PC 12,000.00   0.5%
 *
 * Lives outside route.ts because Next.js 15 rejects any non-route export from
 * a route module during build-time type validation.
 */

export interface AccountUsage {
  account: string;
  spentPc: number;
  allocatedPc: number;
  usedPct: number;
}

const ROW_RE = /^(\S+)\s+PC\s+([\d,]+\.\d+)\s+PC\s+([\d,]+\.\d+)\s+([\d.]+)%/;

export function parseSreport(stdout: string): AccountUsage[] {
  const rows: AccountUsage[] = [];
  for (const line of stdout.split('\n')) {
    const m = ROW_RE.exec(line.trim());
    if (!m) continue;
    rows.push({
      account: m[1],
      spentPc: Number(m[2].replace(/,/g, '')),
      allocatedPc: Number(m[3].replace(/,/g, '')),
      usedPct: Number(m[4]),
    });
  }
  return rows;
}
