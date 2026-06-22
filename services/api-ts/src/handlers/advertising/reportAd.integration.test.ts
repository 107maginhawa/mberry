/**
 * reportAd → ad_report persistence + 3-in-7-day auto-pause → admin notification
 * fan-out — real-PG inter-module characterization (createScratch).
 *
 * Slice W3 advertising S6 (axis inter-module). The mock-ctx unit suite
 * (reportAd.test.ts) stubs every repo prototype, so it never proves the report
 * actually lands in `ad_report`, that the rolling-window count is computed from
 * persisted rows, that the auto-pause reverts the creative `status` in the DB, or
 * that the admin fan-out writes a real `notification` row with the right columns.
 *
 * This suite drives the REAL handler (`reportAd`), which constructs a real
 * CreativeRepository + NotificationRepository (+ PersonRepository) against an
 * isolated scratch schema, and asserts:
 *
 *  - report persistence: each reportAd inserts an `ad_report` row
 *    (creative_id / reporter_person_id / reason / organization_id);
 *    countReportsWithinDays(7) reflects the persisted rows.
 *  - org isolation (404-not-403): reporting a creative whose organization_id !=
 *    ctx org → NotFoundError and NO `ad_report` row written (reportAd.ts:49-51).
 *  - auto-pause threshold (M16-R5): on an `approved` creative the 3rd report
 *    within 7 days (REPORT_THRESHOLD=3) reverts status → 'pending' (read-back) and
 *    returns autoPaused:true; the 2nd report does NOT pause. An already
 *    pending/rejected creative is NOT re-paused but the report is still recorded.
 *  - notification fan-out: after auto-pause exactly one `notification` row for
 *    creative.created_by with type='system', related_entity_type='ad_creative',
 *    related_entity=creativeId (reportAd.ts:88-97). And notification failure is
 *    non-fatal — the report response still returns count/autoPaused (try/catch
 *    reportAd.ts:98-100).
 *
 * Isolation: createScratch copies the real public structures (LIKE ... INCLUDING
 * ALL — faithful enums/NOT NULL/defaults; FKs dropped), so we seed parents
 * directly. If Postgres is unreachable the suite skips cleanly. Source is NOT
 * modified — we drive production handler code.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { reportAd } from './reportAd';
import { NotFoundError } from '@/core/errors';
import { CreativeRepository } from './repos/creative.repo';
import { seedAdvertiser, seedCampaign, seedCreative } from './repos/advertiser.repo.integration.test';

const noopLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => noopLogger,
};

/** Build a ValidatedContext-shaped object backed by the real scratch db. */
function makeReportCtx(
  H: ScratchDb,
  opts: { userId: string; orgId: string; creativeId: string; reason: string },
) {
  let captured: { data: any; status: number } = { data: null, status: 0 };
  return {
    get: (key: string) =>
      ({
        user: { id: opts.userId, name: 'Member' },
        database: H.db,
        logger: noopLogger,
        organizationId: opts.orgId,
        requestId: 'trace-report',
      })[key],
    set: () => {},
    req: {
      valid: (type: string) =>
        type === 'param'
          ? { creativeId: opts.creativeId }
          : type === 'json'
            ? { reason: opts.reason }
            : {},
    },
    json: (data: any, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
  } as any;
}

/** Count ad_report rows for a creative (scratch schema). */
async function reportRows(H: ScratchDb, creativeId: string): Promise<any[]> {
  const { rows } = await H.scopedPool.query(
    `SELECT * FROM "${H.schema}".ad_report WHERE creative_id = $1 ORDER BY created_at ASC`,
    [creativeId],
  );
  return rows;
}

/** Read all notification rows for one recipient (scratch schema). */
async function notifsFor(H: ScratchDb, recipient: string): Promise<any[]> {
  const { rows } = await H.scopedPool.query(
    `SELECT * FROM "${H.schema}".notification WHERE recipient_id = $1 ORDER BY created_at ASC`,
    [recipient],
  );
  return rows;
}

/** Seed advertiser → active campaign → creative (status configurable); returns creativeId. */
async function seedCreativeRow(
  H: ScratchDb,
  org: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const advId = await seedAdvertiser(H, org);
  const campId = await seedCampaign(H, org, advId, { status: 'active' });
  return seedCreative(H, org, campId, overrides);
}

describe('reportAd → ad_report + auto-pause + notification fan-out (real-PG, createScratch)', () => {
  let H: ScratchDb;
  beforeAll(async () => {
    H = await createScratch([
      'advertiser',
      'ad_campaign',
      'ad_creative',
      'ad_report',
      'notification',
      'person',
    ]);
  });
  afterAll(async () => {
    await H?.teardown();
  });

  // ── report persistence ────────────────────────────────────────────────────
  test('persists an ad_report row with creative/reporter/reason/org and reflects it in countReportsWithinDays(7)', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const reporter = crypto.randomUUID();
    const owner = crypto.randomUUID();
    const creativeId = await seedCreativeRow(H, org, { status: 'approved', createdBy: owner });

    const ctx = makeReportCtx(H, { userId: reporter, orgId: org, creativeId, reason: 'Misleading ad' });
    await reportAd(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    expect(data.creativeId).toBe(creativeId);
    expect(data.reportCount).toBe(1);
    expect(data.autoPaused).toBe(false);

    // The report is a durable row — not simulated.
    const rows = await reportRows(H, creativeId);
    expect(rows).toHaveLength(1);
    expect(rows[0].creative_id).toBe(creativeId);
    expect(rows[0].reporter_person_id).toBe(reporter);
    expect(rows[0].reason).toBe('Misleading ad');
    expect(rows[0].organization_id).toBe(org);

    // The handler's windowed count is computed from persisted rows.
    const repo = new CreativeRepository(H.db as never);
    expect(await repo.countReportsWithinDays(creativeId, 7)).toBe(1);
  });

  // ── org isolation: 404, not 403, and NO report written ─────────────────────
  test('cross-org report → NotFoundError and NO ad_report row written (404-not-403, no existence leak)', async () => {
    if (!H.dbReachable) return;
    const orgA = crypto.randomUUID();
    const orgB = crypto.randomUUID();
    const reporter = crypto.randomUUID();
    // The creative lives in orgB...
    const creativeId = await seedCreativeRow(H, orgB, { status: 'approved' });

    // ...but the reporter is scoped to orgA.
    const ctx = makeReportCtx(H, { userId: reporter, orgId: orgA, creativeId, reason: 'cross-org poison' });
    await expect(reportAd(ctx)).rejects.toBeInstanceOf(NotFoundError);

    // No report persisted — the early NotFound throw happens before createReport.
    const rows = await reportRows(H, creativeId);
    expect(rows).toHaveLength(0);
  });

  // ── auto-pause threshold (M16-R5) ──────────────────────────────────────────
  test('M16-R5: 2nd report does NOT pause; 3rd report within 7d reverts status→pending + autoPaused:true', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const owner = crypto.randomUUID();
    const creativeId = await seedCreativeRow(H, org, { status: 'approved', createdBy: owner });

    // 1st report — below threshold.
    const ctx1 = makeReportCtx(H, { userId: crypto.randomUUID(), orgId: org, creativeId, reason: 'r1' });
    await reportAd(ctx1);
    expect(ctx1._captured().data.reportCount).toBe(1);
    expect(ctx1._captured().data.autoPaused).toBe(false);

    // 2nd report — still below threshold, NO pause.
    const ctx2 = makeReportCtx(H, { userId: crypto.randomUUID(), orgId: org, creativeId, reason: 'r2' });
    await reportAd(ctx2);
    expect(ctx2._captured().data.reportCount).toBe(2);
    expect(ctx2._captured().data.autoPaused).toBe(false);
    // Creative still serving (approved) after the 2nd report.
    const mid = await H.scopedPool.query(
      `SELECT status FROM "${H.schema}".ad_creative WHERE id=$1`,
      [creativeId],
    );
    expect(mid.rows[0].status).toBe('approved');

    // 3rd report — threshold met → auto-pause (status reverts to 'pending').
    const ctx3 = makeReportCtx(H, { userId: crypto.randomUUID(), orgId: org, creativeId, reason: 'r3' });
    await reportAd(ctx3);
    expect(ctx3._captured().data.reportCount).toBe(3);
    expect(ctx3._captured().data.autoPaused).toBe(true);

    // Read-back: the creative was reverted to 'pending' (the no-`paused`-enum behavior).
    const after = await H.scopedPool.query(
      `SELECT status FROM "${H.schema}".ad_creative WHERE id=$1`,
      [creativeId],
    );
    expect(after.rows[0].status).toBe('pending');

    // All three reports are durable.
    expect(await reportRows(H, creativeId)).toHaveLength(3);
  });

  test('M16-R5: an already-pending creative is NOT re-paused but the report is still recorded', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    // Creative is already pending (not serving) and already over threshold elsewhere.
    const creativeId = await seedCreativeRow(H, org, { status: 'pending' });

    // Pre-seed 5 reports directly so the window count is already past threshold.
    const repo = new CreativeRepository(H.db as never);
    for (let i = 0; i < 5; i++) {
      await repo.createReport({
        organizationId: org,
        creativeId,
        reporterPersonId: crypto.randomUUID(),
        reason: `pre-${i}`,
      });
    }

    const ctx = makeReportCtx(H, { userId: crypto.randomUUID(), orgId: org, creativeId, reason: 'pile-on' });
    await reportAd(ctx);
    const { data } = ctx._captured();
    // Over threshold, but the creative was already non-serving → no re-pause.
    expect(data.reportCount).toBe(6);
    expect(data.autoPaused).toBe(false);

    // The report is still recorded (m16 §4: "Ad already paused — report still recorded").
    expect(await reportRows(H, creativeId)).toHaveLength(6);

    // Status untouched — still pending (no re-pause write).
    const after = await H.scopedPool.query(
      `SELECT status FROM "${H.schema}".ad_creative WHERE id=$1`,
      [creativeId],
    );
    expect(after.rows[0].status).toBe('pending');
  });

  // ── notification fan-out on auto-pause ─────────────────────────────────────
  test('on auto-pause, fires exactly one notification to creative.created_by (type=system, related_entity=creativeId)', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const owner = crypto.randomUUID(); // creative.created_by = the notification recipient
    const creativeId = await seedCreativeRow(H, org, { status: 'approved', createdBy: owner });

    // Drive 3 reports to cross the threshold.
    for (let i = 0; i < 3; i++) {
      const ctx = makeReportCtx(H, { userId: crypto.randomUUID(), orgId: org, creativeId, reason: `rep-${i}` });
      await reportAd(ctx);
    }

    // Exactly one in-app notification to the creative owner.
    const rows = await notifsFor(H, owner);
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.recipient_id).toBe(owner);
    expect(n.organization_id).toBe(org);
    expect(n.type).toBe('system');
    expect(n.channel).toBe('in-app');
    expect(n.status).toBe('sent');
    expect(n.related_entity_type).toBe('ad_creative');
    expect(n.related_entity).toBe(creativeId);
    expect(n.title).toBe('Ad creative auto-paused');
    expect(n.message).toContain('3 member reports');
  });

  test('a creative with no created_by auto-pauses with no notification (and the report still returns)', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    // createdBy = null → the fan-out branch (if creative.createdBy) is skipped.
    const creativeId = await seedCreativeRow(H, org, { status: 'approved', createdBy: null });

    for (let i = 0; i < 3; i++) {
      const ctx = makeReportCtx(H, { userId: crypto.randomUUID(), orgId: org, creativeId, reason: `rep-${i}` });
      await reportAd(ctx);
      if (i === 2) {
        // The auto-pause still happened and the response is intact.
        expect(ctx._captured().data.autoPaused).toBe(true);
        expect(ctx._captured().data.reportCount).toBe(3);
      }
    }

    // Creative paused, reports persisted, but zero notifications anywhere for null recipient.
    const after = await H.scopedPool.query(
      `SELECT status FROM "${H.schema}".ad_creative WHERE id=$1`,
      [creativeId],
    );
    expect(after.rows[0].status).toBe('pending');
    expect(await reportRows(H, creativeId)).toHaveLength(3);
  });

  test('notification failure is non-fatal — the report response still returns count/autoPaused', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const owner = crypto.randomUUID();
    const creativeId = await seedCreativeRow(H, org, { status: 'approved', createdBy: owner });

    // Force the notification insert to fail by stubbing the prototype to throw
    // for THIS test only — proving the try/catch at reportAd.ts:98-100 swallows it.
    const NotifRepo =
      (await import('../notifs/repos/notification.repo')).NotificationRepository;
    const real = NotifRepo.prototype.createNotificationForModule;
    NotifRepo.prototype.createNotificationForModule = (async () => {
      throw new Error('notify boom');
    }) as any;

    try {
      for (let i = 0; i < 3; i++) {
        const ctx = makeReportCtx(H, { userId: crypto.randomUUID(), orgId: org, creativeId, reason: `rep-${i}` });
        await reportAd(ctx);
        if (i === 2) {
          const { status, data } = ctx._captured();
          // Despite the notification throwing, the report flow completed.
          expect(status).toBe(200);
          expect(data.autoPaused).toBe(true);
          expect(data.reportCount).toBe(3);
        }
      }
    } finally {
      NotifRepo.prototype.createNotificationForModule = real;
    }

    // The creative was still paused and the reports still persisted.
    const after = await H.scopedPool.query(
      `SELECT status FROM "${H.schema}".ad_creative WHERE id=$1`,
      [creativeId],
    );
    expect(after.rows[0].status).toBe('pending');
    expect(await reportRows(H, creativeId)).toHaveLength(3);
    // No notification row was written (the insert threw).
    expect(await notifsFor(H, owner)).toHaveLength(0);
  });
});
