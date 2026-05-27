import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { getMyNotificationPreferences } from './getMyNotificationPreferences';
import { updateNotificationPreferences } from './updateNotificationPreferences';

describe('getMyNotificationPreferences', () => {
  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ user: null });
    await expect(getMyNotificationPreferences(ctx)).rejects.toThrow();
  });
});

describe('updateNotificationPreferences', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null });
    const response = await updateNotificationPreferences(ctx);
    expect(response.status).toBe(401);
  });

  test('throws ValidationError without category', async () => {
    const ctx = makeCtx({ _body: {} });
    await expect(updateNotificationPreferences(ctx)).rejects.toThrow('category is required');
  });

  test('throws ValidationError for invalid category', async () => {
    const ctx = makeCtx({ _body: { category: 'invalid' } });
    await expect(updateNotificationPreferences(ctx)).rejects.toThrow('Invalid category');
  });
});
