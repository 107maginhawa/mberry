/**
 * testDuesGatewayConnection.test.ts
 *
 * Covers:
 *  - Throws UnauthorizedError when no session
 *  - No gateway configured → 200 { success: false, message: 'No gateway configured' }
 *  - Gateway found → 200 { success: true, message: 'Gateway configuration found' }
 *  - success field is a boolean, not a string
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { testDuesGatewayConnection } from './testDuesGatewayConnection';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';

const FAKE_GATEWAY = {
  id: 'gw-1',
  organizationId: 'org-1',
  provider: 'stripe',
  publicKey: 'pk_test_abc',
  encryptedSecret: 'enc::base64==',
  connected: true,
  lastTestAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  createdBy: null,
  updatedBy: null,
};

describe('testDuesGatewayConnection', () => {
  beforeEach(() => restoreRepo(DuesRepository));
  afterEach(() => restoreRepo(DuesRepository));

  test('throws UnauthorizedError when session is null', async () => {
    const ctx = makeCtx({ session: null, user: null });
    await expect(testDuesGatewayConnection(ctx as any)).rejects.toThrow();
  });

  test('returns success:false when no gateway is configured', async () => {
    stubRepo(DuesRepository, {
      getGatewayConfig: async () => undefined,
    });

    const ctx = makeCtx({ _params: { organizationId: 'org-1' } });
    const res = await testDuesGatewayConnection(ctx as any);

    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.success).toBe(false);
    expect(body.message).toBe('No gateway configured');
  });

  test('returns success:true when gateway config exists', async () => {
    stubRepo(DuesRepository, {
      getGatewayConfig: async () => FAKE_GATEWAY,
    });

    const ctx = makeCtx({ _params: { organizationId: 'org-1' } });
    const res = await testDuesGatewayConnection(ctx as any);

    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.success).toBe(true);
    expect(body.message).toBe('Gateway configuration found');
  });

  test('success field is a boolean (not a string)', async () => {
    stubRepo(DuesRepository, {
      getGatewayConfig: async () => FAKE_GATEWAY,
    });

    const ctx = makeCtx({ _params: { organizationId: 'org-1' } });
    const res = await testDuesGatewayConnection(ctx as any);

    const body = (res as any).body;
    expect(typeof body.success).toBe('boolean');
  });

  test('uses organizationId from path param to fetch config', async () => {
    let capturedOrgId: string | undefined;
    stubRepo(DuesRepository, {
      getGatewayConfig: async (orgId: string) => {
        capturedOrgId = orgId;
        return FAKE_GATEWAY;
      },
    });

    const ctx = makeCtx({ _params: { organizationId: 'org-specific' } });
    await testDuesGatewayConnection(ctx as any);
    expect(capturedOrgId).toBe('org-specific');
  });
});
