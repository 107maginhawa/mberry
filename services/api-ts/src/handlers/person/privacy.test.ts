import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { getPrivacySettings } from './getPrivacySettings';
import { updatePrivacySettings } from './updatePrivacySettings';

describe('getPrivacySettings', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null });
    const response = await getPrivacySettings(ctx);
    expect(response.status).toBe(401);
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
    await expect(updatePrivacySettings(ctx)).rejects.toThrow('orgId is required');
  });
});
