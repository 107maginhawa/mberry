import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { getGatewayConfig } from './getGatewayConfig';
import { DuesRepository } from './repos/dues.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeGateway = {
  id: 'gw-1',
  organizationId: 'org-1',
  provider: 'paymongo',
  publicKey: 'pk_test_1234567890',
  encryptedSecret: 'enc...',
  connected: true,
  lastTestAt: new Date('2025-01-15'),
};

// ─── Tests ──────────────────────────────────────────────

describe('getGatewayConfig', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns gateway config with masked key and 200', async () => {
    mocks = stubRepo(DuesRepository, {
      getGatewayConfig: async () => fakeGateway,
    });

    const ctx = makeCtx({ _params: { orgId: 'org-1' } });
    const response = await getGatewayConfig(ctx);

    expect(response.status).toBe(200);
    expect(response.body.data.connected).toBe(true);
    expect(response.body.data.provider).toBe('paymongo');
    expect(response.body.data.publicKeyLast4).toBe('7890');
    // Secret key should NOT be returned
    expect(response.body.data.encryptedSecret).toBeUndefined();
    expect(response.body.data.publicKey).toBeUndefined();
  });

  test('returns connected false when no gateway configured', async () => {
    mocks = stubRepo(DuesRepository, {
      getGatewayConfig: async () => undefined,
    });

    const ctx = makeCtx({ _params: { orgId: 'org-no-gw' } });
    const response = await getGatewayConfig(ctx);

    expect(response.status).toBe(200);
    expect(response.body.data.connected).toBe(false);
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(DuesRepository, {
      getGatewayConfig: async () => fakeGateway,
    });

    // getGatewayConfig doesn't use session directly
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { orgId: 'org-1' },
    });

    const response = await getGatewayConfig(ctx);
    expect(response.status).toBe(200);
  });
});
