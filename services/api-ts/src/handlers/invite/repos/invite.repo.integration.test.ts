/**
 * Real-Postgres integration coverage for InviteRepository
 * (src/handlers/invite/repos/invite.repo.ts).
 *
 * Isolation: the shared `createScratch` harness stands up a per-suite scratch
 * schema by COPYING the real public.invitation_token structure
 * (`CREATE TABLE … (LIKE public.invitation_token INCLUDING ALL)`), so every real
 * column/default/enum/CHECK is present — no hand-DDL drift. FKs are NOT copied,
 * so invitation_token rows insert directly without a parent organization row
 * (the old shared-public-schema variant had to seed + tear down a scratch org to
 * satisfy organization_id -> organization(id); under LIKE that FK is gone).
 *
 * This is why it now RUNS IN CI: the per-suite schema removes the shared-public
 * cross-test contention the old `if (process.env['CI']) return` gate sidestepped.
 *
 * Requires a migrated public schema (local dev DB / CI ci-migrate). If Postgres
 * is unreachable the suite skips cleanly rather than false-failing.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { InviteRepository } from './invite.repo';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;

// uuid NOT NULL columns need real UUIDs (no FK rows required — LIKE drops FKs).
const ORG_ID = crypto.randomUUID();
const OFFICER_ID = crypto.randomUUID();

beforeAll(async () => {
  H = await createScratch(['invitation_token']);
});

afterAll(async () => {
  await H?.teardown();
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
    if (!H.dbReachable) return;
    const repo = new InviteRepository(H.db as never);
    const hash = uniqueHash();
    const created = await repo.create(newToken({ tokenHash: hash }));
    expect(created.id).toBeTruthy();
    const hit = await repo.findByTokenHash(hash);
    expect(hit?.id).toBe(created.id);
    const miss = await repo.findByTokenHash('nonexistent-hash');
    expect(miss).toBeUndefined();
  });

  test('findPendingByEmail matches case-insensitively, excludes expired + non-pending', async () => {
    if (!H.dbReachable) return;
    const repo = new InviteRepository(H.db as never);
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
    if (!H.dbReachable) return;
    const repo = new InviteRepository(H.db as never);
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
    if (!H.dbReachable) return;
    const repo = new InviteRepository(H.db as never);
    const created = await repo.create(newToken());
    const revoked = await repo.markRevoked(created.id);
    expect(revoked?.status).toBe('revoked');
  });

  test('updateForResend rotates tokenHash, expiresAt, and metadata.resendCount', async () => {
    if (!H.dbReachable) return;
    const repo = new InviteRepository(H.db as never);
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
    if (!H.dbReachable) return;
    const repo = new InviteRepository(H.db as never);
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
