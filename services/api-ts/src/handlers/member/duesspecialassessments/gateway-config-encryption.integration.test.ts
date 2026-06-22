/**
 * [BR-65] Billing gateway key encryption-at-rest + never-returned (real PG).
 *
 * p0-security. The Stripe/PayMongo secret key is AES-256-GCM encrypted before
 * storage and must never be returned to any client. Backend-tested at the crypto
 * unit level; this drives the REAL upsert + get handlers against a createScratch
 * copy of dues_gateway_config and asserts the two security invariants on
 * persisted state: (1) the stored column is ciphertext that round-trips back to
 * the plaintext via decryptCredential (encryption at rest, not plaintext), and
 * (2) neither handler's response body exposes the encrypted OR plaintext secret.
 *
 * Skips cleanly when Postgres is unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { decryptCredential } from '@/core/gateway';
import { upsertDuesGatewayConfig } from './upsertDuesGatewayConfig';
import { getDuesGatewayConfig } from './getDuesGatewayConfig';

let H: ScratchDb;
const ORG = '00000000-0000-4000-8000-0000000b6501';
const ENC_SECRET = 'test-encryption-secret-32-bytes-min';
const PLAINTEXT_KEY = 'sk_test_SUPERSECRET_PLAINTEXT_should_never_surface';

beforeAll(async () => {
  H = await createScratch(['dues_gateway_config']);
});
afterAll(async () => {
  await H?.teardown();
});

function makeCtx(opts: { json?: unknown }) {
  let captured: { body: Record<string, unknown>; status: number } = { body: {}, status: 0 };
  const store: Record<string, unknown> = {
    session: { user: { id: 'officer-1' } },
    database: H.db,
    config: { auth: { secret: ENC_SECRET } },
  };
  const ctx = {
    get: (k: string) => store[k],
    set: (_k: string, _v: unknown) => {},
    req: {
      valid: (kind: 'param' | 'json') => (kind === 'param' ? { organizationId: ORG } : opts.json),
    },
    json: (b: Record<string, unknown>, status: number) => { captured = { body: b, status }; return new Response(JSON.stringify(b), { status }); },
    _captured: () => captured,
  };
  return ctx as never;
}
function cap(ctx: never): { body: Record<string, unknown>; status: number } {
  return (ctx as unknown as { _captured: () => { body: Record<string, unknown>; status: number } })._captured();
}

describe('[BR-65] dues gateway key encryption-at-rest (real PG)', () => {
  test('upsert encrypts the secret at rest and never echoes it back', async () => {
    if (!H.dbReachable) return;
    const ctx = makeCtx({ json: { provider: 'stripe', publicKey: 'pk_test_VISIBLE', secretKey: PLAINTEXT_KEY } });
    const res = await upsertDuesGatewayConfig(ctx);
    expect(res.status).toBe(200);

    const body = cap(ctx).body;
    // Response exposes only non-secret metadata.
    expect(body['publicKey']).toBe('pk_test_VISIBLE');
    expect(body['encryptedSecret']).toBeUndefined();
    expect(body['secretKey']).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('SUPERSECRET');

    // Encryption at rest: the stored column is ciphertext (≠ plaintext) that
    // decrypts back to the original — proving AES-256-GCM, not plaintext storage.
    const { rows } = await H.scopedPool.query<{ encrypted_secret: string }>(
      `SELECT encrypted_secret FROM "${H.schema}".dues_gateway_config WHERE organization_id=$1`,
      [ORG],
    );
    expect(rows).toHaveLength(1);
    const stored = rows[0]!.encrypted_secret;
    expect(stored).not.toContain('SUPERSECRET');
    expect(stored).not.toBe(PLAINTEXT_KEY);
    expect(decryptCredential(stored, ENC_SECRET)).toBe(PLAINTEXT_KEY);
  });

  test('get never returns the encrypted or plaintext secret', async () => {
    if (!H.dbReachable) return;
    // seeded by the upsert test above
    const ctx = makeCtx({});
    const res = await getDuesGatewayConfig(ctx);
    expect(res.status).toBe(200);

    const body = cap(ctx).body;
    expect(body['provider']).toBe('stripe');
    expect(body['publicKey']).toBe('pk_test_VISIBLE');
    expect(body['encryptedSecret']).toBeUndefined();
    expect(body['secretKey']).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('SUPERSECRET');
  });
});
