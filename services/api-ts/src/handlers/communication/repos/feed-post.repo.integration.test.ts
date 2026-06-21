/**
 * Real-Postgres integration tests for the M13 FeedPostRepository.
 *
 * `feed-post.repo.ts` had ZERO real-DB coverage. The existing module tests
 * (`m13.professional-feed.test.ts`, `br-35.feed-moderation.test.ts`) operate on
 * pure in-memory rule functions or stubs, so they can NEVER prove that the actual
 * Drizzle SQL the repo emits is correct. They cannot catch:
 *   - a `list()` that forgets the `is_removed = false` predicate and leaks
 *     soft-removed posts into the member feed (the core BR here),
 *   - a `total` count that double-counts or counts the wrong org/removed rows,
 *   - a broken SINGLE-PIN invariant where pinning a post fails to unpin the
 *     previously-pinned post in the same org (two pinned posts at once),
 *   - a pin operation that bleeds across org boundaries (unpins another org's
 *     pinned post),
 *   - `addReport` failing to atomically insert the report row AND bump
 *     `report_count`, which is what the handler's 3-report auto-flag threshold
 *     reads via `getReportCount`,
 *   - an org-scope leak in `list()` / `getMutedAuthors()`.
 *
 * This suite drives the REAL query builders against REAL rows in Postgres and
 * asserts the REAL returned data + the persisted row state read back from the
 * database (single-pin flips, count math, report rows) — never "did not throw".
 *
 * Isolation: the shared `createScratch` harness stands up a per-suite scratch
 * schema by COPYING the real public table structures
 * (`CREATE TABLE … (LIKE public.<t> INCLUDING ALL)`), so every real column /
 * default / enum (feed_post_type, feed_post_visibility, feed_post_status) is
 * present — no hand-DDL drift. FKs are not copied, so feed rows insert directly
 * without parent person/org rows. Enum-typed raw params get an explicit ::<enum>
 * cast.
 *
 * NOTE on the "3 reports → auto-flag → remove" BR: the threshold transition lives
 * in the HANDLER (`reportFeedPost.ts`, AUTO_FLAG_THRESHOLD = 3), NOT in the repo.
 * The repo only supplies the two primitives that BR composes from: `addReport`
 * (insert report + increment report_count) and `getReportCount` (count report
 * rows). Those primitives — and the count crossing the threshold value of 3 — are
 * what we assert here. See the `couldNotCover` note in the handoff for the
 * repo-only scope boundary.
 *
 * Requires a migrated public schema (local dev DB / CI ci-migrate). If Postgres
 * is unreachable the suite skips cleanly rather than false-failing.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { FeedPostRepository } from './feed-post.repo';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;

// uuid NOT NULL columns need real UUIDs (no FK rows required — LIKE drops FKs).
const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const ORG_B = '00000000-0000-4000-8000-0000000000b1';
const AUTHOR = '00000000-0000-4000-8000-0000000000c1';

function freshId(): string {
  return randomUUID();
}

/**
 * Insert a feed_post row directly via raw SQL and return its id. Raw SQL (rather
 * than repo.create) lets us seed adversarial combinations the create path
 * wouldn't normally produce — pre-removed posts, pre-pinned posts, an explicit
 * created_at ordering — so the read/list/pin side can be proven against them.
 * We set every NOT-NULL-without-default column (organization_id, author_id,
 * post_type, body_text) and rely on column defaults for the rest (id, timestamps,
 * version, visibility='org', status='published', is_pinned=false,
 * is_sponsored=false, is_removed=false, report_count=0). Enum params get an
 * explicit ::<enum> cast; created_at is passed as ::timestamptz when overridden.
 */
async function insertPost(opts: {
  id?: string;
  organizationId?: string;
  authorId?: string;
  postType?: 'announcement' | 'event_highlight' | 'training_opportunity' | 'achievement' | 'clinical_update';
  bodyText?: string;
  status?: 'published' | 'draft' | 'flagged' | 'removed';
  isPinned?: boolean;
  isRemoved?: boolean;
  reportCount?: number;
  createdAt?: string; // ISO string, e.g. '2024-01-01T00:00:00Z'
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".feed_post
       (id, organization_id, author_id, post_type, body_text, status,
        is_pinned, is_removed, report_count, created_at)
     VALUES ($1,$2,$3,$4::feed_post_type,$5,
             COALESCE($6::feed_post_status,'published'),
             $7,$8,$9,
             COALESCE($10::timestamptz, now()))`,
    [
      id,
      opts.organizationId ?? ORG_A,
      opts.authorId ?? AUTHOR,
      opts.postType ?? 'announcement',
      opts.bodyText ?? `body-${id.slice(0, 8)}`,
      opts.status ?? null,
      opts.isPinned ?? false,
      opts.isRemoved ?? false,
      opts.reportCount ?? 0,
      opts.createdAt ?? null,
    ],
  );
  return id;
}

/** Read a single feed_post row back from Postgres (bypassing the repo). */
async function readPost(id: string): Promise<any> {
  const { rows } = await H.scopedPool.query(
    `SELECT * FROM "${H.schema}".feed_post WHERE id = $1`,
    [id],
  );
  return rows[0];
}

/** Read all report rows for a post from Postgres. */
async function readReports(postId: string): Promise<any[]> {
  const { rows } = await H.scopedPool.query(
    `SELECT * FROM "${H.schema}".feed_post_report WHERE post_id = $1 ORDER BY created_at`,
    [postId],
  );
  return rows;
}

beforeAll(async () => {
  H = await createScratch(['feed_post', 'feed_post_reaction', 'feed_post_report', 'feed_muted_author']);
});

afterAll(async () => {
  await H?.teardown();
});

// ═══════════════════════════════════════════════════════════════════════════
// list() — EXCLUDES soft-removed posts + returns the correct total count
// ═══════════════════════════════════════════════════════════════════════════

describe('FeedPostRepository.list — soft-remove exclusion + total (real DB)', () => {
  test('omits is_removed=true posts from data AND from total', async () => {
    if (!H.dbReachable) return;
    const repo = new FeedPostRepository(H.db as any);
    const org = freshId();

    const visibleA = await insertPost({ organizationId: org, isRemoved: false });
    const visibleB = await insertPost({ organizationId: org, isRemoved: false });
    // Soft-removed posts must NOT surface in the member feed nor inflate the count.
    await insertPost({ organizationId: org, isRemoved: true, status: 'removed' });
    await insertPost({ organizationId: org, isRemoved: true, status: 'removed' });

    const { data, total } = await repo.list(org);

    // Exactly the two non-removed posts are returned.
    expect(new Set(data.map((p) => p.id))).toEqual(new Set([visibleA, visibleB]));
    expect(data.every((p) => p.isRemoved === false)).toBe(true);
    // total counts ONLY the non-removed rows (not the 4 total rows in the org).
    expect(total).toBe(2);
  });

  test('total reflects the full non-removed count even when paging limits the data page', async () => {
    if (!H.dbReachable) return;
    const repo = new FeedPostRepository(H.db as any);
    const org = freshId();

    // 5 visible + 2 removed. A limit-2 page returns 2 rows but total must be 5.
    for (let i = 0; i < 5; i++) await insertPost({ organizationId: org, isRemoved: false });
    await insertPost({ organizationId: org, isRemoved: true, status: 'removed' });
    await insertPost({ organizationId: org, isRemoved: true, status: 'removed' });

    const { data, total } = await repo.list(org, { limit: 2, offset: 0 });
    expect(data).toHaveLength(2);
    expect(total).toBe(5); // count ignores the page window AND the removed rows
  });

  test('returns empty data + total 0 for an org whose only posts are soft-removed', async () => {
    if (!H.dbReachable) return;
    const repo = new FeedPostRepository(H.db as any);
    const org = freshId();
    await insertPost({ organizationId: org, isRemoved: true, status: 'removed' });

    const { data, total } = await repo.list(org);
    expect(data).toEqual([]);
    expect(total).toBe(0);
  });

  test('orders newest-first by created_at (desc)', async () => {
    if (!H.dbReachable) return;
    const repo = new FeedPostRepository(H.db as any);
    const org = freshId();

    const older = await insertPost({ organizationId: org, createdAt: '2024-01-01T00:00:00Z' });
    const newer = await insertPost({ organizationId: org, createdAt: '2024-06-01T00:00:00Z' });
    const newest = await insertPost({ organizationId: org, createdAt: '2025-01-01T00:00:00Z' });

    const { data } = await repo.list(org);
    expect(data.map((p) => p.id)).toEqual([newest, newer, older]);
  });

  test('offset pages past the first window without re-counting removed rows', async () => {
    if (!H.dbReachable) return;
    const repo = new FeedPostRepository(H.db as any);
    const org = freshId();
    const a = await insertPost({ organizationId: org, createdAt: '2025-03-01T00:00:00Z' });
    const b = await insertPost({ organizationId: org, createdAt: '2025-02-01T00:00:00Z' });
    const c = await insertPost({ organizationId: org, createdAt: '2025-01-01T00:00:00Z' });
    await insertPost({ organizationId: org, isRemoved: true, status: 'removed' });

    const page2 = await repo.list(org, { limit: 1, offset: 1 });
    expect(page2.data.map((p) => p.id)).toEqual([b]); // a is page-1, b is page-2
    expect(page2.total).toBe(3); // a, b, c — removed row excluded
    void a;
    void c;
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// list() — org-scoping (tenant guard)
// ═══════════════════════════════════════════════════════════════════════════

describe('FeedPostRepository.list — org-scoping (real DB)', () => {
  test('returns only the requested org\'s posts and never another org\'s', async () => {
    if (!H.dbReachable) return;
    const repo = new FeedPostRepository(H.db as any);
    const orgX = freshId();
    const orgY = freshId();

    const mineA = await insertPost({ organizationId: orgX });
    const mineB = await insertPost({ organizationId: orgX });
    await insertPost({ organizationId: orgY });
    await insertPost({ organizationId: orgY });

    const { data, total } = await repo.list(orgX);
    expect(new Set(data.map((p) => p.id))).toEqual(new Set([mineA, mineB]));
    expect(data.every((p) => p.organizationId === orgX)).toBe(true);
    expect(total).toBe(2); // count is org-scoped too, not a global count
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// pin() — the SINGLE-PIN invariant (pinning unpins the prior pin in the org)
// ═══════════════════════════════════════════════════════════════════════════

describe('FeedPostRepository.pin — single-pin invariant (real DB)', () => {
  test('pinning a post unpins the previously-pinned post in the SAME org', async () => {
    if (!H.dbReachable) return;
    const repo = new FeedPostRepository(H.db as any);
    const org = freshId();

    // Start with postA already pinned (seeded directly as is_pinned=true).
    const postA = await insertPost({ organizationId: org, isPinned: true });
    const postB = await insertPost({ organizationId: org, isPinned: false });

    const returned = await repo.pin(postB, org);

    // Returned row reflects the new pin.
    expect(returned.id).toBe(postB);
    expect(returned.isPinned).toBe(true);

    // Persisted state: the flip is durable — B pinned, A unpinned.
    expect((await readPost(postB)).is_pinned).toBe(true);
    expect((await readPost(postA)).is_pinned).toBe(false);

    // And there is EXACTLY ONE pinned post in the org (the single-pin invariant).
    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".feed_post
         WHERE organization_id = $1 AND is_pinned = true`,
      [org],
    );
    expect(rows[0].n).toBe(1);
  });

  test('re-pinning the SAME post leaves exactly that post pinned (no self-unpin)', async () => {
    if (!H.dbReachable) return;
    const repo = new FeedPostRepository(H.db as any);
    const org = freshId();
    const post = await insertPost({ organizationId: org, isPinned: true });

    // pin() unpins everything in the org EXCEPT id, then pins id. Re-pinning the
    // already-pinned post must not unpin itself (ne(id) guard) → still pinned.
    const returned = await repo.pin(post, org);
    expect(returned.isPinned).toBe(true);
    expect((await readPost(post)).is_pinned).toBe(true);

    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".feed_post
         WHERE organization_id = $1 AND is_pinned = true`,
      [org],
    );
    expect(rows[0].n).toBe(1);
  });

  test('pinning in org A does NOT unpin a pinned post in org B (org-scoped unpin)', async () => {
    if (!H.dbReachable) return;
    const repo = new FeedPostRepository(H.db as any);
    const orgA = freshId();
    const orgB = freshId();

    const pinnedInB = await insertPost({ organizationId: orgB, isPinned: true });
    const toPinInA = await insertPost({ organizationId: orgA, isPinned: false });

    await repo.pin(toPinInA, orgA);

    // org B's pinned post is untouched — each org keeps its own single pin.
    expect((await readPost(pinnedInB)).is_pinned).toBe(true);
    expect((await readPost(toPinInA)).is_pinned).toBe(true);
  });

  test('pinning when several posts are (wrongly) pinned collapses the org to a single pin', async () => {
    if (!H.dbReachable) return;
    const repo = new FeedPostRepository(H.db as any);
    const org = freshId();

    // Adversarial seed: 3 posts already pinned in the same org.
    const p1 = await insertPost({ organizationId: org, isPinned: true });
    const p2 = await insertPost({ organizationId: org, isPinned: true });
    const target = await insertPost({ organizationId: org, isPinned: false });

    await repo.pin(target, org);

    expect((await readPost(target)).is_pinned).toBe(true);
    expect((await readPost(p1)).is_pinned).toBe(false);
    expect((await readPost(p2)).is_pinned).toBe(false);

    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".feed_post
         WHERE organization_id = $1 AND is_pinned = true`,
      [org],
    );
    expect(rows[0].n).toBe(1); // invariant restored regardless of dirty prior state
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// addReport / getReportCount — the primitives the 3-report auto-flag BR reads
// ═══════════════════════════════════════════════════════════════════════════

describe('FeedPostRepository.addReport + getReportCount (real DB)', () => {
  test('addReport inserts a report row AND increments report_count on the post', async () => {
    if (!H.dbReachable) return;
    const repo = new FeedPostRepository(H.db as any);
    const postId = await insertPost({ reportCount: 0 });
    const reporter = freshId();

    await repo.addReport({
      postId,
      reporterId: reporter,
      reason: 'spam',
      createdBy: reporter,
      updatedBy: reporter,
    } as any);

    // A report row is persisted with the reporter + reason.
    const reports = await readReports(postId);
    expect(reports).toHaveLength(1);
    expect(reports[0].reporter_id).toBe(reporter);
    expect(reports[0].reason).toBe('spam');

    // The denormalized report_count column was incremented atomically.
    expect((await readPost(postId)).report_count).toBe(1);
  });

  test('getReportCount counts the real report rows (drives the auto-flag threshold of 3)', async () => {
    if (!H.dbReachable) return;
    const repo = new FeedPostRepository(H.db as any);
    const postId = await insertPost({ reportCount: 0 });

    expect(await repo.getReportCount(postId)).toBe(0);

    // Three distinct reporters → count reaches the AUTO_FLAG_THRESHOLD (3) the
    // handler checks. The repo proves the count is correct at the boundary.
    for (let i = 0; i < 3; i++) {
      const r = freshId();
      await repo.addReport({
        postId, reporterId: r, reason: `r${i}`, createdBy: r, updatedBy: r,
      } as any);
    }

    expect(await repo.getReportCount(postId)).toBe(3);
    // Denormalized counter agrees with the counted rows after 3 reports.
    expect((await readPost(postId)).report_count).toBe(3);
  });

  test('getReportCount is post-scoped — reports on another post do not bleed in', async () => {
    if (!H.dbReachable) return;
    const repo = new FeedPostRepository(H.db as any);
    const postA = await insertPost();
    const postB = await insertPost();

    const r = freshId();
    await repo.addReport({ postId: postA, reporterId: r, reason: null, createdBy: r, updatedBy: r } as any);
    await repo.addReport({ postId: postA, reporterId: freshId(), reason: null, createdBy: r, updatedBy: r } as any);
    await repo.addReport({ postId: postB, reporterId: freshId(), reason: null, createdBy: r, updatedBy: r } as any);

    expect(await repo.getReportCount(postA)).toBe(2);
    expect(await repo.getReportCount(postB)).toBe(1);
  });

  test('getReportCount returns 0 for a post that has never been reported', async () => {
    if (!H.dbReachable) return;
    const repo = new FeedPostRepository(H.db as any);
    const postId = await insertPost();
    expect(await repo.getReportCount(postId)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// softDelete — sets the flags list() filters on, plus removed metadata
// ═══════════════════════════════════════════════════════════════════════════

describe('FeedPostRepository.softDelete — drives the list exclusion (real DB)', () => {
  test('flips is_removed + status=removed + stamps removedBy/reason, and the post then drops out of list()', async () => {
    if (!H.dbReachable) return;
    const repo = new FeedPostRepository(H.db as any);
    const org = freshId();
    const post = await insertPost({ organizationId: org, status: 'published', isRemoved: false });
    const officer = freshId();

    const before = await repo.list(org);
    expect(before.data.map((p) => p.id)).toContain(post);
    expect(before.total).toBe(1);

    const removed = await repo.softDelete(post, officer, 'violates guidelines');
    expect(removed.isRemoved).toBe(true);
    expect(removed.status).toBe('removed');
    expect(removed.removedBy).toBe(officer);
    expect(removed.removedReason).toBe('violates guidelines');

    // Persisted: the moderation metadata is durable.
    const row = await readPost(post);
    expect(row.is_removed).toBe(true);
    expect(row.status).toBe('removed');
    expect(row.removed_by).toBe(officer);
    expect(row.removed_reason).toBe('violates guidelines');

    // End-to-end with list(): the removed post is now excluded and total drops.
    const after = await repo.list(org);
    expect(after.data.map((p) => p.id)).not.toContain(post);
    expect(after.total).toBe(0);
  });

  test('softDelete without a reason persists a null removed_reason', async () => {
    if (!H.dbReachable) return;
    const repo = new FeedPostRepository(H.db as any);
    const post = await insertPost();
    const officer = freshId();
    const removed = await repo.softDelete(post, officer);
    expect(removed.removedReason).toBeNull();
    expect((await readPost(post)).removed_reason).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// muteAuthor / getMutedAuthors — org-scoped read
// ═══════════════════════════════════════════════════════════════════════════

describe('FeedPostRepository.muteAuthor + getMutedAuthors — org-scoping (real DB)', () => {
  test('getMutedAuthors returns only this member\'s mutes within the requested org', async () => {
    if (!H.dbReachable) return;
    const repo = new FeedPostRepository(H.db as any);
    const member = freshId();
    const orgA = freshId();
    const orgB = freshId();
    const mutedX = freshId();
    const mutedY = freshId();
    const mutedInOtherOrg = freshId();

    await repo.muteAuthor({ memberId: member, mutedAuthorId: mutedX, organizationId: orgA, createdBy: member, updatedBy: member } as any);
    await repo.muteAuthor({ memberId: member, mutedAuthorId: mutedY, organizationId: orgA, createdBy: member, updatedBy: member } as any);
    // Same member, DIFFERENT org → must not appear in orgA's mute list.
    await repo.muteAuthor({ memberId: member, mutedAuthorId: mutedInOtherOrg, organizationId: orgB, createdBy: member, updatedBy: member } as any);
    // DIFFERENT member in orgA → must not appear for `member`.
    await repo.muteAuthor({ memberId: freshId(), mutedAuthorId: freshId(), organizationId: orgA, createdBy: member, updatedBy: member } as any);

    const muted = await repo.getMutedAuthors(member, orgA);
    expect(new Set(muted)).toEqual(new Set([mutedX, mutedY]));
  });

  test('unmuteAuthor removes exactly the one (member, author, org) mute row', async () => {
    if (!H.dbReachable) return;
    const repo = new FeedPostRepository(H.db as any);
    const member = freshId();
    const org = freshId();
    const a1 = freshId();
    const a2 = freshId();
    await repo.muteAuthor({ memberId: member, mutedAuthorId: a1, organizationId: org, createdBy: member, updatedBy: member } as any);
    await repo.muteAuthor({ memberId: member, mutedAuthorId: a2, organizationId: org, createdBy: member, updatedBy: member } as any);

    await repo.unmuteAuthor(member, a1, org);

    const muted = await repo.getMutedAuthors(member, org);
    expect(muted).toEqual([a2]); // a1 removed, a2 untouched
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// create / get round-trip (defaults + read-by-id, foundation for the above)
// ═══════════════════════════════════════════════════════════════════════════

describe('FeedPostRepository.create + get (real DB)', () => {
  test('create persists with schema defaults and get reads it back', async () => {
    if (!H.dbReachable) return;
    const repo = new FeedPostRepository(H.db as any);
    const org = freshId();

    const created = await repo.create({
      organizationId: org,
      authorId: AUTHOR,
      postType: 'announcement',
      bodyText: 'Welcome to the feed',
    } as any);

    // Schema defaults applied on insert.
    expect(created.status).toBe('published');
    expect(created.visibility).toBe('org');
    expect(created.isPinned).toBe(false);
    expect(created.isRemoved).toBe(false);
    expect(created.isSponsored).toBe(false);
    expect(created.reportCount).toBe(0);

    const fetched = await repo.get(created.id);
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.bodyText).toBe('Welcome to the feed');
  });

  test('get returns undefined for a non-existent id', async () => {
    if (!H.dbReachable) return;
    const repo = new FeedPostRepository(H.db as any);
    expect(await repo.get(freshId())).toBeUndefined();
  });
});

// Reference imports so unused-symbol lint stays quiet if a const goes unused in
// a future edit; ORG_A is the default org used by insertPost.
void ORG_B;
