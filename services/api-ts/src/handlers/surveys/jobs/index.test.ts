/**
 * Tests for registerSurveyJobs
 *
 * The survey module registers four cron jobs:
 * - survey.expirePending (daily at 4 AM)
 * - survey.responseReminder (daily at 8 AM)
 * - survey.postTrainingEval (daily at 5 AM)
 * - survey.retentionPurge (weekly Sundays at 3 AM)
 */

import { describe, test, expect, mock } from 'bun:test';
import { registerSurveyJobs, DEFAULT_SURVEY_FATIGUE_THRESHOLD, DEFAULT_SURVEY_FATIGUE_WINDOW_DAYS } from './index';
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

  test('exports DEFAULT_SURVEY_FATIGUE_THRESHOLD as 2', () => {
    expect(DEFAULT_SURVEY_FATIGUE_THRESHOLD).toBe(2);
  });

  test('exports DEFAULT_SURVEY_FATIGUE_WINDOW_DAYS as 7', () => {
    expect(DEFAULT_SURVEY_FATIGUE_WINDOW_DAYS).toBe(7);
  });
});
