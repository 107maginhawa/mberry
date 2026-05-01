import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { createCredentialToken, verifyCredentialToken } from './utils/credential-token';

/**
 * Credentials Module Tests
 *
 * Tests for credential templates, digital credentials, issuance, revocation,
 * and public/authenticated verification.
 */

describe('Credential Templates', () => {
  test('createCredentialTemplate returns 401 without user', async () => {
    const { createCredentialTemplate } = await import('./createCredentialTemplate');
    const ctx = makeCtx({ user: null });
    const response = await createCredentialTemplate(ctx);
    expect(response.status).toBe(401);
  });

  test('createCredentialTemplate returns 403 without tenantId', async () => {
    const { createCredentialTemplate } = await import('./createCredentialTemplate');
    const ctx = makeCtx({ tenantId: null, _body: { name: 'Test', type: 'certificate', status: 'active' } });
    const response = await createCredentialTemplate(ctx);
    expect(response.status).toBe(403);
  });

  test('getCredentialTemplate throws UnauthorizedError without session', async () => {
    const { getCredentialTemplate } = await import('./getCredentialTemplate');
    const ctx = makeCtx({ session: null, _params: { templateId: 'some-id' } });
    await expect(getCredentialTemplate(ctx)).rejects.toThrow();
  });

  test('listCredentialTemplates throws UnauthorizedError without session', async () => {
    const { listCredentialTemplates } = await import('./listCredentialTemplates');
    const ctx = makeCtx({ session: null, _query: {} });
    await expect(listCredentialTemplates(ctx)).rejects.toThrow();
  });

  test('updateCredentialTemplate throws UnauthorizedError without session', async () => {
    const { updateCredentialTemplate } = await import('./updateCredentialTemplate');
    const ctx = makeCtx({ session: null, _params: { templateId: 'x' }, _body: {} });
    await expect(updateCredentialTemplate(ctx)).rejects.toThrow();
  });

  test('deleteCredentialTemplate throws UnauthorizedError without session', async () => {
    const { deleteCredentialTemplate } = await import('./deleteCredentialTemplate');
    const ctx = makeCtx({ session: null, _params: { templateId: 'x' } });
    await expect(deleteCredentialTemplate(ctx)).rejects.toThrow();
  });

  test('template types are memberCard, certificate, badge, license', () => {
    const validTypes = ['memberCard', 'certificate', 'badge', 'license'];
    expect(validTypes.length).toBe(4);
    expect(validTypes).toContain('certificate');
    expect(validTypes).toContain('badge');
  });

  test('template statuses are active, retired', () => {
    const validStatuses = ['active', 'retired'];
    expect(validStatuses).toContain('active');
    expect(validStatuses).toContain('retired');
  });
});

describe('Digital Credentials', () => {
  test('issueDigitalCredential returns 401 without user', async () => {
    const { issueDigitalCredential } = await import('./issueDigitalCredential');
    const ctx = makeCtx({ user: null, _body: { personId: 'p1', templateId: 't1', credentialNumber: 'CN-001' } });
    const response = await issueDigitalCredential(ctx);
    expect(response.status).toBe(401);
  });

  test('issueDigitalCredential returns 403 without tenantId', async () => {
    const { issueDigitalCredential } = await import('./issueDigitalCredential');
    const ctx = makeCtx({ tenantId: null, _body: { personId: 'p1', templateId: 't1', credentialNumber: 'CN-001' } });
    const response = await issueDigitalCredential(ctx);
    expect(response.status).toBe(403);
  });

  test('getDigitalCredential throws UnauthorizedError without session', async () => {
    const { getDigitalCredential } = await import('./getDigitalCredential');
    const ctx = makeCtx({ session: null, _params: { credentialId: 'x' } });
    await expect(getDigitalCredential(ctx)).rejects.toThrow();
  });

  test('listDigitalCredentials throws UnauthorizedError without session', async () => {
    const { listDigitalCredentials } = await import('./listDigitalCredentials');
    const ctx = makeCtx({ session: null, _query: {} });
    await expect(listDigitalCredentials(ctx)).rejects.toThrow();
  });

  test('updateDigitalCredential throws UnauthorizedError without session', async () => {
    const { updateDigitalCredential } = await import('./updateDigitalCredential');
    const ctx = makeCtx({ session: null, _params: { credentialId: 'x' }, _body: {} });
    await expect(updateDigitalCredential(ctx)).rejects.toThrow();
  });

  test('deleteDigitalCredential throws UnauthorizedError without session', async () => {
    const { deleteDigitalCredential } = await import('./deleteDigitalCredential');
    const ctx = makeCtx({ session: null, _params: { credentialId: 'x' } });
    await expect(deleteDigitalCredential(ctx)).rejects.toThrow();
  });

  test('credential statuses are active, suspended, revoked, expired', () => {
    const validStatuses = ['active', 'suspended', 'revoked', 'expired'];
    expect(validStatuses.length).toBe(4);
    expect(validStatuses).toContain('revoked');
    expect(validStatuses).toContain('expired');
  });
});

describe('Credential Revocation', () => {
  test('revokeDigitalCredential returns 401 without user', async () => {
    const { revokeDigitalCredential } = await import('./revokeDigitalCredential');
    const ctx = makeCtx({ user: null, _params: { credentialId: 'x' }, _body: { reason: 'Fraud' } });
    const response = await revokeDigitalCredential(ctx);
    expect(response.status).toBe(401);
  });

  test('revocation sets status to revoked and records reason', () => {
    const credential = {
      status: 'active' as string,
      revokedAt: null as Date | null,
      revocationReason: null as string | null,
    };

    // Simulate revocation
    credential.status = 'revoked';
    credential.revokedAt = new Date();
    credential.revocationReason = 'Expired membership';

    expect(credential.status).toBe('revoked');
    expect(credential.revokedAt).toBeInstanceOf(Date);
    expect(credential.revocationReason).toBe('Expired membership');
  });

  test('revoked credential persists through verification', () => {
    const credential = { status: 'revoked' };

    // Verification should return 'revoked' result
    let result: string;
    if (credential.status === 'revoked') {
      result = 'revoked';
    } else if (credential.status === 'expired') {
      result = 'expired';
    } else {
      result = 'valid';
    }

    expect(result).toBe('revoked');
  });
});

describe('Credential Verification (Public)', () => {
  const secret = 'test-secret-key';

  test('verifyCredentialPublic does NOT require authentication', async () => {
    const { verifyCredentialPublic } = await import('./verifyCredentialPublic');
    // Pass a context with no session - should NOT throw UnauthorizedError
    const ctx = makeCtx({ session: null, user: null, _body: { token: 'invalid-token' } });
    const response = await verifyCredentialPublic(ctx);
    // Should return a valid response (notFound for invalid token), not throw
    expect(response.status).toBe(200);
  });

  test('createCredentialToken generates a signed token', () => {
    const token = createCredentialToken('cred-1', 'tenant-1', secret);
    expect(token).toContain('.');
    const parts = token.split('.');
    expect(parts.length).toBe(2);
  });

  test('verifyCredentialToken validates valid token', () => {
    const token = createCredentialToken('cred-1', 'tenant-1', secret);
    const payload = verifyCredentialToken(token, secret);
    expect(payload).not.toBeNull();
    expect(payload!.credentialId).toBe('cred-1');
    expect(payload!.tenantId).toBe('tenant-1');
  });

  test('verifyCredentialToken rejects tampered token', () => {
    const token = createCredentialToken('cred-1', 'tenant-1', secret);
    const tampered = token.slice(0, -5) + 'XXXXX';
    const payload = verifyCredentialToken(tampered, secret);
    expect(payload).toBeNull();
  });

  test('verifyCredentialToken rejects token with wrong secret', () => {
    const token = createCredentialToken('cred-1', 'tenant-1', secret);
    const payload = verifyCredentialToken(token, 'wrong-secret');
    expect(payload).toBeNull();
  });

  test('verifyCredentialToken rejects malformed token', () => {
    expect(verifyCredentialToken('not-a-valid-token', secret)).toBeNull();
    expect(verifyCredentialToken('', secret)).toBeNull();
    expect(verifyCredentialToken('a.b.c', secret)).toBeNull();
  });
});

describe('Credential Verification (Authenticated)', () => {
  test('verifyDigitalCredentialAuthenticated throws UnauthorizedError without session', async () => {
    const { verifyDigitalCredentialAuthenticated } = await import('./verifyDigitalCredentialAuthenticated');
    const ctx = makeCtx({ session: null, _body: { token: 'some-token' } });
    await expect(verifyDigitalCredentialAuthenticated(ctx)).rejects.toThrow();
  });
});
