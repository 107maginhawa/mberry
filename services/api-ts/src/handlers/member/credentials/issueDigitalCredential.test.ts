// Business Rules: [BR-19] — credential issuance gated on active membership
// FIX-008 (Batch D): per-handler unit suite for the trust-critical issue path.
import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { issueDigitalCredential } from './issueDigitalCredential';
import {
  CredentialTemplateRepository,
  DigitalCredentialRepository,
} from '@/handlers/association:member/repos/credentials.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { verifyCredentialToken, resolveCredentialVerifySecret } from '@/handlers/association:member/utils/credential-token';

const activeMembership = {
  id: 'm1',
  personId: 'p1',
  organizationId: 'tenant-1',
  duesExpiryDate: '2999-01-01',
  gracePeriodDays: 30,
  suspendedAt: null,
  removedAt: null,
};

const lapsedMembership = {
  ...activeMembership,
  duesExpiryDate: '2000-01-01', // long past + grace → not active
};

afterEach(() => {
  restoreRepo(MembershipRepository);
  restoreRepo(CredentialTemplateRepository);
  restoreRepo(DigitalCredentialRepository);
});

describe('issueDigitalCredential', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _body: { personId: 'p1', templateId: 't1', credentialNumber: 'CN-001' } });
    const res = await issueDigitalCredential(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 without organizationId', async () => {
    const ctx = makeCtx({ organizationId: null, _body: { personId: 'p1', templateId: 't1', credentialNumber: 'CN-001' } });
    const res = await issueDigitalCredential(ctx);
    expect(res.status).toBe(403);
  });

  test('throws Forbidden when person has no membership in org', async () => {
    stubRepo(MembershipRepository, { findByPersonAndOrg: async () => null });
    const ctx = makeCtx({ _body: { personId: 'p1', templateId: 't1', credentialNumber: 'CN-001' } });
    await expect(issueDigitalCredential(ctx)).rejects.toThrow(/no membership/i);
  });

  test('throws Forbidden when membership is not active (lapsed dues)', async () => {
    stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ ...lapsedMembership }) });
    const ctx = makeCtx({ _body: { personId: 'p1', templateId: 't1', credentialNumber: 'CN-001' } });
    await expect(issueDigitalCredential(ctx)).rejects.toThrow(/Only active memberships/i);
  });

  test('throws NotFound when membershipId given but membership missing', async () => {
    stubRepo(MembershipRepository, { findOneById: async () => null });
    const ctx = makeCtx({ _body: { personId: 'p1', templateId: 't1', credentialNumber: 'CN-001', membershipId: 'm-missing' } });
    await expect(issueDigitalCredential(ctx)).rejects.toThrow(/Membership/i);
  });

  test('throws NotFound when credential template missing', async () => {
    stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ ...activeMembership }) });
    stubRepo(CredentialTemplateRepository, { findOneById: async () => null });
    const ctx = makeCtx({ _body: { personId: 'p1', templateId: 't-missing', credentialNumber: 'CN-001' } });
    await expect(issueDigitalCredential(ctx)).rejects.toThrow(/template/i);
  });

  test('issues active credential with a verifiable HMAC token on happy path', async () => {
    stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ ...activeMembership }) });
    stubRepo(CredentialTemplateRepository, { findOneById: async () => ({ id: 't1', validityPeriod: 365 }) });
    let createdArgs: any = null;
    stubRepo(DigitalCredentialRepository, {
      createOne: async (args: any) => { createdArgs = args; return { id: 'cred-1', ...args }; },
      updateOneById: async (_id: string, patch: any) => ({ id: 'cred-1', ...createdArgs, ...patch }),
    });

    const ctx = makeCtx({ _body: { personId: 'p1', templateId: 't1', credentialNumber: 'CN-001' } });
    const res = await issueDigitalCredential(ctx) as any;

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('active');
    expect(res.body.credentialNumber).toBe('CN-001');
    expect(res.body.expiresAt).toBeInstanceOf(Date);
    // token is a real, verifiable HMAC token bound to the new credential id + org
    expect(typeof res.body.qrPayload).toBe('string');
    const payload = verifyCredentialToken(res.body.qrPayload, resolveCredentialVerifySecret());
    expect(payload).not.toBeNull();
    expect(payload!.credentialId).toBe('cred-1');
    expect(payload!.organizationId).toBe('tenant-1');
    expect(res.body.verificationUrl).toContain('/public-verify');
  });

  test('omits expiresAt when template has no validity period', async () => {
    stubRepo(MembershipRepository, { findByPersonAndOrg: async () => ({ ...activeMembership }) });
    stubRepo(CredentialTemplateRepository, { findOneById: async () => ({ id: 't1', validityPeriod: null }) });
    stubRepo(DigitalCredentialRepository, {
      createOne: async (args: any) => ({ id: 'cred-2', ...args }),
      updateOneById: async (_id: string, patch: any) => ({ id: 'cred-2', expiresAt: null, ...patch }),
    });
    const ctx = makeCtx({ _body: { personId: 'p1', templateId: 't1', credentialNumber: 'CN-002' } });
    const res = await issueDigitalCredential(ctx) as any;
    expect(res.status).toBe(201);
    expect(res.body.expiresAt).toBeNull();
  });
});
