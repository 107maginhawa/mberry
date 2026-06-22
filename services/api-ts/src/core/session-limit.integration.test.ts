/**
 * [BR-26] Session Management — concurrent session limit (real PG).
 *
 * R1-3 backfill. `enforceSessionLimit` (V-15) is wired into the Better-Auth
 * `databaseHooks.session.create.after` hook (core/auth.ts) and runs on every
 * successful login. It was previously proven only by a pure-fn characterization
 * test (communication/br-26.session-management.test.ts re-implements the
 * oldest-first revocation inline) and a mock-db unit test — neither touches the
 * real `session` table, so a drift in the ordering/delete query would pass them.
 *
 * This suite drives the REAL `enforceSessionLimit` against a `createScratch`
 * copy of the Better-Auth `session` table: it seeds N real rows with controlled
 * created_at ordering and asserts the OLDEST excess sessions are the ones
 * deleted, the newest `limit` survive, other users are untouched, and the audit
 * fan-out fires one terminate event per revoked session.
 *
 * Skips cleanly when Postgres is unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { enforceSessionLimit, DEFAULT_SESSION_LIMIT } from './session-limit';

let H: ScratchDb;

beforeAll(async () => {
  H = await createScratch(['session']);
});
afterAll(async () => {
  await H?.teardown();
});

/** Insert one session row with an explicit created_at so ordering is
 * deterministic (the rule revokes oldest-first). */
async function seedSession(userId: string, createdAt: Date): Promise<string> {
  const id = crypto.randomUUID();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".session (id, expires_at, token, created_at, updated_at, user_id)
     VALUES ($1, $2, $3, $4, $4, $5)`,
    [id, new Date(Date.now() + 86_400_000), `tok_${id}`, createdAt, userId],
  );
  return id;
}

async function sessionIds(userId: string): Promise<string[]> {
  const { rows } = await H.scopedPool.query<{ id: string }>(
    `SELECT id FROM "${H.schema}".session WHERE user_id=$1 ORDER BY created_at ASC`,
    [userId],
  );
  return rows.map((r) => r.id);
}

describe('[BR-26] enforceSessionLimit (real PG)', () => {
  test('revokes the OLDEST excess sessions, keeps the newest `limit`, leaves other users untouched', async () => {
    if (!H.dbReachable) return;
    const u1 = crypto.randomUUID();
    const u2 = crypto.randomUUID();

    // 7 sessions for u1, 1ms apart so created_at ordering is strict.
    const base = Date.now();
    const u1Ids: string[] = [];
    for (let i = 0; i < 7; i++) u1Ids.push(await seedSession(u1, new Date(base + i)));
    // u2 has its own 3 sessions that must survive entirely.
    const u2Ids = [
      await seedSession(u2, new Date(base)),
      await seedSession(u2, new Date(base + 1)),
      await seedSession(u2, new Date(base + 2)),
    ];

    const revoked = await enforceSessionLimit(H.db as never, u1, DEFAULT_SESSION_LIMIT);
    expect(revoked).toBe(2); // 7 - 5

    const remaining = await sessionIds(u1);
    expect(remaining.length).toBe(DEFAULT_SESSION_LIMIT);
    // The two OLDEST (first inserted) are the ones gone.
    expect(remaining).not.toContain(u1Ids[0]);
    expect(remaining).not.toContain(u1Ids[1]);
    // The 5 newest survive.
    expect(remaining).toEqual(u1Ids.slice(2));
    // u2 fully intact.
    expect((await sessionIds(u2)).sort()).toEqual([...u2Ids].sort());
  });

  test('under the limit is a no-op (returns 0, deletes nothing)', async () => {
    if (!H.dbReachable) return;
    const u = crypto.randomUUID();
    for (let i = 0; i < 3; i++) await seedSession(u, new Date(Date.now() + i));
    const revoked = await enforceSessionLimit(H.db as never, u, DEFAULT_SESSION_LIMIT);
    expect(revoked).toBe(0);
    expect((await sessionIds(u)).length).toBe(3);
  });

  test('records one terminate audit event per revoked session', async () => {
    if (!H.dbReachable) return;
    const u = crypto.randomUUID();
    for (let i = 0; i < 8; i++) await seedSession(u, new Date(Date.now() + i));

    const events: Array<Record<string, unknown>> = [];
    const auditRepo = { logEvent: async (e: Record<string, unknown>) => { events.push(e); return undefined; } };

    const revoked = await enforceSessionLimit(H.db as never, u, 5, undefined, auditRepo as never);
    expect(revoked).toBe(3);
    expect(events.length).toBe(3);
    expect(events.every((e) => e['eventSubType'] === 'authentication.session-revoked')).toBe(true);
    expect(events.every((e) => e['resourceType'] === 'session' && e['action'] === 'terminate')).toBe(true);
  });
});
