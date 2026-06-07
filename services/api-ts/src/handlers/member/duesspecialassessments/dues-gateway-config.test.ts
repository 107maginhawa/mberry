/**
 * Tests for dues_gateway_config encryption + secret-disclosure protection.
 *
 * Covers:
 *  - upsertDuesGatewayConfig encrypts the secretKey before INSERT
 *  - upsertDuesGatewayConfig response does NOT include encryptedSecret
 *  - getDuesGatewayConfig response does NOT include encryptedSecret
 *  - Round-trip: ciphertext stored on upsert can be decrypted with config.auth.secret
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { decryptCredential } from '@/core/gateway';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import { upsertDuesGatewayConfig } from './upsertDuesGatewayConfig';
import { getDuesGatewayConfig } from './getDuesGatewayConfig';

const ENCRYPTION_SECRET = 'gateway-encryption-test-secret-32+chars-min';
const PLAINTEXT_SECRET = 'sk_test_super_secret_do_not_leak';

function makeConfigStub() {
  return {
    auth: { secret: ENCRYPTION_SECRET },
  };
}

// ─── Test database that captures insert values ──────────────────────────
function makeCapturingDb(): { db: any; lastInsert: { values: any | null } } {
  const lastInsert = { values: null as any };

  const insertChain = (table: any) => ({
    values: (vals: any) => {
      lastInsert.values = vals;
      return {
        onConflictDoUpdate: (_args: any) => ({
          returning: async () => [{
            id: 'gw-1',
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1,
            createdBy: null,
            updatedBy: null,
            organizationId: vals.organizationId,
            provider: vals.provider,
            publicKey: vals.publicKey,
            encryptedSecret: vals.encryptedSecret,
            connected: true,
            lastTestAt: null,
          }],
        }),
      };
    },
  });

  return {
    db: { insert: insertChain },
    lastInsert,
  };
}

// ─── upsert: encryption + no-disclosure ─────────────────────────────────

describe('upsertDuesGatewayConfig', () => {
  test('encrypts secretKey before storing — at-rest ciphertext != plaintext', async () => {
    const { db, lastInsert } = makeCapturingDb();
    const ctx = makeCtx({
      database: db,
      config: makeConfigStub(),
      _params: { organizationId: 'org-1' },
      _body: {
        provider: 'stripe',
        publicKey: 'pk_test_abc',
        secretKey: PLAINTEXT_SECRET,
      },
    });

    const res = await upsertDuesGatewayConfig(ctx as any);
    expect(res.status).toBe(200);

    // The persisted value MUST NOT be the raw secret.
    expect(lastInsert.values.encryptedSecret).not.toBe(PLAINTEXT_SECRET);
    expect(typeof lastInsert.values.encryptedSecret).toBe('string');
    expect(lastInsert.values.encryptedSecret.length).toBeGreaterThan(0);

    // And it MUST round-trip back to the plaintext with the same secret.
    const decrypted = decryptCredential(lastInsert.values.encryptedSecret, ENCRYPTION_SECRET);
    expect(decrypted).toBe(PLAINTEXT_SECRET);
  });

  test('response body never includes encryptedSecret', async () => {
    const { db } = makeCapturingDb();
    const ctx = makeCtx({
      database: db,
      config: makeConfigStub(),
      _params: { organizationId: 'org-1' },
      _body: {
        provider: 'stripe',
        publicKey: 'pk_test_abc',
        secretKey: PLAINTEXT_SECRET,
      },
    });

    const res = await upsertDuesGatewayConfig(ctx as any);
    const body = (res as any).body;
    expect(body).toBeDefined();
    expect('encryptedSecret' in body).toBe(false);
    // Non-secret metadata still flows back.
    expect(body.provider).toBe('stripe');
    expect(body.publicKey).toBe('pk_test_abc');
    expect(body.organizationId).toBe('org-1');
  });

  test('different plaintexts produce different ciphertexts (non-deterministic IV)', async () => {
    const { db: db1, lastInsert: li1 } = makeCapturingDb();
    const { db: db2, lastInsert: li2 } = makeCapturingDb();
    const baseBody = {
      provider: 'stripe',
      publicKey: 'pk_test_abc',
      secretKey: PLAINTEXT_SECRET,
    };

    await upsertDuesGatewayConfig(makeCtx({
      database: db1,
      config: makeConfigStub(),
      _params: { organizationId: 'org-1' },
      _body: baseBody,
    }) as any);
    await upsertDuesGatewayConfig(makeCtx({
      database: db2,
      config: makeConfigStub(),
      _params: { organizationId: 'org-1' },
      _body: baseBody,
    }) as any);

    // Same plaintext, same key — but different IVs must produce different ciphertexts.
    expect(li1.values.encryptedSecret).not.toBe(li2.values.encryptedSecret);
    // Both decrypt to the same plaintext.
    expect(decryptCredential(li1.values.encryptedSecret, ENCRYPTION_SECRET)).toBe(PLAINTEXT_SECRET);
    expect(decryptCredential(li2.values.encryptedSecret, ENCRYPTION_SECRET)).toBe(PLAINTEXT_SECRET);
  });
});

// ─── get: no-disclosure ─────────────────────────────────────────────────

describe('getDuesGatewayConfig', () => {
  beforeEach(() => {
    restoreRepo(DuesRepository);
  });
  afterEach(() => {
    restoreRepo(DuesRepository);
  });

  test('response body never includes encryptedSecret when config exists', async () => {
    stubRepo(DuesRepository, {
      getGatewayConfig: async () => ({
        id: 'gw-1',
        organizationId: 'org-1',
        provider: 'stripe',
        publicKey: 'pk_test_public',
        encryptedSecret: 'some-encrypted-payload-base64==',
        connected: true,
        lastTestAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        createdBy: null,
        updatedBy: null,
      }),
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
    });
    const res = await getDuesGatewayConfig(ctx as any);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect('encryptedSecret' in body).toBe(false);
    // Non-secret fields preserved.
    expect(body.provider).toBe('stripe');
    expect(body.publicKey).toBe('pk_test_public');
  });

  test('returns empty object when no config exists (no leak path)', async () => {
    stubRepo(DuesRepository, {
      getGatewayConfig: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
    });
    const res = await getDuesGatewayConfig(ctx as any);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body).toEqual({});
  });
});
