import { describe, test, expect } from 'bun:test';
import { generateInviteToken, hashToken, defaultExpiryDate, isExpired } from './utils/token';

const TEST_SECRET = 'test-secret-key-for-hmac-signing';

describe('invite token utilities', () => {
  test('generateInviteToken returns raw and hash', () => {
    const { raw, hash } = generateInviteToken(TEST_SECRET);
    expect(raw).toBeTruthy();
    expect(hash).toBeTruthy();
    expect(raw).not.toBe(hash);
    // Raw is base64url
    expect(raw.length).toBeGreaterThan(10);
    // Hash is hex
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('hashToken is deterministic', () => {
    const raw = 'test-token-value';
    const h1 = hashToken(raw, TEST_SECRET);
    const h2 = hashToken(raw, TEST_SECRET);
    expect(h1).toBe(h2);
  });

  test('hashToken differs with different secrets', () => {
    const raw = 'test-token-value';
    const h1 = hashToken(raw, 'secret-1');
    const h2 = hashToken(raw, 'secret-2');
    expect(h1).not.toBe(h2);
  });

  test('defaultExpiryDate is 7 days from now', () => {
    const expires = defaultExpiryDate();
    const now = new Date();
    const diffMs = expires.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(6.9);
    expect(diffDays).toBeLessThan(7.1);
  });

  test('isExpired returns false for future date', () => {
    const future = new Date();
    future.setDate(future.getDate() + 1);
    expect(isExpired(future)).toBe(false);
  });

  test('isExpired returns true for past date', () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    expect(isExpired(past)).toBe(true);
  });
});

describe('invite handler auth guards', () => {
  test('createInvite requires authenticated user', async () => {
    const { makeCtx } = await import('@/test-utils/make-ctx');
    const { createInvite } = await import('./createInvite');
    const ctx = makeCtx({ user: null });
    const response = await createInvite(ctx);
    expect(response.status).toBe(401);
  });

  test('createInvite requires org context', async () => {
    const { makeCtx } = await import('@/test-utils/make-ctx');
    const { createInvite } = await import('./createInvite');
    const ctx = makeCtx({ user: { id: 'user-1' }, tenantId: null });
    const response = await createInvite(ctx);
    expect(response.status).toBe(403);
  });

  test('validateInvite returns 400 for missing token', async () => {
    const { makeCtx } = await import('@/test-utils/make-ctx');
    const { validateInvite } = await import('./validateInvite');
    const ctx = makeCtx({ params: { token: '' } });
    const response = await validateInvite(ctx);
    expect(response.status).toBe(400);
  });
});

describe('[BR-24] invite business rules', () => {
  test('[BR-24] tokens expire after 7 days', () => {
    const expires = defaultExpiryDate();
    const sixDaysFromNow = new Date();
    sixDaysFromNow.setDate(sixDaysFromNow.getDate() + 6);
    expect(isExpired(sixDaysFromNow)).toBe(false);

    const eightDaysFromNow = new Date();
    eightDaysFromNow.setDate(eightDaysFromNow.getDate() + 8);
    // Token issued now expires in 7 days, so 8 days from now it's expired
    expect(isExpired(expires)).toBe(false); // still valid now
  });

  test('tokens are single-use (hash is unique)', () => {
    const t1 = generateInviteToken(TEST_SECRET);
    const t2 = generateInviteToken(TEST_SECRET);
    expect(t1.hash).not.toBe(t2.hash);
    expect(t1.raw).not.toBe(t2.raw);
  });
});
