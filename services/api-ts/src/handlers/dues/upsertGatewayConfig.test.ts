import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { upsertGatewayConfig } from './upsertGatewayConfig';
import { DuesRepository } from './repos/dues.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeGateway = {
  id: 'gw-1',
  organizationId: 'org-1',
  provider: 'paymongo',
  publicKey: 'pk_test_1234567890',
  encryptedSecret: 'enc...',
  connected: true,
};

// ─── Tests ──────────────────────────────────────────────

describe('upsertGatewayConfig', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('creates new gateway config and returns 200', async () => {
    mocks = stubRepo(DuesRepository, {
      getGatewayConfig: async () => undefined,
    });

    // Stub the db.insert used directly in the handler
    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _body: {
        provider: 'paymongo',
        publicKey: 'pk_test_1234567890',
        secretKey: 'sk_test_1234567890_long_key',
      },
      database: {
        insert: () => ({ values: () => Promise.resolve() }),
        update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
      },
    });

    const response = await upsertGatewayConfig(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.connected).toBe(true);
    expect(response.body.data.provider).toBe('paymongo');
    expect(response.body.data.publicKeyLast4).toBe('7890');
  });

  test('updates existing gateway config', async () => {
    mocks = stubRepo(DuesRepository, {
      getGatewayConfig: async () => fakeGateway,
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _body: {
        provider: 'stripe',
        publicKey: 'pk_live_abcdefgh',
        secretKey: 'sk_live_abcdefgh_long_key',
      },
      database: {
        insert: () => ({ values: () => Promise.resolve() }),
        update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
      },
    });

    const response = await upsertGatewayConfig(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.provider).toBe('stripe');
    expect(response.body.data.publicKeyLast4).toBe('efgh');
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(DuesRepository, {
      getGatewayConfig: async () => undefined,
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { orgId: 'org-1' },
      _body: {
        provider: 'paymongo',
        publicKey: 'pk_test_1234567890',
        secretKey: 'sk_test_1234567890_long_key',
      },
    });

    // session.user.id is accessed for createdBy/updatedBy
    await expect(upsertGatewayConfig(ctx)).rejects.toThrow();
  });
});
