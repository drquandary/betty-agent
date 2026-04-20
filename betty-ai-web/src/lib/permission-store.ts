/**
 * In-memory store of pending tool-permission promises.
 *
 * The chat stream hands off control to the client when a tier-1/2 tool is
 * requested: it emits a `tool_permission` SSE frame and parks a promise here
 * keyed by a unique id. The client's Approve/Deny card posts back to
 * `PUT /api/chat` (handled by route.ts) which calls `resolvePendingPermission`.
 *
 * Scope: single-process only. If we ever scale to multiple server instances,
 * this becomes a Redis / durable queue.
 */

import type { PermissionDecision } from '@/agent/server';
// Using `import type` so no runtime cycle exists with agent/server.ts.

interface PendingEntry {
  resolve: (decision: PermissionDecision) => void;
  timer: NodeJS.Timeout;
}

const pending = new Map<string, PendingEntry>();

/**
 * Register a new pending permission request. Returns a promise that resolves
 * when the user's decision arrives via `resolvePendingPermission`. If the
 * timeout fires first, resolves as `deny`.
 */
export function registerPendingPermission(
  id: string,
  timeoutMs: number,
): Promise<PermissionDecision> {
  return new Promise<PermissionDecision>((resolve) => {
    const timer = setTimeout(() => {
      if (pending.delete(id)) {
        resolve({
          behavior: 'deny',
          message: `Permission request ${id} timed out after ${timeoutMs}ms.`,
        });
      }
    }, timeoutMs);
    // Node timers have `.unref` — don't keep the process alive for these.
    if (typeof (timer as { unref?: () => void }).unref === 'function') {
      (timer as { unref: () => void }).unref();
    }
    pending.set(id, { resolve, timer });
  });
}

/** Resolve a pending permission with a decision. Returns false if id unknown. */
export function resolvePendingPermission(
  id: string,
  decision: PermissionDecision,
): boolean {
  const entry = pending.get(id);
  if (!entry) return false;
  clearTimeout(entry.timer);
  pending.delete(id);
  entry.resolve(decision);
  return true;
}

/** Cancel (deny) a pending permission — used when the stream aborts. */
export function cancelPendingPermission(id: string, message: string): boolean {
  return resolvePendingPermission(id, { behavior: 'deny', message });
}

/** Test helper — clear all pending entries. */
export function __clearPendingPermissions(): void {
  for (const { timer } of pending.values()) clearTimeout(timer);
  pending.clear();
}
