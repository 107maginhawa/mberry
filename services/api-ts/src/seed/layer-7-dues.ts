/**
 * Layer 7: Dues + privacy coverage seeding
 *
 * Seeds realistic, FK-coherent data for previously-unseeded dues + person
 * tables: AR aging buckets, dues reminder logs, dues category overrides,
 * webhook retry logs, payment tokens, and DPA data exports.
 *
 * Idempotent: each block checks for existence before inserting and is
 * wrapped in its own try/catch so one failure never aborts the rest.
 */

import { sql } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/node-postgres';
import { daysAgo, daysFromNow } from './helpers';

// Schema imports (@/ = src/)
import { agingBuckets, duesReminderLogs } from '@/handlers/dues/repos/dues.schema';
import { duesCategoryOverrides, webhookRetryLogs } from '@/handlers/dues/repos/dues-payments.schema';
import { paymentTokens } from '@/handlers/dues/repos/payment-token.schema';
import { dataExports } from '@/handlers/person/repos/data-export.schema';

export async function seedDuesCoverage(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  presidentPersonId: string,
  memberPersonIds: string[],
) {
  console.log('  Dues + privacy coverage (aging, reminders, overrides, webhooks, tokens, exports)...');

  // ─── agingBuckets — AR aging snapshots (centavos PHP) ───
  try {
    const existing = (await db.execute(
      sql`SELECT id FROM aging_bucket WHERE organization_id = ${orgId} LIMIT 1`,
    )) as unknown as { rows: Array<{ id: string }> };
    if (existing.rows?.length === 0) {
      type NewAging = typeof agingBuckets.$inferInsert;
      const snapshots: Array<Pick<NewAging,
        'asOfDate' | 'current' | 'thirtyDay' | 'sixtyDay' | 'ninetyDay' | 'overNinety' | 'totalOutstanding'>> = [
        // Oldest snapshot — most balances in current bucket
        { asOfDate: daysAgo(90).toISOString().split('T')[0]!, current: 4_500_00, thirtyDay: 1_200_00, sixtyDay: 600_00, ninetyDay: 300_00, overNinety: 150_00, totalOutstanding: 6_750_00 },
        { asOfDate: daysAgo(60).toISOString().split('T')[0]!, current: 3_800_00, thirtyDay: 1_500_00, sixtyDay: 900_00, ninetyDay: 400_00, overNinety: 250_00, totalOutstanding: 6_850_00 },
        { asOfDate: daysAgo(30).toISOString().split('T')[0]!, current: 3_200_00, thirtyDay: 1_800_00, sixtyDay: 1_100_00, ninetyDay: 550_00, overNinety: 400_00, totalOutstanding: 7_050_00 },
        // Latest snapshot — balances aged into older buckets
        { asOfDate: daysAgo(1).toISOString().split('T')[0]!, current: 2_900_00, thirtyDay: 2_100_00, sixtyDay: 1_400_00, ninetyDay: 700_00, overNinety: 650_00, totalOutstanding: 7_750_00 },
      ];
      for (const s of snapshots) {
        await db.insert(agingBuckets).values({ organizationId: orgId, ...s });
      }
      console.log(`    ✓ ${snapshots.length} aging buckets`);
    } else {
      console.log('    ✓ aging buckets (already present)');
    }
  } catch (e) {
    console.log(`    (aging bucket seed failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  // ─── duesReminderLogs — sent reminders across channels/stages ───
  // org/person/duesConfig are uuid columns. We need a dues_config id; reuse the
  // legacy dues_config table if present, else skip gracefully.
  try {
    const cfg = (await db.execute(
      sql`SELECT id FROM dues_config WHERE organization_id = ${orgId} LIMIT 1`,
    )) as unknown as { rows: Array<{ id: string }> };
    const duesConfigId = cfg.rows?.[0]?.id;
    if (!duesConfigId) {
      console.log('    (dues reminder logs skipped: no dues_config row)');
    } else {
      const existing = (await db.execute(
        sql`SELECT id FROM dues_reminder_log WHERE organization_id = ${orgId} LIMIT 1`,
      )) as unknown as { rows: Array<{ id: string }> };
      if (existing.rows?.length === 0) {
        type NewReminder = typeof duesReminderLogs.$inferInsert;
        // daysOffset: negative = before due date, positive = after (overdue)
        const reminders: Array<Pick<NewReminder, 'channel' | 'daysOffset' | 'periodKey' | 'sentAt'>> = [
          { channel: 'in-app', daysOffset: -30, periodKey: '2026', sentAt: daysAgo(45) },
          { channel: 'email', daysOffset: -7, periodKey: '2026', sentAt: daysAgo(22) },
          { channel: 'push', daysOffset: 0, periodKey: '2026', sentAt: daysAgo(15) },
          { channel: 'email', daysOffset: 14, periodKey: '2026', sentAt: daysAgo(1) },
        ];
        let count = 0;
        for (let i = 0; i < reminders.length; i++) {
          const r = reminders[i]!;
          const personId = memberPersonIds[i % memberPersonIds.length]!;
          await db.insert(duesReminderLogs).values({
            organizationId: orgId,
            personId,
            duesConfigId,
            periodKey: r.periodKey,
            daysOffset: r.daysOffset,
            channel: r.channel,
            sentAt: r.sentAt,
          });
          count++;
        }
        console.log(`    ✓ ${count} dues reminder logs (in-app, email, push across stages)`);
      } else {
        console.log('    ✓ dues reminder logs (already present)');
      }
    }
  } catch (e) {
    console.log(`    (dues reminder log seed failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  // ─── duesCategoryOverrides — per-category dues amount overrides ───
  // FK: dues_org_config.id + membership_category.id. Query both; skip if absent.
  try {
    const orgCfg = (await db.execute(
      sql`SELECT id FROM dues_org_config WHERE organization_id = ${orgId} LIMIT 1`,
    )) as unknown as { rows: Array<{ id: string }> };
    const duesConfigId = orgCfg.rows?.[0]?.id;
    const cats = (await db.execute(
      sql`SELECT id FROM membership_category WHERE organization_id = ${orgId} LIMIT 3`,
    )) as unknown as { rows: Array<{ id: string }> };
    const categoryRows = cats.rows ?? [];
    if (!duesConfigId || categoryRows.length === 0) {
      console.log('    (dues category overrides skipped: missing dues_org_config or membership_category rows)');
    } else {
      const overrideAmounts = [1_500_00, 2_500_00, 500_00]; // student, regular, senior (centavos)
      let count = 0;
      for (let i = 0; i < categoryRows.length; i++) {
        const categoryId = categoryRows[i]!.id;
        const existing = (await db.execute(
          sql`SELECT id FROM dues_category_override WHERE dues_config_id = ${duesConfigId} AND category_id = ${categoryId} LIMIT 1`,
        )) as unknown as { rows: Array<{ id: string }> };
        if (existing.rows?.length === 0) {
          await db.insert(duesCategoryOverrides).values({
            organizationId: orgId,
            duesConfigId,
            categoryId,
            overrideAmount: overrideAmounts[i % overrideAmounts.length]!,
          });
          count++;
        }
      }
      console.log(`    ✓ ${count} dues category overrides`);
    }
  } catch (e) {
    console.log(`    (dues category override seed failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  // ─── webhookRetryLogs — failed-then-succeeded gateway webhook ───
  try {
    const idempotencyKey = 'seed-webhook-paymongo-evt-0001';
    const existing = (await db.execute(
      sql`SELECT id FROM webhook_retry_log WHERE idempotency_key = ${idempotencyKey} LIMIT 1`,
    )) as unknown as { rows: Array<{ id: string }> };
    if (existing.rows?.length === 0) {
      // Recovered after retries — final status completed
      await db.insert(webhookRetryLogs).values({
        idempotencyKey,
        provider: 'paymongo',
        eventType: 'payment.paid',
        payload: { id: 'evt_seed_0001', type: 'payment.paid', data: { amount: 250000, currency: 'PHP' } },
        organizationId: orgId,
        status: 'completed',
        retryCount: 2,
        lastRetryAt: daysAgo(1),
        lastError: 'Transient 503 from downstream — recovered on retry #2',
      });
      // A second one still pending retry to exercise the dead-letter pipeline
      const ipk2 = 'seed-webhook-paymongo-evt-0002';
      const existing2 = (await db.execute(
        sql`SELECT id FROM webhook_retry_log WHERE idempotency_key = ${ipk2} LIMIT 1`,
      )) as unknown as { rows: Array<{ id: string }> };
      if (existing2.rows?.length === 0) {
        await db.insert(webhookRetryLogs).values({
          idempotencyKey: ipk2,
          provider: 'paymongo',
          eventType: 'payment.failed',
          payload: { id: 'evt_seed_0002', type: 'payment.failed', data: { amount: 200000, currency: 'PHP' } },
          organizationId: orgId,
          status: 'pending_retry',
          retryCount: 1,
          lastRetryAt: daysAgo(1),
          nextRetryAt: daysFromNow(1),
          lastError: 'Handler returned 500 — scheduled for retry',
        });
      }
      console.log('    ✓ 2 webhook retry logs (completed-after-retry, pending_retry)');
    } else {
      console.log('    ✓ webhook retry logs (already present)');
    }
  } catch (e) {
    console.log(`    (webhook retry log seed failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  // ─── paymentTokens — officer-generated one-tap payment links (masked) ───
  try {
    type NewToken = typeof paymentTokens.$inferInsert;
    const tokens: Array<Pick<NewToken, 'tokenHash' | 'amount' | 'currency' | 'expiresAt' | 'usedAt'>> = [
      // Active unused token (saved card scenario, masked hash)
      { tokenHash: 'seed-tok-' + 'a'.repeat(64), amount: 250000, currency: 'PHP', expiresAt: daysFromNow(2), usedAt: null },
      // Already-used token (single-use, consumed)
      { tokenHash: 'seed-tok-' + 'b'.repeat(64), amount: 150000, currency: 'PHP', expiresAt: daysFromNow(1), usedAt: daysAgo(1) },
      // Expired unused token
      { tokenHash: 'seed-tok-' + 'c'.repeat(64), amount: 200000, currency: 'PHP', expiresAt: daysAgo(2), usedAt: null },
    ];
    let count = 0;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]!;
      const personId = memberPersonIds[i % memberPersonIds.length]!;
      const existing = (await db.execute(
        sql`SELECT id FROM payment_token WHERE token_hash = ${t.tokenHash} LIMIT 1`,
      )) as unknown as { rows: Array<{ id: string }> };
      if (existing.rows?.length === 0) {
        await db.insert(paymentTokens).values({
          tokenHash: t.tokenHash,
          personId,
          organizationId: orgId,
          amount: t.amount,
          currency: t.currency,
          expiresAt: t.expiresAt,
          usedAt: t.usedAt,
          createdByOfficer: presidentPersonId,
        });
        count++;
      }
    }
    console.log(`    ✓ ${count} payment tokens (active, used, expired)`);
  } catch (e) {
    console.log(`    (payment token seed failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  // ─── dataExports — DPA portability requests across lifecycle ───
  try {
    const personPool = [presidentPersonId, ...memberPersonIds];
    type NewExport = typeof dataExports.$inferInsert;
    const exports: Array<Pick<NewExport, 'status' | 'requestedAt' | 'expiresAt' | 'downloadUrl' | 'payload'>> = [
      // Completed/ready export with a download URL
      { status: 'ready', requestedAt: daysAgo(2), expiresAt: daysFromNow(5), downloadUrl: 'https://exports.example.test/seed-export-ready.json', payload: { profile: { redacted: true }, generatedAt: daysAgo(2).toISOString() } },
      // In-progress export
      { status: 'processing', requestedAt: daysAgo(1), expiresAt: null, downloadUrl: null, payload: null },
      // Freshly requested export
      { status: 'requested', requestedAt: daysAgo(1), expiresAt: null, downloadUrl: null, payload: null },
    ];
    let count = 0;
    for (let i = 0; i < exports.length; i++) {
      const ex = exports[i]!;
      const personId = personPool[i % personPool.length]!;
      const existing = (await db.execute(
        sql`SELECT id FROM data_export WHERE person_id = ${personId} AND status = ${ex.status}::data_export_status LIMIT 1`,
      )) as unknown as { rows: Array<{ id: string }> };
      if (existing.rows?.length === 0) {
        await db.insert(dataExports).values({
          personId,
          status: ex.status,
          requestedAt: ex.requestedAt,
          expiresAt: ex.expiresAt,
          downloadUrl: ex.downloadUrl,
          payload: ex.payload,
        });
        count++;
      }
    }
    console.log(`    ✓ ${count} data exports (ready, processing, requested)`);
  } catch (e) {
    console.log(`    (data export seed failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  console.log('  Dues + privacy coverage complete.');
}
