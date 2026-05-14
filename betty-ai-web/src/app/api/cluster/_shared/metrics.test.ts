import { beforeEach, describe, expect, it, vi } from 'vitest';

const appendMetrics = vi.fn();

vi.mock('@/lib/metrics-store', () => ({
  appendMetrics: (...args: unknown[]) => appendMetrics(...args),
}));

import { sanitizeSeriesPart, safeAppend } from './metrics';

beforeEach(() => {
  appendMetrics.mockReset();
});

describe('sanitizeSeriesPart', () => {
  it('passes simple alphanumerics through unchanged (lowercased)', () => {
    expect(sanitizeSeriesPart('dgx-b200')).toBe('dgx-b200');
    expect(sanitizeSeriesPart('Compute')).toBe('compute');
  });

  it('replaces spaces and parens with underscore', () => {
    expect(sanitizeSeriesPart('Job Held (Hold)')).toBe('job_held_hold');
  });

  it('collapses runs of disallowed characters into a single underscore', () => {
    expect(sanitizeSeriesPart('foo!!!bar###baz')).toBe('foo_bar_baz');
  });

  it('trims leading and trailing underscores', () => {
    expect(sanitizeSeriesPart('___edge___')).toBe('edge');
    expect(sanitizeSeriesPart('   spaced   ')).toBe('spaced');
  });

  it('truncates to default 32 chars', () => {
    const input = 'a'.repeat(50);
    expect(sanitizeSeriesPart(input).length).toBe(32);
  });

  it('respects a custom maxLen', () => {
    expect(sanitizeSeriesPart('abcdef', 3)).toBe('abc');
  });

  it('returns the sentinel `unknown` for empty / all-garbage input', () => {
    expect(sanitizeSeriesPart('')).toBe('unknown');
    expect(sanitizeSeriesPart('!!!')).toBe('unknown');
    expect(sanitizeSeriesPart('___')).toBe('unknown');
  });

  it('keeps allowed punctuation - dot, underscore, hyphen', () => {
    expect(sanitizeSeriesPart('a.b_c-d')).toBe('a.b_c-d');
  });

  it('emits names that match the metrics-store regex', () => {
    const re = /^[a-zA-Z0-9._-]+$/;
    expect(re.test(sanitizeSeriesPart('Resources'))).toBe(true);
    expect(re.test(sanitizeSeriesPart('QOSMaxJobsPerUserLimit'))).toBe(true);
    expect(re.test(sanitizeSeriesPart('Held by user (something)'))).toBe(true);
    expect(re.test(sanitizeSeriesPart('!!!'))).toBe(true);
  });

  it('handles non-string input by falling back to unknown', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeSeriesPart(undefined as any)).toBe('unknown');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeSeriesPart(null as any)).toBe('unknown');
  });
});

describe('safeAppend', () => {
  it('calls appendMetrics with filtered points', () => {
    safeAppend([
      { ts: 1, series: 'a', value: 10 },
      { ts: 2, series: 'a', value: 20 },
    ]);
    expect(appendMetrics).toHaveBeenCalledTimes(1);
    expect(appendMetrics.mock.calls[0][0]).toHaveLength(2);
  });

  it('drops points with non-finite values (NaN / Infinity)', () => {
    safeAppend([
      { ts: 1, series: 'a', value: Number.NaN },
      { ts: 2, series: 'a', value: Number.POSITIVE_INFINITY },
      { ts: 3, series: 'a', value: 5 },
    ]);
    expect(appendMetrics).toHaveBeenCalledTimes(1);
    expect(appendMetrics.mock.calls[0][0]).toEqual([
      { ts: 3, series: 'a', value: 5 },
    ]);
  });

  it('skips the call entirely when no valid points remain', () => {
    safeAppend([{ ts: 1, series: 'a', value: Number.NaN }]);
    expect(appendMetrics).not.toHaveBeenCalled();
  });

  it('handles an empty array without throwing', () => {
    expect(() => safeAppend([])).not.toThrow();
    expect(appendMetrics).not.toHaveBeenCalled();
  });

  it('never throws when appendMetrics throws', () => {
    appendMetrics.mockImplementation(() => {
      throw new Error('disk full');
    });
    expect(() =>
      safeAppend([{ ts: 1, series: 'a', value: 1 }]),
    ).not.toThrow();
  });
});
