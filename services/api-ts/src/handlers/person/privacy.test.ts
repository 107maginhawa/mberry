import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { getMyPrivacySettings as getPrivacySettings } from './getMyPrivacySettings';
import { updatePrivacySettings } from './updatePrivacySettings';

describe('getPrivacySettings', () => {
  test('throws UnauthorizedError without user', async () => {
    const ctx = makeCtx({ user: null });
    expect(getPrivacySettings(ctx)).rejects.toThrow('Unauthorized');
  });
});

describe('updatePrivacySettings', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null });
    const response = await updatePrivacySettings(ctx);
    expect(response.status).toBe(401);
  });

  test('throws ValidationError without orgId', async () => {
    const ctx = makeCtx({ _body: {} });
    await expect(updatePrivacySettings(ctx)).rejects.toThrow('organizationId is required');
  });
});
