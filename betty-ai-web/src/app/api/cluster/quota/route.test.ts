import { describe, expect, it } from 'vitest';
import { parseParccQuota } from './parse';

const REAL_OUTPUT = `
----------------------------------------------------------------------------------------------------------
                                              Storage Quotas
----------------------------------------------------------------------------------------------------------
| Src  | Path                                  | Used     | Limit    | INodes Used | INode Limit | State |
| ceph | /ceph/projects/ryb/parcc-data-science | 0 B      | 1.07 TB  | 2.00        | 1.02 M      | OK    |
| vast | /vast/home/j/jvadala                  | 31.35 GB | 50.00 GB | 175.95 K    | 250.00 K    | OK    |
| vast | /vast/projects/ryb/parcc-data-science | 1.53 TB  | 2.00 TB  | 693.79 K    | 10.00 M     | OK    |
----------------------------------------------------------------------------------------------------------
`.trim();

describe('parseParccQuota', () => {
  it('returns [] on empty input', () => {
    expect(parseParccQuota('')).toEqual([]);
  });

  it('parses the real parcc_quota.py pipe-delimited table', () => {
    const rows = parseParccQuota(REAL_OUTPUT);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.filesystem)).toEqual([
      '/ceph/projects/ryb/parcc-data-science',
      '/vast/home/j/jvadala',
      '/vast/projects/ryb/parcc-data-science',
    ]);
  });

  it('computes usedPct from Used / Limit', () => {
    const rows = parseParccQuota(REAL_OUTPUT);
    const home = rows.find((r) => r.filesystem === '/vast/home/j/jvadala');
    expect(home).toBeDefined();
    // 31.35 GB / 50.00 GB ≈ 62.7%
    expect(home!.usedPct).toBeCloseTo(62.7, 1);
  });

  it('preserves the human-readable size strings', () => {
    const rows = parseParccQuota(REAL_OUTPUT);
    const proj = rows.find((r) => r.filesystem === '/vast/projects/ryb/parcc-data-science');
    expect(proj!.used).toBe('1.53 TB');
    expect(proj!.quota).toBe('2.00 TB');
  });

  it('returns 0% when usage is 0 B', () => {
    const rows = parseParccQuota(REAL_OUTPUT);
    const ceph = rows.find((r) => r.filesystem === '/ceph/projects/ryb/parcc-data-science');
    expect(ceph!.usedPct).toBe(0);
  });

  it('skips header rows and ASCII rule lines', () => {
    const rows = parseParccQuota(REAL_OUTPUT);
    expect(rows.every((r) => !/^Src/.test(r.filesystem))).toBe(true);
  });

  it('skips malformed body rows', () => {
    const stdout = [
      '| Src | Path | Used | Limit | INodes Used | INode Limit | State |',
      '| vast | /good | 1 GB | 10 GB | 1 | 10 | OK |',
      '| vast | /broken | not-a-size | 10 GB | 1 | 10 | OK |',
    ].join('\n');
    const rows = parseParccQuota(stdout);
    expect(rows.map((r) => r.filesystem)).toEqual(['/good']);
  });
});
