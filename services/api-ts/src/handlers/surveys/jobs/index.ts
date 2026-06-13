/**
 * Survey Module Background Jobs
 * Registers and configures survey-related background jobs
 */

import type { JobScheduler, JobContext } from '@/core/jobs';
import type { NotificationService } from '@/core/notifs';
import type { DatabaseInstance } from '@/core/database';
import { SurveyRepository, SurveyResponseRepository } from '../repos/survey.repo';
import { surveyResponses } from '../repos/survey.schema';
import { and, eq, lt, sql } from 'drizzle-orm';

// Export the default threshold so pg-boss trigger jobs can check it
export const DEFAULT_SURVEY_FATIGUE_THRESHOLD = 2;
export const DEFAULT_SURVEY_FATIGUE_WINDOW_DAYS = 7;

/**
 * Register all survey module jobs with the scheduler
 */
export function registerSurveyJobs(
  scheduler: JobScheduler,
  notifs: NotificationService
): void {
  // Expire pending responses older than 48 hours + auto-close surveys whose
  // deadline has passed (FIX-008) — runs daily at 4 AM
  scheduler.registerCron('survey.expirePending', '0 4 * * *', async (context: JobContext) => {
    const db = context.db as DatabaseInstance | undefined;
    if (!db) {
      return;
    }

    const responseRepo = new SurveyResponseRepository(db);
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const skippedCount = await responseRepo.markPendingAsSkippedBefore(cutoff);

    if (skippedCount > 0) {
      context.logger?.info(
        { skippedCount, cutoff: cutoff.toISOString() },
        'Expired pending survey responses'
      );
    }

    // FIX-008: flip active surveys whose deadline has passed to `closed`, so
    // lists/UX no longer show a stale "active" state past the deadline. The
    // submit-time guard already blocks new responses; this fixes the lifecycle.
    const surveyRepo = new SurveyRepository(db);
    const now = new Date();
    const { data: activeSurveys } = await surveyRepo.findManyWithPagination(
      { status: 'active' },
      { pagination: { limit: 1000, offset: 0 } }
    );

    let closedCount = 0;
    for (const survey of activeSurveys) {
      const deadline = survey.settings?.deadline;
      if (!deadline) continue;
      if (new Date(deadline) > now) continue;
      const closed = await surveyRepo.closeExpiredSurvey(survey.id);
      if (closed) closedCount++;
    }

    if (closedCount > 0) {
      context.logger?.info(
        { closedCount, at: now.toISOString() },
        'Auto-closed surveys past their deadline'
      );
    }
  });

  // Reminder: fire 24hr before deadline for pending responses — runs daily at 8 AM
  scheduler.registerCron('survey.responseReminder', '0 8 * * *', async (context: JobContext) => {
    const db = context.db as DatabaseInstance | undefined;
    if (!db) return;

    const surveyRepo = new SurveyRepository(db);
    const { data: activeSurveys } = await surveyRepo.findManyWithPagination(
      { status: 'active' },
      { pagination: { limit: 100, offset: 0 } }
    );

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    let remindersSent = 0;

    for (const survey of activeSurveys) {
      const deadline = survey.settings?.deadline;
      if (!deadline) continue;

      const deadlineDate = new Date(deadline);
      // Only remind if deadline is within next 24 hours
      if (deadlineDate <= now || deadlineDate > tomorrow) continue;

      // Find pending responders who haven't completed
      const responseRepo = new SurveyResponseRepository(db);
      const { data: pendingResponses } = await responseRepo.findManyWithPagination(
        { surveyId: survey.id, status: 'pending' },
        { pagination: { limit: 500, offset: 0 } }
      );

      for (const resp of pendingResponses) {
        if (!resp.responderId) continue;
        try {
          await notifs.createNotification({
            recipient: resp.responderId,
            type: 'survey.reminder',
            title: `Survey closing soon: ${survey.title}`,
            message: 'Please complete this survey before the deadline.',
            data: { surveyId: survey.id },
          });
          remindersSent++;
        } catch {
          // Notification delivery failures are non-fatal
        }
      }
    }

    if (remindersSent > 0) {
      context.logger?.info({ remindersSent }, 'Sent survey response reminders');
    }
  });

  // Post-training evaluation trigger — listens for training.session.completed events
  scheduler.registerCron('survey.postTrainingEval', '0 5 * * *', async (context: JobContext) => {
    const db = context.db as DatabaseInstance | undefined;
    if (!db) return;

    const { trainingSessionId, organizationId, attendeeIds } = context.data as {
      trainingSessionId: string;
      organizationId: string;
      attendeeIds: string[];
    };

    if (!trainingSessionId || !organizationId || !attendeeIds?.length) return;

    // Find or create post-training eval survey for this org
    const surveyRepo = new SurveyRepository(db);
    const responseRepo = new SurveyResponseRepository(db);

    // Create pending responses for each attendee
    let created = 0;
    for (const attendeeId of attendeeIds) {
      // Check fatigue threshold
      const recentCount = await responseRepo.countRecentForMemberInWindow(
        attendeeId,
        DEFAULT_SURVEY_FATIGUE_WINDOW_DAYS
      );
      if (recentCount >= DEFAULT_SURVEY_FATIGUE_THRESHOLD) continue;

      try {
        // Look for an active post-training survey
        const { data: evalSurveys } = await surveyRepo.findManyWithPagination(
          { organizationId, status: 'active', surveyType: 'satisfaction' },
          { pagination: { limit: 1, offset: 0 } }
        );
        if (evalSurveys.length === 0) continue;

        await responseRepo.createPendingResponse({
          organizationId,
          surveyId: evalSurveys[0]!.id,
          responderId: attendeeId,
          answers: [],
          contextId: trainingSessionId,
        });
        created++;
      } catch {
        // Duplicate or other constraint — skip
      }
    }

    context.logger?.info(
      { trainingSessionId, created, total: attendeeIds.length },
      'Created post-training eval pending responses'
    );
  });

  // Data retention purge — runs weekly on Sundays at 3 AM
  scheduler.registerCron('survey.retentionPurge', '0 3 * * 0', async (context: JobContext) => {
    const db = context.db as DatabaseInstance | undefined;
    if (!db) return;

    const surveyRepo = new SurveyRepository(db);
    const { data: allSurveys } = await surveyRepo.findManyWithPagination(
      {},
      { pagination: { limit: 1000, offset: 0 } }
    );

    let purgedTotal = 0;

    for (const survey of allSurveys) {
      const retentionDays = survey.settings?.retentionDays;
      if (!retentionDays) continue; // No retention policy = keep forever

      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      // Delete expired responses
      const result = await db
        .delete(surveyResponses)
        .where(
          and(
            eq(surveyResponses.surveyId, survey.id),
            lt(surveyResponses.createdAt, cutoff)
          )
        )
        .returning({ id: surveyResponses.id });

      purgedTotal += result.length;
    }

    if (purgedTotal > 0) {
      context.logger?.info(
        { purgedTotal },
        'Purged expired survey responses per retention policy'
      );
    }
  });
}
