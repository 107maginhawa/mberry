import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SuppressionRepository } from './repos/suppression.repo';
import { generateUnsubToken } from './utils/unsub-token';

// Import after repo is set up to allow stubbing
import { unsubscribeEmail } from './unsubscribeEmail';

describe('unsubscribeEmail', () => {
  beforeEach(() => { restoreRepo(SuppressionRepository); });
  afterEach(() => { restoreRepo(SuppressionRepository); });

  const validEmail = 'user@example.com';
  const validOrgId = 'org-1';
  const validToken = generateUnsubToken(validEmail, validOrgId);

  test('returns 200 with HTML body for valid token', async () => {
    stubRepo(SuppressionRepository, {
      addSuppression: async () => undefined,
    });
    const ctx = makeCtx({
      user: null,
      session: null,
      _query: { token: validToken, email: validEmail, orgId: validOrgId },
    });
    const res = await unsubscribeEmail(ctx);
    expect(res.status).toBe(200);
  });

  test('returns 400 for invalid/tampered token', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _query: { token: 'tampered-invalid-token', email: validEmail, orgId: validOrgId },
    });
    const res = await unsubscribeEmail(ctx);
    expect(res.status).toBe(400);
  });

  test('returns 400 when email param is missing', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _query: { token: validToken, orgId: validOrgId },
    });
    const res = await unsubscribeEmail(ctx);
    expect(res.status).toBe(400);
  });

  test('returns 400 when token param is missing', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _query: { email: validEmail, orgId: validOrgId },
    });
    const res = await unsubscribeEmail(ctx);
    expect(res.status).toBe(400);
  });

  test('returns 400 when orgId param is missing', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _query: { token: validToken, email: validEmail },
    });
    const res = await unsubscribeEmail(ctx);
    expect(res.status).toBe(400);
  });

  test('calls addSuppression with correct args on valid request', async () => {
    let capturedArgs: any = null;
    stubRepo(SuppressionRepository, {
      addSuppression: async (data: any) => {
        capturedArgs = data;
        return undefined;
      },
    });
    const ctx = makeCtx({
      user: null,
      session: null,
      _query: { token: validToken, email: validEmail, orgId: validOrgId },
    });
    await unsubscribeEmail(ctx);
    expect(capturedArgs).not.toBeNull();
    expect(capturedArgs.email).toBe(validEmail);
    expect(capturedArgs.orgId).toBe(validOrgId);
    expect(capturedArgs.reason).toBe('unsubscribe');
  });
});
