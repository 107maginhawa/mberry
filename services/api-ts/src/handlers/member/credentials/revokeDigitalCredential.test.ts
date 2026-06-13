// FIX-008 (Batch D): per-handler unit suite for credential revocation (trust-critical).
import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { revokeDigitalCredential } from './revokeDigitalCredential';
import { DigitalCredentialRepository } from '@/handlers/association:member/repos/credentials.repo';

afterEach(() => restoreRepo(DigitalCredentialRepository));

describe('revokeDigitalCredential', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _params: { credentialId: 'c1' }, _body: { reason: 'Fraud' } });
    const res = await revokeDigitalCredential(ctx);
    expect(res.status).toBe(401);
  });

  test('throws NotFound when credential does not exist', async () => {
    stubRepo(DigitalCredentialRepository, { findOneById: async () => null });
    const ctx = makeCtx({ _params: { credentialId: 'missing' }, _body: { reason: 'Fraud' } });
    await expect(revokeDigitalCredential(ctx)).rejects.toThrow(/Digital credential/i);
  });

  test('throws when credential is already revoked (idempotency guard)', async () => {
    stubRepo(DigitalCredentialRepository, {
      findOneById: async () => ({ id: 'c1', status: 'revoked' }),
    });
    const ctx = makeCtx({ _params: { credentialId: 'c1' }, _body: { reason: 'Fraud' } });
    await expect(revokeDigitalCredential(ctx)).rejects.toThrow(/already revoked/i);
  });

  test('sets status=revoked, records reason + revokedAt on happy path', async () => {
    let patch: any = null;
    stubRepo(DigitalCredentialRepository, {
      findOneById: async () => ({ id: 'c1', status: 'active' }),
      updateOneById: async (_id: string, p: any) => { patch = p; return { id: 'c1', ...p }; },
    });
    const ctx = makeCtx({ _params: { credentialId: 'c1' }, _body: { reason: 'Expired membership' } });
    const res = await revokeDigitalCredential(ctx) as any;

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('revoked');
    expect(res.body.revocationReason).toBe('Expired membership');
    expect(patch.revokedAt).toBeInstanceOf(Date);
  });
});
