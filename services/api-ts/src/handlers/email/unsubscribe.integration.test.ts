/**
 * Real-PG integration test for the RFC-8058 one-click unsubscribe workflow
 * (`unsubscribeEmail` handler) — Wave-2 cluster B3 (feedback), email Slice 5.
 *
 * WHAT THIS PROVES (PERSISTED effect, not the 200):
 *   The handler verifies an HMAC unsubscribe token (`verifyUnsubToken`) and,
 *   only on success, calls `SuppressionRepository.addSuppression(...)` which
 *   writes a real `email_suppression` row. Today this persistence is asserted
 *   only against stubbed repos. Here we drive the REAL handler against a REAL
 *   Postgres scratch schema and read the row back.
 *
 *   - valid token        → 200 text/html + exactly ONE row, reason='unsubscribe'
 *   - forged/garbage tok  → 400, writes NOTHING (count=0) — HMAC gate guards the DB
 *   - missing param       → 400, writes NOTHING
 *   - idempotent re-click → still 200, still exactly ONE row (23505 no-op on
 *                           email_suppression_org_email_unique)
 *   - org-scope           → unsubscribe in orgA leaves orgB count=0
 *
 * createScratch(['email_suppression']) — schema-faithful LIKE copy (org_id NOT
 * NULL + the (org,email) unique constraint are reproduced).
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { generateUnsubToken } from './utils/unsub-token';
import { unsubscribeEmail } from './unsubscribeEmail';

let H: ScratchDb;

// org ids must be valid uuids (email_suppression.organization_id is uuid).
const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const ORG_B = '00000000-0000-4000-8000-0000000000b1';

/**
 * Build a faithful Hono-like context for the unsubscribe handler. The handler
 * only touches: c.req.query(key), c.get('database'|'logger'), c.body(html,status,headers).
 * We capture the body() call so we can assert the rendered status, the HTML
 * payload, AND the Content-Type header.
 */
function makeUnsubCtx(query: Record<string, string | undefined>) {
  const captured: { body?: string; status?: number; headers?: Record<string, string> } = {};
  const vars: Record<string, any> = { database: H.db, logger: null };
  const ctx = {
    get: (k: string) => vars[k],
    req: { query: (k: string) => query[k] ?? null },
    body: (body: string, status: number, headers?: Record<string, string>) => {
      captured.body = body;
      captured.status = status;
      captured.headers = headers;
      return { status, body, headers } as any;
    },
  } as any;
  return { ctx, captured };
}

async function countRows(orgId: string, email: string): Promise<number> {
  const { rows } = await H.scopedPool.query(
    `SELECT count(*)::int AS n FROM "${H.schema}".email_suppression WHERE organization_id=$1 AND email=$2`,
    [orgId, email],
  );
  return rows[0].n as number;
}

beforeAll(async () => {
  // The token util resolves the secret from process.env at call time. Ensure a
  // non-default secret is present so generate/verify use the SAME key.
  if (!process.env['UNSUBSCRIBE_SECRET'] || process.env['UNSUBSCRIBE_SECRET'] === 'dev-unsub-secret-change-in-production') {
    process.env['UNSUBSCRIBE_SECRET'] = 'wave2-b3-email-s5-test-secret';
  }
  H = await createScratch(['email_suppression']);
});

afterAll(async () => {
  await H?.teardown();
});

describe('unsubscribeEmail — HMAC-verified one-click persistence (real PG)', () => {
  test('valid token → 200 text/html AND persists exactly one suppression row with reason=unsubscribe', async () => {
    if (!H.dbReachable) return;
    const email = `valid-${crypto.randomUUID()}@example.test`;
    const token = generateUnsubToken(email, ORG_A);

    const { ctx, captured } = makeUnsubCtx({ token, email, orgId: ORG_A });
    await unsubscribeEmail(ctx);

    // response shape
    expect(captured.status).toBe(200);
    expect(captured.headers?.['Content-Type']).toContain('text/html');
    expect(captured.body).toContain('unsubscribed');

    // PERSISTED effect — read back the real row
    const { rows } = await H.scopedPool.query(
      `SELECT organization_id, email, reason, suppressed_at FROM "${H.schema}".email_suppression WHERE organization_id=$1 AND email=$2`,
      [ORG_A, email],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].reason).toBe('unsubscribe');
    expect(rows[0].organization_id).toBe(ORG_A);
    expect(rows[0].suppressed_at).toBeInstanceOf(Date);
  });

  test('forged token → 400 and writes NOTHING (HMAC gate guards the DB)', async () => {
    if (!H.dbReachable) return;
    const email = `forged-${crypto.randomUUID()}@example.test`;
    // a token signed for a DIFFERENT email is invalid for this email
    const wrongToken = generateUnsubToken('someone-else@example.test', ORG_A);

    const { ctx, captured } = makeUnsubCtx({ token: wrongToken, email, orgId: ORG_A });
    await unsubscribeEmail(ctx);

    expect(captured.status).toBe(400);
    expect(await countRows(ORG_A, email)).toBe(0);
  });

  test('garbage token → 400 and writes NOTHING', async () => {
    if (!H.dbReachable) return;
    const email = `garbage-${crypto.randomUUID()}@example.test`;

    const { ctx, captured } = makeUnsubCtx({ token: 'not-a-real-token', email, orgId: ORG_A });
    await unsubscribeEmail(ctx);

    expect(captured.status).toBe(400);
    expect(await countRows(ORG_A, email)).toBe(0);
  });

  test('missing email param → 400 and writes NOTHING', async () => {
    if (!H.dbReachable) return;
    const email = `missing-${crypto.randomUUID()}@example.test`;
    const token = generateUnsubToken(email, ORG_A);

    // omit the email query param entirely
    const { ctx, captured } = makeUnsubCtx({ token, orgId: ORG_A });
    await unsubscribeEmail(ctx);

    expect(captured.status).toBe(400);
    expect(await countRows(ORG_A, email)).toBe(0);
  });

  test('idempotent re-click → still 200 and still exactly ONE row (23505 no-op)', async () => {
    if (!H.dbReachable) return;
    const email = `idem-${crypto.randomUUID()}@example.test`;
    const token = generateUnsubToken(email, ORG_A);

    const first = makeUnsubCtx({ token, email, orgId: ORG_A });
    await unsubscribeEmail(first.ctx);
    expect(first.captured.status).toBe(200);

    const second = makeUnsubCtx({ token, email, orgId: ORG_A });
    await unsubscribeEmail(second.ctx);
    expect(second.captured.status).toBe(200);

    expect(await countRows(ORG_A, email)).toBe(1);
    // first reason retained (no-op does not overwrite)
    const { rows } = await H.scopedPool.query(
      `SELECT reason FROM "${H.schema}".email_suppression WHERE organization_id=$1 AND email=$2`,
      [ORG_A, email],
    );
    expect(rows[0].reason).toBe('unsubscribe');
  });

  test('org-scope — unsubscribe in orgA does not create a suppression in orgB', async () => {
    if (!H.dbReachable) return;
    const email = `scoped-${crypto.randomUUID()}@example.test`;
    const tokenA = generateUnsubToken(email, ORG_A);

    const { ctx, captured } = makeUnsubCtx({ token: tokenA, email, orgId: ORG_A });
    await unsubscribeEmail(ctx);
    expect(captured.status).toBe(200);

    expect(await countRows(ORG_A, email)).toBe(1);
    // cross-tenant isolation: orgB has nothing for this address
    expect(await countRows(ORG_B, email)).toBe(0);
  });
});
