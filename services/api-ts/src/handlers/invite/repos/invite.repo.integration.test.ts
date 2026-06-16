/**
 * Real-Postgres integration coverage for InviteRepository
 * (src/handlers/invite/repos/invite.repo.ts).
 *
 * invitation_token has a hard FK on organization_id -> organization(id), so we
 * insert one scratch organization (its association_id is a plain uuid, no FK)
 * and scope every token to it. afterAll deletes our tokens + org. Documented
 * skip when Postgres is unreachable.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql, eq } from 'drizzle-orm';
import { InviteRepository } from './invite.repo';
import { invitationTokens } from './invite.schema';

const DB_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase';

const ORG_ID = crypto.randomUUID();
const OFFICER_ID = crypto.randomUUID();

let pool: Pool;
let db: ReturnType<typeof drizzle>;
let repo: InviteRepository;
let dbReachable = false;

beforeAll(async () => {
  pool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 3000 });
  try {
    const c = await pool.connect();
    try {
      // Scratch org to satisfy the organization_id FK.
      await c.query(
        `INSERT INTO organization (id, association_id, name, slug, org_type, status)
         VALUES ($1, $2, $3, $4, 'society', 'active')`,
        [ORG_ID, crypto.randomUUID(), `invite-test-${ORG_ID}`, `invite-test-${ORG_ID}`],
      );
    } finally {
      c.release();
    }
    db = drizzle(pool);
    repo = new InviteRepository(db as never);
    dbReachable = true;
  } catch (err) {
    dbReachable = false;
    // eslint-disable-next-line no-console
    console.warn(`[invite.repo integration] Postgres unreachable; skipping. ${(err as Error).message}`);
  }
});

afterAll(async () => {
  if (pool) {
    try {
      if (dbReachable) {
        await db.delete(invitationTokens).where(eq(invitationTokens.organizationId, ORG_ID));
        await pool.query(`DELETE FROM organization WHERE id = $1`, [ORG_ID]);
      }
    } finally {
      await pool.end();
    }
  }
});

let hashCounter = 0;
const uniqueHash = () => `hash-${ORG_ID}-${hashCounter++}-${crypto.randomUUID()}`;

const newToken = (over: Record<string, unknown> = {}) => ({
  organizationId: ORG_ID,
  tokenHash: uniqueHash(),
  type: 'invite' as const,
  status: 'pending' as const,
  expiresAt: new Date(Date.now() + 7 * 86400000),
  createdByOfficer: OFFICER_ID,
  email: 'invitee@example.com',
  ...over,
});

describe('InviteRepository (real-PG)', () => {
  test('create + findByTokenHash (hit/miss)', async () => {
    if (!dbReachable) return;
    const hash = uniqueHash();
    const created = await repo.create(newToken({ tokenHash: hash }));
    expect(created.id).toBeTruthy();
    const hit = await repo.findByTokenHash(hash);
    expect(hit?.id).toBe(created.id);
    const miss = await repo.findByTokenHash('nonexistent-hash');
    expect(miss).toBeUndefined();
  });

  test('findPendingByEmail matches case-insensitively, excludes expired + non-pending', async () => {
    if (!dbReachable) return;
    const email = `Pending.User+${crypto.randomUUID()}@Example.com`;
    const lower = email.toLowerCase();
    const created = await repo.create(newToken({ email: lower }));

    // case-insensitive lookup against stored lowercased email
    const hit = await repo.findPendingByEmail(email.toUpperCase(), ORG_ID);
    expect(hit?.id).toBe(created.id);

    // expired token excluded
    const expiredEmail = `expired+${crypto.randomUUID()}@example.com`;
    await repo.create(newToken({ email: expiredEmail, expiresAt: new Date(Date.now() - 1000) }));
    expect(await repo.findPendingByEmail(expiredEmail, ORG_ID)).toBeUndefined();

    // revoked (non-pending) token excluded
    const revokedEmail = `revoked+${crypto.randomUUID()}@example.com`;
    const rev = await repo.create(newToken({ email: revokedEmail }));
    await repo.markRevoked(rev.id);
    expect(await repo.findPendingByEmail(revokedEmail, ORG_ID)).toBeUndefined();
  });

  test('markClaimed sets status=claimed + claimedAt; claim atomicity removes from pending lookup', async () => {
    if (!dbReachable) return;
    const email = `claim+${crypto.randomUUID()}@example.com`;
    const created = await repo.create(newToken({ email }));

    // findable while pending
    expect((await repo.findPendingByEmail(email, ORG_ID))?.id).toBe(created.id);

    const claimed = await repo.markClaimed(created.id);
    expect(claimed?.status).toBe('claimed');
    expect(claimed?.claimedAt).toBeTruthy();

    // second findPendingByEmail no longer returns the claimed token
    expect(await repo.findPendingByEmail(email, ORG_ID)).toBeUndefined();
  });

  test('markRevoked sets status=revoked', async () => {
    if (!dbReachable) return;
    const created = await repo.create(newToken());
    const revoked = await repo.markRevoked(created.id);
    expect(revoked?.status).toBe('revoked');
  });

  test('updateForResend rotates tokenHash, expiresAt, and metadata.resendCount', async () => {
    if (!dbReachable) return;
    const created = await repo.create(newToken());
    const newHash = uniqueHash();
    const newExpiry = new Date(Date.now() + 14 * 86400000);
    const updated = await repo.updateForResend(created.id, newHash, newExpiry, 3);
    expect(updated?.tokenHash).toBe(newHash);
    expect(new Date(updated!.expiresAt).toISOString()).toBe(newExpiry.toISOString());
    expect(updated?.metadata?.resendCount).toBe(3);
    expect(updated?.metadata?.lastResentAt).toBeTruthy();
  });

  test('listByOrg with and without status filter', async () => {
    if (!dbReachable) return;
    const pending = await repo.create(newToken());
    const toRevoke = await repo.create(newToken());
    await repo.markRevoked(toRevoke.id);

    const all = await repo.listByOrg(ORG_ID);
    expect(all.some((t) => t.id === pending.id)).toBe(true);
    expect(all.length).toBeGreaterThanOrEqual(2);

    const onlyRevoked = await repo.listByOrg(ORG_ID, 'revoked');
    expect(onlyRevoked.every((t) => t.status === 'revoked')).toBe(true);
    expect(onlyRevoked.some((t) => t.id === toRevoke.id)).toBe(true);
  });
});
