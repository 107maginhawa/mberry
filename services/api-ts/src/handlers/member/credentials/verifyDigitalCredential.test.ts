// Business Rules: [BR-18] — credential verification status mapping
// FIX-008 (Batch D): verify status-mapping suite for BOTH public (no-auth) and
// authenticated verify surfaces. Public/authenticated share identical mapping;
// the public surface must be reachable WITHOUT a session, the authenticated one
// must reject when there is no session.
import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { verifyCredentialPublic } from './verifyCredentialPublic';
import { verifyDigitalCredentialAuthenticated } from './verifyDigitalCredentialAuthenticated';
import { DigitalCredentialRepository } from '@/handlers/association:member/repos/credentials.repo';
import { createCredentialToken, resolveCredentialVerifySecret } from '@/handlers/association:member/utils/credential-token';

// The guessable dev literal that resolveCredentialVerifySecret() falls back to
// outside production. In production with the secret unset it must NOT be used.
const GUESSABLE_DEV_SECRET = 'dev-credential-verify-secret';

// Both surfaces resolve the same dev secret outside production, so a token minted
// with resolveCredentialVerifySecret() validates against either handler in tests.
const secret = resolveCredentialVerifySecret();
const tokenFor = (credId: string) => createCredentialToken(credId, 'tenant-1', secret);

afterEach(() => restoreRepo(DigitalCredentialRepository));

describe('verifyCredentialPublic (no auth)', () => {
  test('is reachable WITHOUT a session and returns 200', async () => {
    const ctx = makeCtx({ session: null, user: null, _body: { token: 'garbage' } });
    const res = await verifyCredentialPublic(ctx) as any;
    expect(res.status).toBe(200);
  });

  test('returns notFound for a tampered/invalid token', async () => {
    const ctx = makeCtx({ session: null, user: null, _body: { token: 'not.a.real.token' } });
    const res = await verifyCredentialPublic(ctx) as any;
    expect(res.body.result).toBe('notFound');
    expect(res.body.credential).toBeNull();
  });

  test('returns notFound when token is valid but credential is gone', async () => {
    stubRepo(DigitalCredentialRepository, { findOneById: async () => null });
    const ctx = makeCtx({ session: null, user: null, _body: { token: tokenFor('c-gone') } });
    const res = await verifyCredentialPublic(ctx) as any;
    expect(res.body.result).toBe('notFound');
  });

  test('maps active credential → valid', async () => {
    stubRepo(DigitalCredentialRepository, {
      findOneById: async () => ({ id: 'c1', status: 'active', expiresAt: null }),
    });
    const ctx = makeCtx({ session: null, user: null, _body: { token: tokenFor('c1') } });
    const res = await verifyCredentialPublic(ctx) as any;
    expect(res.body.result).toBe('valid');
    expect(res.body.credential.id).toBe('c1');
  });

  test('maps revoked credential → revoked', async () => {
    stubRepo(DigitalCredentialRepository, {
      findOneById: async () => ({ id: 'c1', status: 'revoked', expiresAt: null }),
    });
    const ctx = makeCtx({ session: null, user: null, _body: { token: tokenFor('c1') } });
    const res = await verifyCredentialPublic(ctx) as any;
    expect(res.body.result).toBe('revoked');
  });

  test('maps expired status → expired', async () => {
    stubRepo(DigitalCredentialRepository, {
      findOneById: async () => ({ id: 'c1', status: 'expired', expiresAt: null }),
    });
    const ctx = makeCtx({ session: null, user: null, _body: { token: tokenFor('c1') } });
    const res = await verifyCredentialPublic(ctx) as any;
    expect(res.body.result).toBe('expired');
  });

  test('maps active-but-past-expiry date → expired', async () => {
    stubRepo(DigitalCredentialRepository, {
      findOneById: async () => ({ id: 'c1', status: 'active', expiresAt: new Date('2000-01-01') }),
    });
    const ctx = makeCtx({ session: null, user: null, _body: { token: tokenFor('c1') } });
    const res = await verifyCredentialPublic(ctx) as any;
    expect(res.body.result).toBe('expired');
  });

  test('maps suspended (non-active) status → revoked (fail-safe default)', async () => {
    stubRepo(DigitalCredentialRepository, {
      findOneById: async () => ({ id: 'c1', status: 'suspended', expiresAt: null }),
    });
    const ctx = makeCtx({ session: null, user: null, _body: { token: tokenFor('c1') } });
    const res = await verifyCredentialPublic(ctx) as any;
    expect(res.body.result).toBe('revoked');
  });
});

describe('verifyDigitalCredentialAuthenticated', () => {
  test('throws UnauthorizedError without a session', async () => {
    const ctx = makeCtx({ session: null, _body: { token: tokenFor('c1') } });
    await expect(verifyDigitalCredentialAuthenticated(ctx)).rejects.toThrow();
  });

  test('maps active credential → valid for an authenticated caller', async () => {
    stubRepo(DigitalCredentialRepository, {
      findOneById: async () => ({ id: 'c1', status: 'active', expiresAt: null }),
    });
    const ctx = makeCtx({ _body: { token: tokenFor('c1') } });
    const res = await verifyDigitalCredentialAuthenticated(ctx) as any;
    expect(res.status).toBe(200);
    expect(res.body.result).toBe('valid');
  });

  test('returns notFound for an invalid token', async () => {
    const ctx = makeCtx({ _body: { token: 'bad.token' } });
    const res = await verifyDigitalCredentialAuthenticated(ctx) as any;
    expect(res.body.result).toBe('notFound');
  });

  // FIX-012 follow-up: fail closed. In production with CREDENTIAL_VERIFY_SECRET
  // unset, the handler must NOT validate a token forged with the guessable dev
  // literal — it must refuse (notFound) rather than fall back to the literal.
  test('in production with the verify secret unset, refuses a token forged with the guessable literal', async () => {
    const prevNodeEnv = process.env['NODE_ENV'];
    const prevSecret = process.env['CREDENTIAL_VERIFY_SECRET'];
    try {
      process.env['NODE_ENV'] = 'production';
      delete process.env['CREDENTIAL_VERIFY_SECRET'];

      // A token an attacker mints with the guessable fallback literal.
      const forged = createCredentialToken('c1', 'tenant-1', GUESSABLE_DEV_SECRET);
      stubRepo(DigitalCredentialRepository, {
        findOneById: async () => ({ id: 'c1', status: 'active', expiresAt: null }),
      });
      const ctx = makeCtx({ _body: { token: forged } });
      const res = await verifyDigitalCredentialAuthenticated(ctx) as any;

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('notFound');
      expect(res.body.credential).toBeNull();
    } finally {
      if (prevNodeEnv === undefined) delete process.env['NODE_ENV'];
      else process.env['NODE_ENV'] = prevNodeEnv;
      if (prevSecret === undefined) delete process.env['CREDENTIAL_VERIFY_SECRET'];
      else process.env['CREDENTIAL_VERIFY_SECRET'] = prevSecret;
    }
  });
});
