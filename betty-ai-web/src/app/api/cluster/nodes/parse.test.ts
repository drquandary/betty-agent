import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSinfoNodes } from './parse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(__dirname, '..', '__fixtures__', 'nodes');
const HAPPY = readFileSync(path.join(FIX, 'happy.txt'), 'utf8');
const DEGRADED = readFileSync(path.join(FIX, 'degraded.txt'), 'utf8');
const EMPTY = readFileSync(path.join(FIX, 'empty.txt'), 'utf8');

describe('parseSinfoNodes', () => {
  it('returns [] on empty input', () => {
    expect(parseSinfoNodes(EMPTY)).toEqual([]);
  });

  it('parses 10 nodes from the happy fixture', () => {
    const rows = parseSinfoNodes(HAPPY);
    expect(rows).toHaveLength(10);
    expect(rows.map((r) => r.node)).toEqual([
      'dgx001', 'dgx002', 'dgx003', 'dgx004', 'dgx005', 'dgx006', 'dgx007',
      'cpu001', 'cpu002', 'cpu003',
    ]);
  });

  it('normalizes base states to the small enum', () => {
    const rows = parseSinfoNodes(HAPPY);
    const byName = new Map(rows.map((r) => [r.node, r]));
    expect(byName.get('dgx001')!.state).toBe('mix');
    expect(byName.get('dgx002')!.state).toBe('alloc');
    expect(byName.get('dgx003')!.state).toBe('idle');
    expect(byName.get('dgx004')!.state).toBe('drain');
    expect(byName.get('dgx005')!.state).toBe('down');
    expect(byName.get('dgx006')!.state).toBe('mix');
    expect(byName.get('dgx007')!.state).toBe('idle');
    expect(byName.get('cpu002')!.state).toBe('maint');
    expect(byName.get('cpu003')!.state).toBe('resv');
  });

  it('splits modifier suffixes into the flag field', () => {
    const rows = parseSinfoNodes(HAPPY);
    const byName = new Map(rows.map((r) => [r.node, r]));
    // dgx005 came in as "down*" -> base=down, flag="*"
    expect(byName.get('dgx005')!.flag).toBe('*');
    // dgx006 came in as "mixed-" -> base=mixed, flag="-"
    expect(byName.get('dgx006')!.flag).toBe('-');
    // dgx007 came in as "idle~" -> base=idle, flag="~"
    expect(byName.get('dgx007')!.flag).toBe('~');
    // cpu002 came in as "maint$" -> base=maint, flag="$"
    expect(byName.get('cpu002')!.flag).toBe('$');
    // dgx003 came in as plain "idle" -> flag is null
    expect(byName.get('dgx003')!.flag).toBeNull();
  });

  it('extracts typed GPU info from GRES', () => {
    const rows = parseSinfoNodes(HAPPY);
    const dgx001 = rows.find((r) => r.node === 'dgx001')!;
    expect(dgx001.gpus).toEqual({ type: 'b200', total: 8 });
    const dgx006 = rows.find((r) => r.node === 'dgx006')!;
    expect(dgx006.gpus).toEqual({ type: 'b200_mig45_g', total: 32 });
  });

  it('handles "(null)" GRES as zero GPUs', () => {
    const rows = parseSinfoNodes(HAPPY);
    const cpu001 = rows.find((r) => r.node === 'cpu001')!;
    expect(cpu001.gpus).toEqual({ type: null, total: 0 });
  });

  it('parses CPU state as A/I/O/T', () => {
    const rows = parseSinfoNodes(HAPPY);
    const dgx001 = rows.find((r) => r.node === 'dgx001')!;
    expect(dgx001.cpus).toEqual({ alloc: 4, idle: 124, other: 0, total: 128 });
    const dgx002 = rows.find((r) => r.node === 'dgx002')!;
    expect(dgx002.cpus).toEqual({ alloc: 128, idle: 0, other: 0, total: 128 });
  });

  it('parses memory and load with N/A handling', () => {
    const rows = parseSinfoNodes(HAPPY);
    const dgx001 = rows.find((r) => r.node === 'dgx001')!;
    expect(dgx001.memMb).toBe(2031232);
    expect(dgx001.cpuLoad).toBeCloseTo(3.45);
    const dgx005 = rows.find((r) => r.node === 'dgx005')!;
    expect(dgx005.cpuLoad).toBeNull();
  });

  it('parses reason as null when "none" / "(null)" else as the string', () => {
    const rows = parseSinfoNodes(HAPPY);
    const dgx001 = rows.find((r) => r.node === 'dgx001')!;
    expect(dgx001.reason).toBeNull();
    const dgx004 = rows.find((r) => r.node === 'dgx004')!;
    expect(dgx004.reason).toBe('DiskSpace');
    const dgx005 = rows.find((r) => r.node === 'dgx005')!;
    expect(dgx005.reason).toBe('NotResponding');
  });

  it('does not throw on degraded input and keeps valid rows', () => {
    const rows = parseSinfoNodes(DEGRADED);
    // dgx001 line is valid -> kept. "short_line" dropped. ||||||| has 8 empty
    // cols but node is empty -> dropped. dgx002's CPU/mem/load are
    // unparseable -> cpus zeroed and memMb/cpuLoad null, but row kept.
    // dgx003 has empty reason -> reason null.
    const names = rows.map((r) => r.node);
    expect(names).toContain('dgx001');
    expect(names).toContain('dgx002');
    expect(names).toContain('dgx003');
    expect(names.length).toBe(3);
    const dgx002 = rows.find((r) => r.node === 'dgx002')!;
    expect(dgx002.cpus).toEqual({ alloc: 0, idle: 0, other: 0, total: 0 });
    expect(dgx002.memMb).toBeNull();
    expect(dgx002.cpuLoad).toBeNull();
  });

  it('survives CRLF line endings', () => {
    const crlf = HAPPY.replace(/\n/g, '\r\n');
    expect(parseSinfoNodes(crlf)).toHaveLength(10);
  });

  it('skips a sinfo header row if it ever sneaks in (route uses -h)', () => {
    const withHeader = 'NODELIST|PARTITION|STATE|GRES|CPUS(A/I/O/T)|MEMORY|CPU_LOAD|REASON\n' + HAPPY;
    const rows = parseSinfoNodes(withHeader);
    expect(rows).toHaveLength(10);
  });
});
