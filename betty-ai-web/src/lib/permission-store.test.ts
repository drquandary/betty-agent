import { afterEach, describe, expect, it } from 'vitest';
import {
  __clearPendingPermissions,
  cancelPendingPermission,
  registerPendingPermission,
  resolvePendingPermission,
} from './permission-store';

afterEach(() => __clearPendingPermissions());

describe('permission-store', () => {
  it('resolves a registered permission with an allow decision', async () => {
    const p = registerPendingPermission('abc', 10_000);
    const ok = resolvePendingPermission('abc', { behavior: 'allow' });
    expect(ok).toBe(true);
    await expect(p).resolves.toEqual({ behavior: 'allow' });
  });

  it('resolves with deny when cancelled', async () => {
    const p = registerPendingPermission('xyz', 10_000);
    cancelPendingPermission('xyz', 'gone');
    await expect(p).resolves.toEqual({ behavior: 'deny', message: 'gone' });
  });

  it('returns false when resolving an unknown id', () => {
    expect(resolvePendingPermission('nope', { behavior: 'allow' })).toBe(false);
  });

  it('times out to deny', async () => {
    const p = registerPendingPermission('tmo', 10);
    await expect(p).resolves.toEqual({
      behavior: 'deny',
      message: expect.stringMatching(/timed out/i),
    });
  });
});
