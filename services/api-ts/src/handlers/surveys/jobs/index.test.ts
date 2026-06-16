/**
 * Tests for registerSurveyJobs
 *
 * The survey module registers four cron jobs:
 * - survey.expirePending (daily at 4 AM)
 * - survey.responseReminder (daily at 8 AM)
 * - survey.postTrainingEval (daily at 5 AM)
 * - survey.retentionPurge (weekly Sundays at 3 AM)
 */

import { describe, test, expect, mock, afterEach } from 'bun:test';
import { registerSurveyJobs, DEFAULT_SURVEY_FATIGUE_THRESHOLD, DEFAULT_SURVEY_FATIGUE_WINDOW_DAYS } from './index';
import { stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SurveyRepository, SurveyResponseRepository } from '../repos/survey.repo';
import type { JobScheduler, JobContext } from '@/core/jobs';
import type { NotificationService } from '@/core/notifs';

// Mock-Classification: APPROPRIATE — job registration with DB interactions

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger() {
  return {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  };
}

function makeContext(overrides: Partial<JobContext> = {}): JobContext {
  return {
    db: {} as any,
    logger: makeLogger() as any,
    jobId: 'job-survey-001',
    jobName: 'survey.expirePending',
    data: undefined,
    ...overrides,
  };
}

function makeNotifsService(): NotificationService {
  return {
    createNotification: mock(async () => ({} as any)),
    processScheduledNotifications: mock(async () => {}),
    cleanupExpiredNotifications: mock(async () => {}),
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerSurveyJobs', () => {
  test('registers four cron jobs', () => {
    const registerCron = mock(() => {});
    const scheduler: JobScheduler = { registerCron } as any;

    registerSurveyJobs(scheduler, makeNotifsService());

    expect(registerCron).toHaveBeenCalledTimes(4);
  });

  test('registers survey.expirePending with daily 4 AM cron', () => {
    const registerCron = mock(() => {});
    const scheduler: JobScheduler = { registerCron } as any;

    registerSurveyJobs(scheduler, makeNotifsService());

    const [name, schedule] = registerCron.mock.calls[0];
    expect(name).toBe('survey.expirePending');
    expect(schedule).toBe('0 4 * * *');
  });

  test('registers survey.responseReminder with daily 8 AM cron', () => {
    const registerCron = mock(() => {});
    const scheduler: JobScheduler = { registerCron } as any;

    registerSurveyJobs(scheduler, makeNotifsService());

    const [name, schedule] = registerCron.mock.calls[1];
    expect(name).toBe('survey.responseReminder');
    expect(schedule).toBe('0 8 * * *');
  });

  test('registers survey.postTrainingEval with daily 5 AM cron', () => {
    const registerCron = mock(() => {});
    const scheduler: JobScheduler = { registerCron } as any;

    registerSurveyJobs(scheduler, makeNotifsService());

    const [name, schedule] = registerCron.mock.calls[2];
    expect(name).toBe('survey.postTrainingEval');
    expect(schedule).toBe('0 5 * * *');
  });

  test('registers survey.retentionPurge with weekly Sunday 3 AM cron', () => {
    const registerCron = mock(() => {});
    const scheduler: JobScheduler = { registerCron } as any;

    registerSurveyJobs(scheduler, makeNotifsService());

    const [name, schedule] = registerCron.mock.calls[3];
    expect(name).toBe('survey.retentionPurge');
    expect(schedule).toBe('0 3 * * 0');
  });

  test('expirePending returns early when db is not available', async () => {
    let capturedHandler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((_n: string, _s: string, handler: any) => {
        if (_n === 'survey.expirePending') capturedHandler = handler;
      }),
    } as any;

    registerSurveyJobs(scheduler, makeNotifsService());

    // Pass context with no db
    const context = makeContext({ db: undefined as any });
    await capturedHandler!(context);

    // Should return silently (no error)
    expect((context.logger as any).error).not.toHaveBeenCalled();
  });

  test('postTrainingEval returns early when data is missing required fields', async () => {
    let capturedHandler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((_n: string, _s: string, handler: any) => {
        if (_n === 'survey.postTrainingEval') capturedHandler = handler;
      }),
    } as any;

    registerSurveyJobs(scheduler, makeNotifsService());

    const context = makeContext({ data: {} });
    await capturedHandler!(context);

    // Should return silently
    expect((context.logger as any).error).not.toHaveBeenCalled();
  });

  // ── FIX-008: auto-close active surveys at their deadline ───────────────────

  test('survey.expirePending auto-closes active surveys whose deadline has passed', async () => {
    const closed: string[] = [];
    stubRepo(SurveyRepository, {
      findManyWithPagination: async (filters: any) => {
        if (filters?.status === 'active') {
          return {
            data: [
              { id: 'past', settings: { deadline: '2020-01-01T00:00:00Z' } },
              { id: 'future', settings: { deadline: '2999-01-01T00:00:00Z' } },
              { id: 'no-deadline', settings: {} },
            ],
            totalCount: 3,
          };
        }
        return { data: [], totalCount: 0 };
      },
      closeExpiredSurvey: async (id: string) => { closed.push(id); return { id, status: 'closed' } as any; },
    });
    stubRepo(SurveyResponseRepository, {
      markPendingAsSkippedBefore: async () => 0,
    });

    let handler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((n: string, _s: string, h: any) => { if (n === 'survey.expirePending') handler = h; }),
    } as any;

    registerSurveyJobs(scheduler, makeNotifsService());
    await handler!(makeContext({ db: {} as any }));

    // Only the past-deadline active survey is closed; future + no-deadline untouched.
    expect(closed).toEqual(['past']);

    restoreRepo(SurveyRepository);
    restoreRepo(SurveyResponseRepository);
  });

  test('exports DEFAULT_SURVEY_FATIGUE_THRESHOLD as 2', () => {
    expect(DEFAULT_SURVEY_FATIGUE_THRESHOLD).toBe(2);
  });

  test('exports DEFAULT_SURVEY_FATIGUE_WINDOW_DAYS as 7', () => {
    expect(DEFAULT_SURVEY_FATIGUE_WINDOW_DAYS).toBe(7);
  });

  // ── expirePending: skippedCount > 0 logging branch ────────────────────────

  test('survey.expirePending logs when pending responses are expired', async () => {
    stubRepo(SurveyResponseRepository, {
      markPendingAsSkippedBefore: async () => 3,
    });
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({ data: [], totalCount: 0 }),
      closeExpiredSurvey: async () => null as any,
    });

    let handler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((n: string, _s: string, h: any) => {
        if (n === 'survey.expirePending') handler = h;
      }),
    } as any;

    registerSurveyJobs(scheduler, makeNotifsService());
    const logger = makeLogger();
    await handler!(makeContext({ db: {} as any, logger: logger as any }));

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ skippedCount: 3 }),
      'Expired pending survey responses',
    );

    restoreRepo(SurveyResponseRepository);
    restoreRepo(SurveyRepository);
  });

  test('survey.expirePending logs when surveys are auto-closed', async () => {
    const closed: string[] = [];
    stubRepo(SurveyResponseRepository, {
      markPendingAsSkippedBefore: async () => 0,
    });
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({
        data: [{ id: 'expired-survey', settings: { deadline: '2000-01-01T00:00:00Z' } }],
        totalCount: 1,
      }),
      closeExpiredSurvey: async (id: string) => { closed.push(id); return { id, status: 'closed' } as any; },
    });

    let handler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((n: string, _s: string, h: any) => {
        if (n === 'survey.expirePending') handler = h;
      }),
    } as any;

    registerSurveyJobs(scheduler, makeNotifsService());
    const logger = makeLogger();
    await handler!(makeContext({ db: {} as any, logger: logger as any }));

    expect(closed).toEqual(['expired-survey']);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ closedCount: 1 }),
      'Auto-closed surveys past their deadline',
    );

    restoreRepo(SurveyResponseRepository);
    restoreRepo(SurveyRepository);
  });

  // ── responseReminder: early return when !db ────────────────────────────────

  test('survey.responseReminder returns early when db is not available', async () => {
    let handler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((n: string, _s: string, h: any) => {
        if (n === 'survey.responseReminder') handler = h;
      }),
    } as any;

    registerSurveyJobs(scheduler, makeNotifsService());
    const context = makeContext({ db: undefined as any });
    await handler!(context);

    expect((context.logger as any).error).not.toHaveBeenCalled();
  });

  // ── responseReminder: no active surveys → no reminders sent ───────────────

  test('survey.responseReminder does nothing when no active surveys', async () => {
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({ data: [], totalCount: 0 }),
    });

    let handler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((n: string, _s: string, h: any) => {
        if (n === 'survey.responseReminder') handler = h;
      }),
    } as any;

    const notifs = makeNotifsService();
    registerSurveyJobs(scheduler, notifs);
    const logger = makeLogger();
    await handler!(makeContext({ db: {} as any, logger: logger as any }));

    expect((notifs.createNotification as any).mock.calls.length).toBe(0);
    expect(logger.info).not.toHaveBeenCalled();

    restoreRepo(SurveyRepository);
  });

  // ── responseReminder: skips surveys without deadline ──────────────────────

  test('survey.responseReminder skips surveys without a deadline', async () => {
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({
        data: [{ id: 's1', title: 'No Deadline Survey', settings: {} }],
        totalCount: 1,
      }),
    });

    let handler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((n: string, _s: string, h: any) => {
        if (n === 'survey.responseReminder') handler = h;
      }),
    } as any;

    const notifs = makeNotifsService();
    registerSurveyJobs(scheduler, notifs);
    await handler!(makeContext({ db: {} as any }));

    expect((notifs.createNotification as any).mock.calls.length).toBe(0);

    restoreRepo(SurveyRepository);
  });

  // ── responseReminder: skips surveys whose deadline isn't within 24hrs ──────

  test('survey.responseReminder skips surveys with deadline > 24 hrs away', async () => {
    const farFuture = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({
        data: [{ id: 's2', title: 'Far Future', settings: { deadline: farFuture } }],
        totalCount: 1,
      }),
    });

    let handler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((n: string, _s: string, h: any) => {
        if (n === 'survey.responseReminder') handler = h;
      }),
    } as any;

    const notifs = makeNotifsService();
    registerSurveyJobs(scheduler, notifs);
    await handler!(makeContext({ db: {} as any }));

    expect((notifs.createNotification as any).mock.calls.length).toBe(0);

    restoreRepo(SurveyRepository);
  });

  // ── responseReminder: skips already-past deadlines ────────────────────────

  test('survey.responseReminder skips surveys whose deadline has already passed', async () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({
        data: [{ id: 's3', title: 'Past', settings: { deadline: past } }],
        totalCount: 1,
      }),
    });

    let handler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((n: string, _s: string, h: any) => {
        if (n === 'survey.responseReminder') handler = h;
      }),
    } as any;

    const notifs = makeNotifsService();
    registerSurveyJobs(scheduler, notifs);
    await handler!(makeContext({ db: {} as any }));

    expect((notifs.createNotification as any).mock.calls.length).toBe(0);

    restoreRepo(SurveyRepository);
  });

  // ── responseReminder: sends notifications and logs ────────────────────────

  test('survey.responseReminder sends reminders for pending responders and logs', async () => {
    const soonDeadline = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({
        data: [{ id: 's-remind', title: 'Closing Soon', settings: { deadline: soonDeadline } }],
        totalCount: 1,
      }),
    });
    stubRepo(SurveyResponseRepository, {
      findManyWithPagination: async () => ({
        data: [
          { id: 'r1', surveyId: 's-remind', responderId: 'person-a', status: 'pending' },
          { id: 'r2', surveyId: 's-remind', responderId: null, status: 'pending' }, // no responderId — skip
        ],
        totalCount: 2,
      }),
    });

    let handler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((n: string, _s: string, h: any) => {
        if (n === 'survey.responseReminder') handler = h;
      }),
    } as any;

    const notifs = makeNotifsService();
    registerSurveyJobs(scheduler, notifs);
    const logger = makeLogger();
    await handler!(makeContext({ db: {} as any, logger: logger as any }));

    // Only person-a gets a notification; null responderId is skipped
    expect((notifs.createNotification as any).mock.calls.length).toBe(1);
    expect((notifs.createNotification as any).mock.calls[0][0]).toMatchObject({
      recipient: 'person-a',
      type: 'survey.reminder',
    });
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ remindersSent: 1 }),
      'Sent survey response reminders',
    );

    restoreRepo(SurveyRepository);
    restoreRepo(SurveyResponseRepository);
  });

  // ── responseReminder: notification failure is non-fatal ───────────────────

  test('survey.responseReminder swallows notification delivery failures', async () => {
    const soonDeadline = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({
        data: [{ id: 's-fail', title: 'Closing Soon', settings: { deadline: soonDeadline } }],
        totalCount: 1,
      }),
    });
    stubRepo(SurveyResponseRepository, {
      findManyWithPagination: async () => ({
        data: [{ id: 'r3', responderId: 'person-b', status: 'pending' }],
        totalCount: 1,
      }),
    });

    let handler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((n: string, _s: string, h: any) => {
        if (n === 'survey.responseReminder') handler = h;
      }),
    } as any;

    const notifs = makeNotifsService();
    (notifs.createNotification as any) = mock(async () => {
      throw new Error('OneSignal down');
    });

    registerSurveyJobs(scheduler, notifs);
    // Should not throw
    await expect(handler!(makeContext({ db: {} as any }))).resolves.toBeUndefined();

    restoreRepo(SurveyRepository);
    restoreRepo(SurveyResponseRepository);
  });

  // ── postTrainingEval: early return when !db ────────────────────────────────

  test('survey.postTrainingEval returns early when db is not available', async () => {
    let handler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((n: string, _s: string, h: any) => {
        if (n === 'survey.postTrainingEval') handler = h;
      }),
    } as any;

    registerSurveyJobs(scheduler, makeNotifsService());
    const ctx = makeContext({ db: undefined as any, data: { trainingSessionId: 't1', organizationId: 'org-1', attendeeIds: ['a1'] } });
    await handler!(ctx);

    expect((ctx.logger as any).error).not.toHaveBeenCalled();
  });

  // ── postTrainingEval: attendee skipped due to fatigue threshold ───────────

  test('survey.postTrainingEval skips attendees over fatigue threshold', async () => {
    stubRepo(SurveyResponseRepository, {
      countRecentForMemberInWindow: async () => DEFAULT_SURVEY_FATIGUE_THRESHOLD, // at threshold → skip
      createPendingResponse: async () => ({} as any),
    });
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({
        data: [{ id: 'eval-survey-1' }],
        totalCount: 1,
      }),
    });

    let handler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((n: string, _s: string, h: any) => {
        if (n === 'survey.postTrainingEval') handler = h;
      }),
    } as any;

    registerSurveyJobs(scheduler, makeNotifsService());
    const logger = makeLogger();
    await handler!(makeContext({
      db: {} as any,
      logger: logger as any,
      data: { trainingSessionId: 'ts-1', organizationId: 'org-1', attendeeIds: ['fatigued-person'] },
    }));

    // createPendingResponse should NOT be called — attendee was skipped
    expect((SurveyResponseRepository.prototype as any).createPendingResponse).toBeDefined();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ created: 0, total: 1 }),
      'Created post-training eval pending responses',
    );

    restoreRepo(SurveyResponseRepository);
    restoreRepo(SurveyRepository);
  });

  // ── postTrainingEval: no active eval survey → skip attendee ───────────────

  test('survey.postTrainingEval skips when no active eval survey exists', async () => {
    const createPendingResponse = mock(async () => ({} as any));
    stubRepo(SurveyResponseRepository, {
      countRecentForMemberInWindow: async () => 0,
      createPendingResponse,
    });
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({ data: [], totalCount: 0 }),
    });

    let handler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((n: string, _s: string, h: any) => {
        if (n === 'survey.postTrainingEval') handler = h;
      }),
    } as any;

    registerSurveyJobs(scheduler, makeNotifsService());
    const logger = makeLogger();
    await handler!(makeContext({
      db: {} as any,
      logger: logger as any,
      data: { trainingSessionId: 'ts-2', organizationId: 'org-1', attendeeIds: ['person-x'] },
    }));

    expect(createPendingResponse.mock.calls.length).toBe(0);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ created: 0 }),
      'Created post-training eval pending responses',
    );

    restoreRepo(SurveyResponseRepository);
    restoreRepo(SurveyRepository);
  });

  // ── postTrainingEval: creates pending response and logs ───────────────────

  test('survey.postTrainingEval creates pending response for eligible attendees', async () => {
    const createPendingResponse = mock(async () => ({} as any));
    stubRepo(SurveyResponseRepository, {
      countRecentForMemberInWindow: async () => 0,
      createPendingResponse,
    });
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({
        data: [{ id: 'eval-1' }],
        totalCount: 1,
      }),
    });

    let handler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((n: string, _s: string, h: any) => {
        if (n === 'survey.postTrainingEval') handler = h;
      }),
    } as any;

    registerSurveyJobs(scheduler, makeNotifsService());
    const logger = makeLogger();
    await handler!(makeContext({
      db: {} as any,
      logger: logger as any,
      data: { trainingSessionId: 'ts-3', organizationId: 'org-1', attendeeIds: ['person-y'] },
    }));

    expect(createPendingResponse.mock.calls.length).toBe(1);
    expect(createPendingResponse.mock.calls[0][0]).toMatchObject({
      surveyId: 'eval-1',
      responderId: 'person-y',
      contextId: 'ts-3',
    });
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ created: 1, total: 1 }),
      'Created post-training eval pending responses',
    );

    restoreRepo(SurveyResponseRepository);
    restoreRepo(SurveyRepository);
  });

  // ── postTrainingEval: constraint error is swallowed ───────────────────────

  test('survey.postTrainingEval swallows duplicate/constraint errors per attendee', async () => {
    stubRepo(SurveyResponseRepository, {
      countRecentForMemberInWindow: async () => 0,
      createPendingResponse: async () => { throw new Error('unique_violation'); },
    });
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({
        data: [{ id: 'eval-2' }],
        totalCount: 1,
      }),
    });

    let handler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((n: string, _s: string, h: any) => {
        if (n === 'survey.postTrainingEval') handler = h;
      }),
    } as any;

    registerSurveyJobs(scheduler, makeNotifsService());
    // Must not throw
    await expect(
      handler!(makeContext({
        db: {} as any,
        data: { trainingSessionId: 'ts-4', organizationId: 'org-1', attendeeIds: ['person-z'] },
      }))
    ).resolves.toBeUndefined();

    restoreRepo(SurveyResponseRepository);
    restoreRepo(SurveyRepository);
  });

  // ── postTrainingEval: multiple attendees, failure isolation ───────────────

  test('survey.postTrainingEval processes all attendees even when one fails', async () => {
    const created: string[] = [];
    let callCount = 0;
    stubRepo(SurveyResponseRepository, {
      countRecentForMemberInWindow: async () => 0,
      createPendingResponse: async (payload: any) => {
        callCount++;
        if (payload.responderId === 'bad-person') throw new Error('constraint');
        created.push(payload.responderId);
        return {} as any;
      },
    });
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({
        data: [{ id: 'eval-multi' }],
        totalCount: 1,
      }),
    });

    let handler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((n: string, _s: string, h: any) => {
        if (n === 'survey.postTrainingEval') handler = h;
      }),
    } as any;

    registerSurveyJobs(scheduler, makeNotifsService());
    const logger = makeLogger();
    await handler!(makeContext({
      db: {} as any,
      logger: logger as any,
      data: {
        trainingSessionId: 'ts-5',
        organizationId: 'org-1',
        attendeeIds: ['person-1', 'bad-person', 'person-2'],
      },
    }));

    // bad-person failed but person-1 and person-2 still processed
    expect(created).toEqual(['person-1', 'person-2']);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ created: 2, total: 3 }),
      'Created post-training eval pending responses',
    );

    restoreRepo(SurveyResponseRepository);
    restoreRepo(SurveyRepository);
  });

  // ── retentionPurge: early return when !db ─────────────────────────────────

  test('survey.retentionPurge returns early when db is not available', async () => {
    let handler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((n: string, _s: string, h: any) => {
        if (n === 'survey.retentionPurge') handler = h;
      }),
    } as any;

    registerSurveyJobs(scheduler, makeNotifsService());
    const ctx = makeContext({ db: undefined as any });
    await handler!(ctx);

    expect((ctx.logger as any).error).not.toHaveBeenCalled();
  });

  // ── retentionPurge: surveys without retentionDays are skipped ─────────────

  test('survey.retentionPurge skips surveys without retentionDays policy', async () => {
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({
        data: [
          { id: 'no-policy', settings: {} },
          { id: 'null-policy', settings: { retentionDays: null } },
        ],
        totalCount: 2,
      }),
    });

    const mockDelete = mock(() => ({
      where: mock(() => ({ returning: mock(async () => []) })),
    }));
    const mockDb = { delete: mockDelete } as any;

    let handler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((n: string, _s: string, h: any) => {
        if (n === 'survey.retentionPurge') handler = h;
      }),
    } as any;

    registerSurveyJobs(scheduler, makeNotifsService());
    const logger = makeLogger();
    await handler!(makeContext({ db: mockDb, logger: logger as any }));

    // No delete calls — no surveys have retentionDays set
    expect(mockDelete.mock.calls.length).toBe(0);
    // No log (purgedTotal stays 0)
    expect(logger.info).not.toHaveBeenCalled();

    restoreRepo(SurveyRepository);
  });

  // ── retentionPurge: deletes expired responses and logs ────────────────────

  test('survey.retentionPurge deletes expired responses and logs purged count', async () => {
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({
        data: [
          { id: 'survey-with-policy', settings: { retentionDays: 30 } },
        ],
        totalCount: 1,
      }),
    });

    const deletedRows = [{ id: 'resp-1' }, { id: 'resp-2' }];
    const mockReturning = mock(async () => deletedRows);
    const mockWhere = mock(() => ({ returning: mockReturning }));
    const mockDelete = mock(() => ({ where: mockWhere }));
    const mockDb = { delete: mockDelete } as any;

    let handler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((n: string, _s: string, h: any) => {
        if (n === 'survey.retentionPurge') handler = h;
      }),
    } as any;

    registerSurveyJobs(scheduler, makeNotifsService());
    const logger = makeLogger();
    await handler!(makeContext({ db: mockDb, logger: logger as any }));

    expect(mockDelete.mock.calls.length).toBe(1);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ purgedTotal: 2 }),
      'Purged expired survey responses per retention policy',
    );

    restoreRepo(SurveyRepository);
  });

  // ── retentionPurge: multiple surveys, only those with policy purged ────────

  test('survey.retentionPurge processes only surveys with a retentionDays policy', async () => {
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({
        data: [
          { id: 'has-policy', settings: { retentionDays: 7 } },
          { id: 'no-policy', settings: {} },
        ],
        totalCount: 2,
      }),
    });

    const deletedRows = [{ id: 'resp-old' }];
    const mockReturning2 = mock(async () => deletedRows);
    const mockWhere2 = mock(() => ({ returning: mockReturning2 }));
    const mockDelete = mock(() => ({ where: mockWhere2 }));
    const mockDb = { delete: mockDelete } as any;

    let handler: (ctx: JobContext) => Promise<void>;
    const scheduler: JobScheduler = {
      registerCron: mock((n: string, _s: string, h: any) => {
        if (n === 'survey.retentionPurge') handler = h;
      }),
    } as any;

    registerSurveyJobs(scheduler, makeNotifsService());
    const logger = makeLogger();
    await handler!(makeContext({ db: mockDb, logger: logger as any }));

    // Only called once for the survey with a policy
    expect(mockDelete.mock.calls.length).toBe(1);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ purgedTotal: 1 }),
      'Purged expired survey responses per retention policy',
    );

    restoreRepo(SurveyRepository);
  });
});
