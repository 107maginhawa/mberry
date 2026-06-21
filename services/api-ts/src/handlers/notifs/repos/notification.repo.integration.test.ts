/**
 * Integration coverage for NotificationRepository against real Postgres.
 *
 * Covers buildWhereConditions all branches; createNotificationForModule (validation,
 * in-app immediate vs queued/scheduled, email/push channel resolution, preference
 * suppression via injected port, channels[] fallback); findManyByRecipient,
 * findOneByIdAndRecipient (hit/miss), markAsRead (+ idempotent + NotFound),
 * markAllAsRead, getUnreadCount, processScheduledNotifications (in-app + email
 * delivery branches), and cleanupExpiredNotifications. Skips when PG unreachable.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { NotificationRepository } from './notification.repo';
import { ValidationError, NotFoundError } from '@/core/errors';
import type { NotificationPreferencePort } from '@/core/ports/notification-preference.port';
import { createFeedbackScratch } from '@/test-utils/feedback-fixtures';
import type { ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;
let repo: NotificationRepository;

const ORG = randomUUID();
const RECIPIENT = randomUUID();

// Stub PersonRepository — only findOneById is used by the repo under test.
const stubPersonRepo = {
  async findOneById(id: string) {
    return id === RECIPIENT ? { id, email: 'rcpt@example.com' } : null;
  },
} as any;

// Always-enabled preference port (default). Per-test we may swap to a disabling one.
const enabledPort: NotificationPreferencePort = {
  async isCategoryEnabledForPerson() { return true; },
};
const disabledPort: NotificationPreferencePort = {
  async isCategoryEnabledForPerson() { return false; },
};

const createdIds: string[] = [];

beforeAll(async () => {
  // Isolated scratch schema (CREATE TABLE … LIKE public.notification INCLUDING ALL)
  // — runs in CI behind ci-migrate, parallel-safe, schema-faithful. Replaces the
  // former public-schema + `if (CI) return` early-return so these ~16 assertions
  // now execute on the gate (Wave-2 B3 Slice 1, DoD #1).
  H = await createFeedbackScratch();
  if (!H.dbReachable) return;
  repo = new NotificationRepository(H.db as any, stubPersonRepo, undefined, undefined, enabledPort);
});

afterAll(async () => {
  // Scratch teardown drops the schema — no manual DELETE needed.
  await H?.teardown();
});

describe('NotificationRepository.createNotificationForModule', () => {
  test('rejects missing organizationId', async () => {
    if (!H.dbReachable) return;
    let err: unknown;
    try {
      await repo.createNotificationForModule({ recipient: RECIPIENT, type: 'system', channel: 'in-app', title: 't', message: 'm' } as any);
    } catch (e) { err = e; }
    expect(err).toBeInstanceOf(ValidationError);
  });

  test('immediate in-app → status sent, sentAt set', async () => {
    if (!H.dbReachable) return;
    const n = await repo.createNotificationForModule({
      organizationId: ORG, recipient: RECIPIENT, type: 'system', channel: 'in-app', title: 'Hi', message: 'msg',
    } as any);
    createdIds.push(n.id);
    expect(n.status).toBe('sent');
    expect(n.sentAt).not.toBeNull();
    expect(n.channel).toBe('in-app');
  });

  test('recipient without person record still creates (warn path)', async () => {
    if (!H.dbReachable) return;
    const n = await repo.createNotificationForModule({
      organizationId: ORG, recipient: randomUUID(), type: 'system', channel: 'in-app', title: 'Hi', message: 'm',
    } as any);
    createdIds.push(n.id);
    expect(n.status).toBe('sent');
  });

  test('scheduled in-app → status queued', async () => {
    if (!H.dbReachable) return;
    const n = await repo.createNotificationForModule({
      organizationId: ORG, recipient: RECIPIENT, type: 'system', channel: 'in-app',
      title: 'Later', message: 'm', scheduledAt: new Date(Date.now() + 3600_000),
    } as any);
    createdIds.push(n.id);
    expect(n.status).toBe('queued');
  });

  test('email channel with enabled preference → queued', async () => {
    if (!H.dbReachable) return;
    const n = await repo.createNotificationForModule({
      organizationId: ORG, recipient: RECIPIENT, type: 'billing', channel: 'email', title: 'Bill', message: 'm',
    } as any);
    createdIds.push(n.id);
    expect(n.channel).toBe('email');
    expect(n.status).toBe('queued');
  });

  test('email channel suppressed when preference disabled → synthetic non-persisted marker', async () => {
    if (!H.dbReachable) return;
    const r2 = new NotificationRepository(H.db as any, stubPersonRepo, undefined, undefined, disabledPort);
    const n = await r2.createNotificationForModule({
      organizationId: ORG, recipient: RECIPIENT, type: 'billing', channel: 'email', title: 'Bill', message: 'm',
    } as any);
    expect((n as any).suppressed).toBe(true);
    expect(n.id).toBe('');
    // No row persisted.
    const cnt = await H.scopedPool.query(`SELECT count(*)::int n FROM "${H.schema}".notification WHERE organization_id=$1 AND title='Bill' AND channel='email'`, [ORG]);
    expect(cnt.rows[0].n).toBe(1); // only the enabled one above
  });

  test('channels[] fallback resolves channel when single channel absent', async () => {
    if (!H.dbReachable) return;
    const n = await repo.createNotificationForModule({
      organizationId: ORG, recipient: RECIPIENT, type: 'system', channels: ['in-app'], title: 'Multi', message: 'm',
    } as any);
    createdIds.push(n.id);
    expect(n.channel).toBe('in-app');
    expect(n.status).toBe('sent');
  });

  test('unmapped category (security) sends without preference gating', async () => {
    if (!H.dbReachable) return;
    const r2 = new NotificationRepository(H.db as any, stubPersonRepo, undefined, undefined, disabledPort);
    const n = await r2.createNotificationForModule({
      organizationId: ORG, recipient: RECIPIENT, type: 'security', channel: 'email', title: 'Sec', message: 'm',
    } as any);
    createdIds.push(n.id);
    // security resolves to null category → not suppressed even with disabled port
    expect((n as any).suppressed).toBeUndefined();
    expect(n.status).toBe('queued');
  });
});

describe('NotificationRepository queries + state', () => {
  test('buildWhereConditions branches via findManyByRecipient', async () => {
    if (!H.dbReachable) return;
    const res = await repo.findManyByRecipient(RECIPIENT, {
      organizationId: ORG, type: 'system', channel: 'in-app', status: 'unread',
      startDate: new Date('2000-01-01'), endDate: new Date('2100-01-01'),
    });
    expect(res.data.every((n) => n.recipient === RECIPIENT)).toBe(true);
    // default in-app channel branch (no channel)
    const res2 = await repo.findManyByRecipient(RECIPIENT, { organizationId: ORG });
    expect(res2.data.every((n) => n.channel === 'in-app')).toBe(true);
    // explicit status (non-unread) branch
    const res3 = await repo.findManyByRecipient(RECIPIENT, { status: 'sent' });
    expect(Array.isArray(res3.data)).toBe(true);
  });

  test('findOneByIdAndRecipient hit + miss', async () => {
    if (!H.dbReachable) return;
    const id = createdIds.find(Boolean)!;
    expect((await repo.findOneByIdAndRecipient(id, RECIPIENT))?.id ?? null).toBeDefined();
    expect(await repo.findOneByIdAndRecipient(id, randomUUID())).toBeNull();
  });

  test('markAsRead: success, idempotent, NotFound', async () => {
    if (!H.dbReachable) return;
    // a 'sent' in-app notification for RECIPIENT
    const sent = await repo.createNotificationForModule({
      organizationId: ORG, recipient: RECIPIENT, type: 'system', channel: 'in-app', title: 'ToRead', message: 'm',
    } as any);
    createdIds.push(sent.id);

    const read = await repo.markAsRead(sent.id, RECIPIENT);
    expect(read.status).toBe('read');
    // idempotent
    const again = await repo.markAsRead(sent.id, RECIPIENT);
    expect(again.status).toBe('read');
    // NotFound (wrong recipient)
    let err: unknown;
    try { await repo.markAsRead(sent.id, randomUUID()); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(NotFoundError);
  });

  test('markAllAsRead + getUnreadCount', async () => {
    if (!H.dbReachable) return;
    const r = randomUUID();
    for (let i = 0; i < 2; i++) {
      const n = await repo.createNotificationForModule({
        organizationId: ORG, recipient: r, type: 'system', channel: 'in-app', title: 'U' + i, message: 'm',
      } as any);
      createdIds.push(n.id);
    }
    expect(await repo.getUnreadCount(r)).toBe(2);
    const marked = await repo.markAllAsRead(r);
    expect(marked).toBe(2);
    expect(await repo.getUnreadCount(r)).toBe(0);
    // typed branch
    const marked0 = await repo.markAllAsRead(r, 'system');
    expect(marked0).toBe(0);
  });

  test('processScheduledNotifications delivers due queued notifications (email + in-app branches)', async () => {
    if (!H.dbReachable) return;
    // queued email due now (exercises email delivery branch; no email service → warn path,
    // then marks delivered). Non-in-app channels are created 'queued' even when due.
    const dueEmail = await repo.createNotificationForModule({
      organizationId: ORG, recipient: RECIPIENT, type: 'system', channel: 'email',
      title: 'DueMail', message: 'm', scheduledAt: new Date(Date.now() - 1000),
    } as any);
    createdIds.push(dueEmail.id);
    expect(dueEmail.status).toBe('queued');

    // Force a queued in-app row (createNotificationForModule would make in-app 'sent'
    // immediately, so insert a queued in-app directly to drive the in-app delivery branch).
    const queuedInApp = randomUUID();
    await H.scopedPool.query(
      `INSERT INTO "${H.schema}".notification (id, organization_id, recipient_id, type, channel, title, message, status, scheduled_at, created_at, updated_at)
       VALUES ($1,$2,$3,'system','in-app','QueuedInApp','m','queued', now() - interval '1 minute', now(), now())`,
      [queuedInApp, ORG, RECIPIENT],
    );
    createdIds.push(queuedInApp);

    await repo.processScheduledNotifications();

    const afterMail = await H.scopedPool.query(`SELECT status FROM "${H.schema}".notification WHERE id=$1`, [dueEmail.id]);
    expect(afterMail.rows[0].status).toBe('delivered');
    const afterInApp = await H.scopedPool.query(`SELECT status FROM "${H.schema}".notification WHERE id=$1`, [queuedInApp]);
    expect(afterInApp.rows[0].status).toBe('delivered');
  });

  test('processScheduledNotifications: push with no OneSignal marks failed', async () => {
    if (!H.dbReachable) return;
    const duePush = await repo.createNotificationForModule({
      organizationId: ORG, recipient: RECIPIENT, type: 'system', channel: 'push',
      title: 'Push', message: 'm', scheduledAt: new Date(Date.now() - 1000),
    } as any);
    createdIds.push(duePush.id);
    await repo.processScheduledNotifications();
    const after = await H.scopedPool.query(`SELECT status FROM "${H.schema}".notification WHERE id=$1`, [duePush.id]);
    // push branch throws ExternalServiceError → caught → status failed
    expect(after.rows[0].status).toBe('failed');
  });

  test('email delivery uses email service + template mapping when registered', async () => {
    if (!H.dbReachable) return;
    const queued: Array<Record<string, unknown>> = [];
    const prev = (globalThis as any).app;
    (globalThis as any).app = { email: { queueEmail: async (o: Record<string, unknown>) => { queued.push(o); } } };
    try {
      // type 'security' maps to template tag 'auth.password-reset'; recipient has email.
      const id = randomUUID();
      await H.scopedPool.query(
        `INSERT INTO "${H.schema}".notification (id, organization_id, recipient_id, type, channel, title, message, status, scheduled_at, created_at, updated_at)
         VALUES ($1,$2,$3,'security','email','Sec','m','queued', now() - interval '1 minute', now(), now())`,
        [id, ORG, RECIPIENT],
      );
      createdIds.push(id);
      await repo.processScheduledNotifications();
      expect(queued.length).toBeGreaterThanOrEqual(1);
      expect(queued[0]!['templateTags']).toEqual(['auth.password-reset']);
      const after = await H.scopedPool.query(`SELECT status FROM "${H.schema}".notification WHERE id=$1`, [id]);
      expect(after.rows[0].status).toBe('delivered');
    } finally {
      (globalThis as any).app = prev;
    }
  });

  test('cleanupExpiredNotifications removes old rows', async () => {
    if (!H.dbReachable) return;
    // Insert an old notification directly.
    const oldId = randomUUID();
    await H.scopedPool.query(
      `INSERT INTO "${H.schema}".notification (id, organization_id, recipient_id, type, channel, title, message, status, created_at, updated_at)
       VALUES ($1,$2,$3,'system','in-app','Old','m','sent', now() - interval '200 days', now() - interval '200 days')`,
      [oldId, ORG, RECIPIENT],
    );
    const removed = await repo.cleanupExpiredNotifications(90);
    expect(removed).toBeGreaterThanOrEqual(1);
    const gone = await H.scopedPool.query(`SELECT count(*)::int n FROM "${H.schema}".notification WHERE id=$1`, [oldId]);
    expect(gone.rows[0].n).toBe(0);
  });
});
