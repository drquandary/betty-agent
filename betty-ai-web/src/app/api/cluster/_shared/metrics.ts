/**
 * Shared metrics helpers for the cluster monitoring routes (Wave 2D).
 *
 * Two responsibilities:
 *
 *   1. sanitizeSeriesPart - coerce arbitrary labels (partition names,
 *      pending-reason strings, etc.) into the `^[a-zA-Z0-9._-]+$` shape that
 *      metrics-store requires for series filenames. Non-conforming chars
 *      collapse to `_`, leading/trailing underscores are trimmed, and the
 *      result is truncated to maxLen (default 32). Empty input yields the
 *      sentinel `unknown` so the caller never produces an invalid series.
 *
 *   2. safeAppend - wraps appendMetrics in try/catch plus a skip-non-finite
 *      filter so a metrics-write failure can never break a route response.
 *      Best-effort by design; the dashboard tolerates gaps in the ringbuffer.
 */

import { appendMetrics, type MetricPoint } from '@/lib/metrics-store';

const VALID_PART = /^[a-zA-Z0-9._-]+$/;

/**
 * Sanitize one component of a metric series name.
 *
 *   - Lowercase.
 *   - Collapse any run of non-`[a-zA-Z0-9._-]` chars into a single `_`.
 *   - Trim leading/trailing `_`.
 *   - Truncate to maxLen (default 32).
 *
 * If the sanitized result is empty (input was all garbage), returns the
 * sentinel `unknown` so the caller can still construct a valid series name.
 */
export function sanitizeSeriesPart(s: string, maxLen = 32): string {
  if (typeof s !== 'string') return 'unknown';
  let cleaned = s.toLowerCase().replace(/[^a-z0-9._-]+/g, '_');
  cleaned = cleaned.replace(/^_+|_+$/g, '');
  if (cleaned.length === 0) return 'unknown';
  if (cleaned.length > maxLen) cleaned = cleaned.slice(0, maxLen);
  cleaned = cleaned.replace(/[_.-]+$/g, '');
  if (cleaned.length === 0) return 'unknown';
  return VALID_PART.test(cleaned) ? cleaned : 'unknown';
}

/**
 * Append a batch of metric points to the ringbuffer. Never throws.
 *
 * Filters out points whose value is non-finite (null / undefined / NaN) so
 * the caller can pass `{value: parser.foo ?? null}` without a pre-check.
 * Returns nothing - the response we're attached to does not depend on the
 * outcome of the write.
 */
export function safeAppend(points: MetricPoint[]): void {
  if (!Array.isArray(points) || points.length === 0) return;
  const filtered = points.filter((p) => {
    if (!p) return false;
    const v = p.value as unknown;
    return typeof v === 'number' && Number.isFinite(v);
  });
  if (filtered.length === 0) return;
  try {
    appendMetrics(filtered);
  } catch {
    // Best-effort: a metrics-write failure must never break the response.
  }
}
