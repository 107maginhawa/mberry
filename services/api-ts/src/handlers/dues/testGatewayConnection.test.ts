import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { testGatewayConnection } from './testGatewayConnection';

// ─── Tests ──────────────────────────────────────────────

describe('testGatewayConnection', () => {
  test('returns success for valid key format', async () => {
    const ctx = makeCtx({
      _body: {
        provider: 'paymongo',
        publicKey: 'pk_test_1234567890',
        secretKey: 'sk_test_1234567890',
      },
    });

    const response = await testGatewayConnection(ctx);
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Connection verified.');
  });

  test('returns failure for short keys', async () => {
    const ctx = makeCtx({
      _body: {
        provider: 'paymongo',
        publicKey: 'short',
        secretKey: 'short',
      },
    });

    const response = await testGatewayConnection(ctx);
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Invalid key format');
  });

  test('throws ValidationError when provider missing', async () => {
    const ctx = makeCtx({
      _body: {
        publicKey: 'pk_test_1234567890',
        secretKey: 'sk_test_1234567890',
      },
    });

    await expect(testGatewayConnection(ctx)).rejects.toThrow('Provider, public key, and secret key are required');
  });

  test('throws ValidationError when publicKey missing', async () => {
    const ctx = makeCtx({
      _body: {
        provider: 'paymongo',
        secretKey: 'sk_test_1234567890',
      },
    });

    await expect(testGatewayConnection(ctx)).rejects.toThrow('Provider, public key, and secret key are required');
  });

  test('throws ValidationError when secretKey missing', async () => {
    const ctx = makeCtx({
      _body: {
        provider: 'paymongo',
        publicKey: 'pk_test_1234567890',
      },
    });

    await expect(testGatewayConnection(ctx)).rejects.toThrow('Provider, public key, and secret key are required');
  });

  test('crashes without session (no auth)', async () => {
    // testGatewayConnection doesn't use session
    const ctx = makeCtx({
      user: null,
      session: null,
      _body: {
        provider: 'paymongo',
        publicKey: 'pk_test_1234567890',
        secretKey: 'sk_test_1234567890',
      },
    });

    const response = await testGatewayConnection(ctx);
    expect(response.status).toBe(200);
  });
});
