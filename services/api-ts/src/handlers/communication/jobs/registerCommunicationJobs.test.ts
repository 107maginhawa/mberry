/**
 * FIX-001 / FIX-002 — delivery-spine wiring tests.
 *
 * These prove the wiring that makes a published announcement actually reach the
 * fan-out, and that the scheduled-delivery cron is registered. They are distinct
 * from announcementSend.test.ts, which only exercises processAnnouncementSend in
 * isolation (the function worked all along — it was never invoked).
 */
import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { registerCommunicationJobs } from './announcementSend';
import { domainEvents } from '@/core/domain-events';

function createMockScheduler() {
  const crons: Array<{ name: string; pattern: string }> = [];
  return {
    registerCron: mock((name: string, pattern: string, _handler: any) => { crons.push({ name, pattern }); }),
    registerInterval: mock(() => {}),
    registerDelayed: mock(() => {}),
    start: mock(() => Promise.resolve()),
    shutdown: mock(() => Promise.resolve()),
    trigger: mock(() => Promise.resolve('job-1')),
    cancel: mock(() => Promise.resolve()),
    getHealth: mock(() => Promise.resolve({ healthy: true })),
    getQueueSize: mock(() => Promise.resolve(0)),
    _crons: crons,
  };
}

function createMockNotifService() {
  return {
    createNotification: mock(() => Promise.resolve({ id: 'notif-1' })),
    processScheduledNotifications: mock(() => Promise.resolve()),
    cleanupExpiredNotifications: mock(() => Promise.resolve(0)),
  } as any;
}

function createMockEmailService() {
  return {
    queueEmail: mock(() => Promise.resolve({ id: 'email-1' })),
    initializeDefaultTemplates: mock(() => Promise.resolve()),
  } as any;
}

/**
 * Mock db that returns the given announcement for the first select (repo.get),
 * an empty roster for the membership query, and records insert calls.
 */
function createMockDb(announcement: any) {
  let selectCount = 0;
  const inserts: any[] = [];
  const db: any = {
    select: mock(() => {
      selectCount++;
      return {
        from: mock(() => ({
          where: mock(() => ({ limit: mock(() => (selectCount === 1 ? [announcement] : [])) })),
          leftJoin: mock(function (this: any) { return this; }),
          innerJoin: mock(function (this: any) { return this; }),
          orderBy: mock(function (this: any) { return this; }),
          limit: mock(() => []),
          offset: mock(() => []),
        })),
      };
    }),
    insert: mock(() => ({ values: mock((v: any) => { inserts.push(v); return { returning: mock(() => [{ id: 'x' }]) }; }) })),
    update: mock(() => ({ set: mock(() => ({ where: mock(() => ({ returning: mock(() => [announcement]) })) })) })),
    execute: mock(() => Promise.resolve([])),
    _inserts: inserts,
  };
  return db;
}

describe('registerCommunicationJobs (delivery-spine wiring)', () => {
  beforeEach(() => { domainEvents.reset(); });
  afterEach(() => { domainEvents.reset(); });

  it('FIX-002: registers the scheduled-announcement cron at */5', () => {
    const scheduler = createMockScheduler();
    registerCommunicationJobs(scheduler as any, createMockNotifService(), createMockEmailService(), createMockDb(null) as any);

    const cron = scheduler._crons.find((c) => c.name === 'communication.processScheduled');
    expect(cron).toBeDefined();
    expect(cron!.pattern).toBe('*/5 * * * *');
  });

  it('FIX-001: subscribes to announcement.published and runs the fan-out on emit', async () => {
    const scheduler = createMockScheduler();
    const announcement = {
      id: 'ann-1',
      organizationId: 'org-1',
      title: 'Hello members',
      content: 'Body text',
      status: 'sent',
      channelPush: false,
      channelEmail: false,
    };
    const db = createMockDb(announcement);

    registerCommunicationJobs(scheduler as any, createMockNotifService(), createMockEmailService(), db as any);

    // Emitting the published event must drive the fan-out: the announcement is
    // looked up (repo.get → db.select) — proving the subscriber is wired, not dead.
    await domainEvents.emit('announcement.published', {
      announcementId: 'ann-1',
      organizationId: 'org-1',
      publishedBy: 'officer-1',
    });

    expect(db.select).toHaveBeenCalled();
  });
});
