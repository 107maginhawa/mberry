import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { getAdminRole } from './getAdminRole';
import { ForbiddenError } from '@/core/errors';

describe('getAdminRole', () => {
  test('returns 200 with role/email/name when platformAdmin is set', async () => {
    const ctx = makeCtx({ platformAdmin: { role: 'super', email: 'admin@example.com', name: 'Super Admin' } });
    const res = await getAdminRole(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.role).toBe('super');
    expect((res as any).body?.email).toBe('admin@example.com');
  });

  test('throws ForbiddenError when platformAdmin is not set', async () => {
    const ctx = makeCtx({ platformAdmin: null });
    await expect(getAdminRole(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('returns support role correctly', async () => {
    const ctx = makeCtx({ platformAdmin: { role: 'support', email: 's@example.com', name: 'Support' } });
    const res = await getAdminRole(ctx);
    expect((res as any).body?.role).toBe('support');
  });
});
