/**
 * FIX-008 (delivery stats surfacing) — DB-integration test.
 *
 * Root cause: `CommunicationsRepository.list` selected announcements WITHOUT
 * joining `announcement_stats`, so the analytics dashboard (which reads
 * `announcement.stats` off the list endpoint, GET /communications/announcements/{org})
 * always saw `stats === undefined` → every KPI rendered 0 even after a real
 * fan-out wrote stats rows. `get()` already joins stats; `list()` did not.
 *
 * This test drives the REAL Postgres join: create an announcement, write a stats
 * row, then `list()` and assert the returned row carries the populated `stats`.
 * Runs inside a transaction that is rolled back, so it leaves no residue.
 *
 * Requires a running Postgres (DATABASE_URL). Skips cleanly otherwise.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { CommunicationsRepository } from './communication.repo';

const DATABASE_URL = process.env['DATABASE_URL'];
const SKIP = !DATABASE_URL;

describe('CommunicationsRepository.list — stats join (FIX-008)', () => {
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

  test('list() returns populated announcement_stats per announcement after a fan-out wrote them', async () => {
    if (SKIP || !db) {
      // eslint-disable-next-line no-console
      console.log('Skipping FIX-008 DB test: no DATABASE_URL / connection');
      return;
    }

    // A real author is required (announcement.author_id FK → person.id).
    const authorRows = await db.execute(sql`SELECT id FROM person LIMIT 1`);
    const authorId = (authorRows.rows?.[0] as { id?: string } | undefined)?.id;
    if (!authorId) {
      // eslint-disable-next-line no-console
      console.log('Skipping FIX-008 DB test: no seeded person to author an announcement');
      return;
    }

    const orgId = crypto.randomUUID();

    const ROLLBACK = '__fix008_rollback__';
    try {
      await db.transaction(async (tx) => {
        const repo = new CommunicationsRepository(tx as never);

        const announcement = await repo.create({
          organizationId: orgId,
          authorId,
          title: 'FIX-008 stats join',
          content: 'body',
          status: 'sent',
        } as never);

        await repo.createStats(announcement.id, 42, orgId, {
          emailSent: 40,
          pushDelivered: 35,
          inappViews: 28,
        });

        const { data, total } = await repo.list(orgId, { status: 'sent' });

        expect(total).toBe(1);
        expect(data).toHaveLength(1);
        // The whole point of FIX-008: stats are joined onto the list row.
        const row = data[0] as {
          id: string;
          stats?: { recipients: number; emailSent: number; pushDelivered: number; inappViews: number };
        };
        expect(row.id).toBe(announcement.id);
        expect(row.stats).toBeDefined();
        expect(row.stats!.recipients).toBe(42);
        expect(row.stats!.emailSent).toBe(40);
        expect(row.stats!.pushDelivered).toBe(35);
        expect(row.stats!.inappViews).toBe(28);

        throw new Error(ROLLBACK);
      });
    } catch (e) {
      if ((e as Error).message !== ROLLBACK) throw e;
    }
  });
});
