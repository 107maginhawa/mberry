/**
 * testDuesGatewayConnection.test.ts
 *
 * Covers:
 *  - Throws UnauthorizedError when no session
 *  - No gateway configured → 200 { success:false, message:'No gateway configured', testedAt }
 *  - Valid credentials → 200 { success:true, testedAt } + row updated connected:true
 *  - Invalid credentials → 200 { success:false, testedAt } + row updated connected:false
 *  - Network error from adapter → 502 { success:false, testedAt } (no row update)
 *  - testedAt is present on every response (satisfies GatewayTestResult shape)
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { encryptCredential } from '@/core/gateway';
import { testDuesGatewayConnection } from './testDuesGatewayConnection';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import { PayMongoAdapter } from '@/handlers/association:member/utils/paymongo.adapter';

const ENCRYPTION_SECRET = 'test-encryption-secret-32plus-chars-min!!!';
const PLAINTEXT_SECRET = 'sk_test_valid_key_for_paymongo';

// Build a realistic fake gateway row with a real encrypted secret
function makeFakeGateway(orgId = 'org-1') {
  return {
    id: 'gw-1',
    organizationId: orgId,
    provider: 'paymongo',
    publicKey: 'pk_test_abc',
    encryptedSecret: encryptCredential(PLAINTEXT_SECRET, ENCRYPTION_SECRET),
    encryptedWebhookSecret: null,
    connected: true,
    lastTestAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    createdBy: null,
    updatedBy: null,
  };
}

function makeConfig() {
  return { auth: { secret: ENCRYPTION_SECRET } };
}

describe('testDuesGatewayConnection', () => {
  // Save / restore the static verifyCredentials mock between tests
  let originalVerify: typeof PayMongoAdapter.verifyCredentials;

  beforeEach(() => {
    restoreRepo(DuesRepository);
    originalVerify = PayMongoAdapter.verifyCredentials;
  });
  afterEach(() => {
    restoreRepo(DuesRepository);
    PayMongoAdapter.verifyCredentials = originalVerify;
  });

  test('throws UnauthorizedError when session is null', async () => {
    const ctx = makeCtx({ session: null, user: null });
    await expect(testDuesGatewayConnection(ctx as any)).rejects.toThrow();
  });

  test('no gateway configured → success:false + testedAt (not a 500)', async () => {
    stubRepo(DuesRepository, {
      getGatewayConfig: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      config: makeConfig(),
    });
    const res = await testDuesGatewayConnection(ctx as any);

    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.success).toBe(false);
    expect(body.message).toBe('No gateway configured');
    expect(typeof body.testedAt).toBe('string'); // GatewayTestResult.testedAt required
  });

  test('valid credentials → success:true + testedAt + row updated connected:true', async () => {
    const fakeGw = makeFakeGateway();
    let updatedWith: { connected: boolean; lastTestAt: Date } | null = null;

    stubRepo(DuesRepository, {
      getGatewayConfig: async () => fakeGw,
      updateGatewayConfig: async (_orgId: string, patch: any) => { updatedWith = patch; },
    });

    // Mock the static verifyCredentials to return true (valid key)
    PayMongoAdapter.verifyCredentials = async () => true;

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      config: makeConfig(),
    });
    const res = await testDuesGatewayConnection(ctx as any);

    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.success).toBe(true);
    expect(typeof body.testedAt).toBe('string');
    // Row must be updated
    expect(updatedWith).not.toBeNull();
    expect(updatedWith!.connected).toBe(true);
    expect(updatedWith!.lastTestAt).toBeInstanceOf(Date);
  });

  test('invalid credentials → success:false + testedAt + row updated connected:false', async () => {
    const fakeGw = makeFakeGateway();
    let updatedWith: { connected: boolean; lastTestAt: Date } | null = null;

    stubRepo(DuesRepository, {
      getGatewayConfig: async () => fakeGw,
      updateGatewayConfig: async (_orgId: string, patch: any) => { updatedWith = patch; },
    });

    // Mock verifyCredentials to return false (bad key — 401/403)
    PayMongoAdapter.verifyCredentials = async () => false;

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      config: makeConfig(),
    });
    const res = await testDuesGatewayConnection(ctx as any);

    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.success).toBe(false);
    expect(typeof body.testedAt).toBe('string');
    // Row must be updated with connected:false
    expect(updatedWith).not.toBeNull();
    expect(updatedWith!.connected).toBe(false);
    expect(updatedWith!.lastTestAt).toBeInstanceOf(Date);
  });

  test('network error → 502 success:false + testedAt (row NOT updated)', async () => {
    const fakeGw = makeFakeGateway();
    let updateCalled = false;

    stubRepo(DuesRepository, {
      getGatewayConfig: async () => fakeGw,
      updateGatewayConfig: async () => { updateCalled = true; },
    });

    // Mock verifyCredentials to throw (network failure)
    PayMongoAdapter.verifyCredentials = async () => { throw new Error('fetch failed'); };

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      config: makeConfig(),
    });
    const res = await testDuesGatewayConnection(ctx as any);

    expect(res.status).toBe(502);
    const body = (res as any).body;
    expect(body.success).toBe(false);
    expect(typeof body.testedAt).toBe('string');
    // Row must NOT be updated on network errors
    expect(updateCalled).toBe(false);
  });

  test('success field is always a boolean (not a string)', async () => {
    stubRepo(DuesRepository, {
      getGatewayConfig: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      config: makeConfig(),
    });
    const res = await testDuesGatewayConnection(ctx as any);
    const body = (res as any).body;
    expect(typeof body.success).toBe('boolean');
  });

  test('uses organizationId from path param to fetch config', async () => {
    let capturedOrgId: string | undefined;
    stubRepo(DuesRepository, {
      getGatewayConfig: async (orgId: string) => {
        capturedOrgId = orgId;
        return undefined; // no config → early return, no adapter call needed
      },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-specific' },
      config: makeConfig(),
    });
    await testDuesGatewayConnection(ctx as any);
    expect(capturedOrgId).toBe('org-specific');
  });
});
