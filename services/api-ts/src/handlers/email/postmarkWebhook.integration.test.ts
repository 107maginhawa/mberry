/**
 * [BR-55][BR-56] Postmark bounce/complaint webhook → suppression (real PG).
 *
 * Drives the REAL `postmarkWebhookHandler` against a `createScratch` copy of
 * email_queue + email_suppression. Proves the missing trigger: a provider hard
 * bounce / spam complaint, authenticated by the shared secret, suppresses the
 * address in EVERY org that mailed it — persisted rows with the right reason —
 * and is idempotent. Also asserts the auth boundary (bad secret → 401, no write)
 * and the disabled state (no secret → 503).
 *
 * Skips cleanly when Postgres is unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { postmarkWebhookHandler } from './postmarkWebhook';

let H: ScratchDb;
const SECRET = 'contract-test-postmark-secret';
const ORG_A = '00000000-0000-4000-8000-0000000b5501';
const ORG_B = '00000000-0000-4000-8000-0000000b5502';

beforeAll(async () => {
  H = await createScratch(['email_queue', 'email_suppression']);
  process.env['POSTMARK_WEBHOOK_SECRET'] = SECRET;
});
afterAll(async () => {
  delete process.env['POSTMARK_WEBHOOK_SECRET'];
  await H?.teardown();
});

function makeLogger(): Record<string, (...a: unknown[]) => unknown> {
  const l: Record<string, (...a: unknown[]) => unknown> = {
    debug: () => {}, info: () => {}, warn: () => {}, error: () => {},
  };
  l['child'] = () => l;
  return l;
}

const basicAuth = (pass: string) => 'Basic ' + Buffer.from(`postmark:${pass}`).toString('base64');

/** Minimal Hono-shaped ctx wired to the scratch db. */
function makeCtx(opts: { auth?: string; body: unknown }) {
  let captured: { body: Record<string, unknown>; status: number } = { body: {}, status: 0 };
  const store: Record<string, unknown> = { database: H.db, logger: makeLogger(), requestId: 't' };
  const ctx = {
    get: (k: string) => store[k],
    req: {
      header: (name: string) => (name.toLowerCase() === 'authorization' ? opts.auth : undefined),
      json: async () => opts.body,
    },
    json: (b: Record<string, unknown>, status: number) => {
      captured = { body: b, status };
      return new Response(JSON.stringify(b), { status });
    },
    _captured: () => captured,
  };
  return ctx as never;
}
function cap(ctx: never): { body: Record<string, unknown>; status: number } {
  return (ctx as unknown as { _captured: () => { body: Record<string, unknown>; status: number } })._captured();
}

async function seedQueued(email: string, orgId: string): Promise<void> {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".email_queue
       (id, organization_id, recipient_email, variables, status, priority, attempts, email_category)
     VALUES ($1,$2,$3,'{}'::jsonb,'sent',0,0,'transactional')`,
    [crypto.randomUUID(), orgId, email],
  );
}

async function suppressions(email: string): Promise<Array<{ organization_id: string; reason: string }>> {
  const { rows } = await H.scopedPool.query<{ organization_id: string; reason: string }>(
    `SELECT organization_id, reason FROM "${H.schema}".email_suppression WHERE email=$1 ORDER BY organization_id`,
    [email],
  );
  return rows;
}

describe('[BR-55][BR-56] postmarkWebhookHandler (real PG)', () => {
  test('hard bounce suppresses the address in every org that mailed it', async () => {
    if (!H.dbReachable) return;
    const email = 'bounce@example.com';
    await seedQueued(email, ORG_A);
    await seedQueued(email, ORG_B);
    await seedQueued('healthy@example.com', ORG_A); // control — must NOT be suppressed

    const ctx = makeCtx({
      auth: basicAuth(SECRET),
      body: { RecordType: 'Bounce', Type: 'HardBounce', Email: email },
    });
    const res = await postmarkWebhookHandler(ctx);
    expect(res.status).toBe(200);
    expect(cap(ctx).body['suppressed']).toBe(2);

    const rows = await suppressions(email);
    expect(rows.map((r) => r.organization_id).sort()).toEqual([ORG_A, ORG_B].sort());
    expect(rows.every((r) => r.reason === 'hard_bounce')).toBe(true);
    // Control address untouched.
    expect(await suppressions('healthy@example.com')).toHaveLength(0);
  });

  test('spam complaint suppresses with reason=complaint (CAN-SPAM, BR-56)', async () => {
    if (!H.dbReachable) return;
    const email = 'complainer@example.com';
    await seedQueued(email, ORG_A);

    const ctx = makeCtx({
      auth: basicAuth(SECRET),
      body: { RecordType: 'SpamComplaint', Email: email },
    });
    const res = await postmarkWebhookHandler(ctx);
    expect(res.status).toBe(200);

    const rows = await suppressions(email);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.reason).toBe('complaint');
  });

  test('a repeated bounce is idempotent (no duplicate row, no error)', async () => {
    if (!H.dbReachable) return;
    const email = 'repeat@example.com';
    await seedQueued(email, ORG_A);
    const evt = { RecordType: 'Bounce', Type: 'HardBounce', Email: email };

    await postmarkWebhookHandler(makeCtx({ auth: basicAuth(SECRET), body: evt }));
    const second = await postmarkWebhookHandler(makeCtx({ auth: basicAuth(SECRET), body: evt }));
    expect(second.status).toBe(200);
    expect(await suppressions(email)).toHaveLength(1);
  });

  test('soft bounce is NOT suppressed', async () => {
    if (!H.dbReachable) return;
    const email = 'soft@example.com';
    await seedQueued(email, ORG_A);
    const res = await postmarkWebhookHandler(
      makeCtx({ auth: basicAuth(SECRET), body: { RecordType: 'Bounce', Type: 'SoftBounce', Email: email } }),
    );
    expect(res.status).toBe(200);
    expect(await suppressions(email)).toHaveLength(0);
  });

  test('bad secret → 401 and writes nothing', async () => {
    if (!H.dbReachable) return;
    const email = 'attacker-target@example.com';
    await seedQueued(email, ORG_A);
    const res = await postmarkWebhookHandler(
      makeCtx({ auth: basicAuth('wrong-secret'), body: { RecordType: 'Bounce', Type: 'HardBounce', Email: email } }),
    );
    expect(res.status).toBe(401);
    expect(await suppressions(email)).toHaveLength(0);
  });

  test('secret not configured → 503 (webhook disabled)', async () => {
    if (!H.dbReachable) return;
    const saved = process.env['POSTMARK_WEBHOOK_SECRET'];
    delete process.env['POSTMARK_WEBHOOK_SECRET'];
    try {
      const res = await postmarkWebhookHandler(
        makeCtx({ auth: basicAuth(SECRET), body: { RecordType: 'SpamComplaint', Email: 'x@example.com' } }),
      );
      expect(res.status).toBe(503);
    } finally {
      process.env['POSTMARK_WEBHOOK_SECRET'] = saved;
    }
  });
});
