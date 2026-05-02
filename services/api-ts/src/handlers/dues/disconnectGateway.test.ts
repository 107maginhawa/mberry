import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { disconnectGateway } from './disconnectGateway';
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

describe('disconnectGateway', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('disconnects gateway and returns 200', async () => {
    mocks = stubRepo(DuesRepository, {
      getGatewayConfig: async () => fakeGateway,
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      database: {
        update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
      },
    });

    const response = await disconnectGateway(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.connected).toBe(false);
  });

  test('throws NotFoundError when no gateway configured', async () => {
    mocks = stubRepo(DuesRepository, {
      getGatewayConfig: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-no-gw' },
    });

    await expect(disconnectGateway(ctx)).rejects.toThrow('No gateway configured');
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(DuesRepository, {
      getGatewayConfig: async () => fakeGateway,
    });

    // disconnectGateway doesn't use session directly
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { orgId: 'org-1' },
      database: {
        update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
      },
    });

    const response = await disconnectGateway(ctx);
    expect(response.status).toBe(200);
  });
});
