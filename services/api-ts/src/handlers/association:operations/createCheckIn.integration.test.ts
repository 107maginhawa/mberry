/**
 * [BR-18] QR Code Authentication — event check-in (real PG).
 *
 * R1-3 backfill. `createCheckIn` (POST /association/events/checkins) is wired in
 * the OpenAPI registry and verifies an HMAC-signed QR token (qr-checkin.ts)
 * before recording attendance. Its only test was a pure-fn characterization
 * (events/br-18.qr-code-auth.test.ts re-implements the HMAC primitive inline) —
 * nothing exercised the real handler's verify→persist path against Postgres.
 *
 * This suite mints a REAL token with `generateQrToken` (same secret the handler
 * reads), drives the REAL `createCheckIn` handler against a `createScratch`
 * schema, and asserts: a valid token persists a check_in row; a tampered token
 * is rejected; a second check-in for the same (event, person) is rejected.
 *
 * Skips cleanly when Postgres is unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { BusinessLogicError } from '@/core/errors';
import { createCheckIn } from './createCheckIn';
import { generateQrToken } from './utils/qr-checkin';

let H: ScratchDb;

const ORG = '00000000-0000-4000-8000-0000000a1801';
// The handler reads QR_SECRET || 'default-qr-secret'; sign with the same value.
const SECRET = process.env['QR_SECRET'] || 'default-qr-secret';

beforeAll(async () => {
  H = await createScratch(['event', 'check_in']);
});
afterAll(async () => {
  await H?.teardown();
});

function makeLogger(): Record<string, (...a: unknown[]) => unknown> {
  const l: Record<string, (...a: unknown[]) => unknown> = {
    debug: () => {}, info: () => {}, warn: () => {}, error: () => {},
  };
  l['child'] = () => l;
  return l;
}

function makeCtx(personId: string, body: unknown) {
  let captured: { body: Record<string, unknown>; status: number } = { body: {}, status: 0 };
  const store: Record<string, unknown> = {
    user: { id: personId },
    organizationId: ORG,
    database: H.db,
    logger: makeLogger(),
  };
  const ctx = {
    get: (k: string) => store[k],
    set: (_k: string, _v: unknown) => {},
    req: { valid: (_k: 'json') => body },
    json: (b: Record<string, unknown>, status: number) => { captured = { body: b, status }; return new Response(JSON.stringify(b), { status }); },
    _captured: () => captured,
  };
  return ctx as never;
}
function cap(ctx: never): { body: Record<string, unknown>; status: number } {
  return (ctx as unknown as { _captured: () => { body: Record<string, unknown>; status: number } })._captured();
}

async function seedEvent(): Promise<string> {
  const id = crypto.randomUUID();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".event (id, organization_id, title, start_date, end_date, status, visibility)
     VALUES ($1,$2,'CPD Seminar', now(), now() + interval '2 hours', 'published', 'internal')`,
    [id, ORG],
  );
  return id;
}

describe('[BR-18] createCheckIn QR auth (real PG)', () => {
  test('a valid QR token check-in persists a check_in row with method=qr', async () => {
    if (!H.dbReachable) return;
    const eventId = await seedEvent();
    const person = crypto.randomUUID();
    const token = generateQrToken(eventId, 'event', SECRET);

    const ctx = makeCtx(person, { method: 'qr', qrToken: token });
    const res = await createCheckIn(ctx);
    expect(res.status).toBe(201);

    const { rows } = await H.scopedPool.query<{ method: string; checked_in_by: string }>(
      `SELECT method, checked_in_by FROM "${H.schema}".check_in WHERE event_id=$1 AND person_id=$2`,
      [eventId, person]);
    expect(rows.length).toBe(1);
    expect(rows[0]!.method).toBe('qr');
    expect(rows[0]!.checked_in_by).toBe(person);
    expect(cap(ctx).body['id']).toBeTruthy();
  });

  test('a tampered QR token is rejected (no row written)', async () => {
    if (!H.dbReachable) return;
    const eventId = await seedEvent();
    const person = crypto.randomUUID();
    const token = generateQrToken(eventId, 'event', SECRET);
    const tampered = token.slice(0, -3) + 'xyz';

    const ctx = makeCtx(person, { method: 'qr', qrToken: tampered });
    await expect(createCheckIn(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
    const { rows } = await H.scopedPool.query(
      `SELECT 1 FROM "${H.schema}".check_in WHERE person_id=$1`, [person]);
    expect(rows.length).toBe(0);
  });

  test('a duplicate check-in for the same (event, person) is rejected', async () => {
    if (!H.dbReachable) return;
    const eventId = await seedEvent();
    const person = crypto.randomUUID();
    const token = generateQrToken(eventId, 'event', SECRET);

    await createCheckIn(makeCtx(person, { method: 'qr', qrToken: token }));
    // Second attempt — duplicate guard fires.
    await expect(createCheckIn(makeCtx(person, { method: 'qr', qrToken: token })))
      .rejects.toBeInstanceOf(BusinessLogicError);
    const { rows } = await H.scopedPool.query(
      `SELECT 1 FROM "${H.schema}".check_in WHERE event_id=$1 AND person_id=$2`, [eventId, person]);
    expect(rows.length).toBe(1);
  });
});
