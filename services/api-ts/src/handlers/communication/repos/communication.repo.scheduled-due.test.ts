/**
 * CONTINUE-51 (announcement empty-org 500) — DB-integration test.
 *
 * Root cause: the `communication.processScheduled` cron (runs every 5 min) called
 * `repo.list('', { status: 'scheduled' })` with an EMPTY organizationId. `list()`
 * always filters `eq(announcement.organization_id, orgId)`, and `organization_id`
 * is a `uuid` column, so Postgres threw
 *   `invalid input syntax for type uuid: ""`
 * on every tick — spamming 500s through the whole e2e run and silently breaking
 * scheduled delivery (the cron never dispatched anything).
 *
 * Fix: a dedicated, deliberately NON-org-scoped query `findScheduledDue(limit)`
 * that returns scheduled announcements whose `scheduledAt <= now()` ACROSS every
 * org — which is exactly what a cross-org cron needs. `list()` stays strict and
 * now throws loudly on an empty org instead of casting `''` to uuid.
 *
 * Drives REAL Postgres inside a rolled-back transaction (no residue). Requires a
 * running, migrated Postgres (DATABASE_URL); skips cleanly otherwise — matching
 * the sibling FIX-008 suite's skip contract.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { CommunicationsRepository } from './communication.repo';

const DATABASE_URL = process.env['DATABASE_URL'];
const SKIP = !DATABASE_URL;

describe('CommunicationsRepository.findScheduledDue — cross-org cron query (CONTINUE-51)', () => {
  let db: DatabaseInstance | null = null;

  beforeAll(async () => {
    if (SKIP) return;
    const { createDatabase } = await import('@/core/database');
    db = createDatabase({ url: DATABASE_URL! });
  });

  afterAll(async () => {
    if (db) {
      const { closeDatabaseConnection } = await import('@/core/database');
      await closeDatabaseConnection(db);
    }
  });

  test('returns due scheduled announcements across orgs; excludes future + non-scheduled; list("") throws', async () => {
    if (SKIP || !db) {
      // eslint-disable-next-line no-console
      console.log('Skipping CONTINUE-51 DB test: no DATABASE_URL / connection');
      return;
    }

    // author_id is an FK → person.id. CI's bare postgres is unmigrated, so a
    // missing/empty `person` relation means skip-cleanly, not fail.
    let authorId: string | undefined;
    try {
      const authorRows = await db.execute(sql`SELECT id FROM person LIMIT 1`);
      authorId = (authorRows.rows?.[0] as { id?: string } | undefined)?.id;
    } catch {
      // eslint-disable-next-line no-console
      console.log('Skipping CONTINUE-51 DB test: schema not migrated in this env');
      return;
    }
    if (!authorId) {
      // eslint-disable-next-line no-console
      console.log('Skipping CONTINUE-51 DB test: no seeded person to author an announcement');
      return;
    }

    const orgA = crypto.randomUUID();
    const orgB = crypto.randomUUID();
    const past = new Date(Date.now() - 60_000); // 1 min ago — due
    const longPast = new Date(Date.now() - 300_000); // 5 min ago — due
    const future = new Date(Date.now() + 3_600_000); // 1 hr ahead — not due

    const ROLLBACK = '__continue51_rollback__';
    try {
      await db.transaction(async (tx) => {
        const repo = new CommunicationsRepository(tx as never);

        // DUE, orgA
        const dueA = await repo.create({
          organizationId: orgA, authorId, title: 'Due A', content: 'x',
          status: 'scheduled', scheduledAt: past,
        } as never);
        // DUE, orgB — proves the query is cross-org, not single-org
        const dueB = await repo.create({
          organizationId: orgB, authorId, title: 'Due B', content: 'x',
          status: 'scheduled', scheduledAt: longPast,
        } as never);
        // FUTURE scheduled — must be excluded
        const futureC = await repo.create({
          organizationId: orgA, authorId, title: 'Future C', content: 'x',
          status: 'scheduled', scheduledAt: future,
        } as never);
        // DRAFT (not scheduled) — must be excluded
        const draftD = await repo.create({
          organizationId: orgB, authorId, title: 'Draft D', content: 'x',
          status: 'draft',
        } as never);

        const due = await repo.findScheduledDue(100);
        const ids = new Set(due.map((a) => a.id));

        // Both due announcements returned, regardless of org.
        expect(ids.has(dueA.id)).toBe(true);
        expect(ids.has(dueB.id)).toBe(true);
        // Future + draft excluded.
        expect(ids.has(futureC.id)).toBe(false);
        expect(ids.has(draftD.id)).toBe(false);
        // Every returned row is actually scheduled.
        expect(due.every((a) => a.status === 'scheduled')).toBe(true);

        // Guard: list() must reject an empty org loudly (no raw uuid 500).
        let threw = false;
        try {
          await repo.list('', { status: 'scheduled' });
        } catch {
          threw = true;
        }
        expect(threw).toBe(true);

        throw new Error(ROLLBACK);
      });
    } catch (e) {
      if ((e as Error).message !== ROLLBACK) throw e;
    }
  });
});
