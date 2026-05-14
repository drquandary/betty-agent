import { describe, expect, it } from 'vitest';
import { parseSreport } from './parse';

// Representative `parcc_sreport.py --user jvadala` output. The header text is
// invented (the regex doesn't anchor on it), but the data rows are the shape
// captured in parse.ts's leading comment:
//   jcombar1-betty-testing   PC 61.06    PC 12,000.00   0.5%
const REAL_OUTPUT = `
PARCC Service Report for user jvadala
----------------------------------------------------------------
Account                          Spent         Allocated      Used
----------------------------------------------------------------
jcombar1-betty-testing   PC 61.06       PC 12,000.00   0.5%
ryb-parcc-data-science   PC 1,234.50    PC 50,000.00   2.47%
jvadala-personal         PC 999.99      PC 1,000.00    99.99%
----------------------------------------------------------------
`.trim();

describe('parseSreport', () => {
  it('returns [] on empty input', () => {
    expect(parseSreport('')).toEqual([]);
  });

  it('returns [] when only header / decoration lines are present', () => {
    const stdout = [
      'PARCC Service Report for user jvadala',
      '----------------------------------------------------------------',
      'Account                          Spent         Allocated      Used',
      '----------------------------------------------------------------',
    ].join('\n');
    expect(parseSreport(stdout)).toEqual([]);
  });

  it('parses a realistic multi-row sreport table', () => {
    const rows = parseSreport(REAL_OUTPUT);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.account)).toEqual([
      'jcombar1-betty-testing',
      'ryb-parcc-data-science',
      'jvadala-personal',
    ]);
  });

  it('strips thousands separators from numeric fields', () => {
    const rows = parseSreport(REAL_OUTPUT);
    const ryb = rows.find((r) => r.account === 'ryb-parcc-data-science');
    expect(ryb).toBeDefined();
    expect(ryb!.spentPc).toBe(1234.5);
    expect(ryb!.allocatedPc).toBe(50000);
    expect(ryb!.usedPct).toBe(2.47);
  });

  it('parses the first data row correctly (small spent, large allocated)', () => {
    const rows = parseSreport(REAL_OUTPUT);
    const a = rows[0];
    expect(a.account).toBe('jcombar1-betty-testing');
    expect(a.spentPc).toBe(61.06);
    expect(a.allocatedPc).toBe(12000);
    expect(a.usedPct).toBe(0.5);
  });

  it('handles a near-fully-used allocation', () => {
    const rows = parseSreport(REAL_OUTPUT);
    const p = rows.find((r) => r.account === 'jvadala-personal');
    expect(p!.spentPc).toBe(999.99);
    expect(p!.allocatedPc).toBe(1000);
    expect(p!.usedPct).toBe(99.99);
  });

  // FIXME: parse.ts's ROW_RE requires a decimal point in both PC amounts
  // (`[\d,]+\.\d+`). An integer-only row like `PC 100` is silently dropped.
  // Documenting current behavior; fix is out of scope for this test agent.
  it('drops integer-only PC amounts (regex requires a decimal point)', () => {
    const stdout = 'username PC 100 PC 200 50%';
    expect(parseSreport(stdout)).toEqual([]);
  });

  // FIXME: same regex limitation — a percent without decimals (e.g. `50%`)
  // also fails the third capture group's `[\d.]+` pattern in combination
  // with the upstream PC fields. Confirms the drop is upstream-of-percent.
  it('parses a row when percent is an integer but PC amounts have decimals', () => {
    const stdout = 'acct1 PC 50.00 PC 100.00 50%';
    const rows = parseSreport(stdout);
    expect(rows).toHaveLength(1);
    expect(rows[0].usedPct).toBe(50);
  });

  it('does not throw on a malformed line in the middle of valid data', () => {
    const stdout = [
      'acct-a PC 10.00 PC 100.00 10.0%',
      '*** garbage line *** with no PC tokens',
      'acct-b PC 50.50 PC 200.00 25.25%',
    ].join('\n');
    const rows = parseSreport(stdout);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.account)).toEqual(['acct-a', 'acct-b']);
  });

  it('tolerates extra whitespace and tabs between fields', () => {
    const stdout = 'acct-x\tPC\t10.00   PC    100.00   \t  10.0%';
    const rows = parseSreport(stdout);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      account: 'acct-x',
      spentPc: 10,
      allocatedPc: 100,
      usedPct: 10,
    });
  });

  it('handles a trailing newline without extra empty rows', () => {
    const stdout = 'acct-x PC 10.00 PC 100.00 10.0%\n\n\n';
    const rows = parseSreport(stdout);
    expect(rows).toHaveLength(1);
  });

  it('handles leading whitespace on a row', () => {
    const stdout = '    acct-y PC 5.00 PC 50.00 10.0%';
    const rows = parseSreport(stdout);
    expect(rows).toHaveLength(1);
    expect(rows[0].account).toBe('acct-y');
  });
});
