import type { Context } from 'hono';
import type { JobScheduler } from '@/core/jobs';
import { NotFoundError, ConflictError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';
import { CreditEntryRepository } from '../association:member/repos/credits.repo';
import { MembershipRepository } from '../association:member/repos/membership.repo';
import { getCycleForDateWithConfig, type CreditCycleConfig } from '../association:member/utils/credit-cycle';
import { OrganizationRepository, AssociationRepository } from '../platformadmin/repos/platform-admin.repo';

/**
 * Fallback credit cycle defaults when no association config exists.
 * Prefer reading from association.requiredCreditsPerCycle at runtime.
 */
const DEFAULT_CYCLE_PERIOD_YEARS = 2;
const DEFAULT_REQUIRED_CREDITS = 40;

export async function markComplete(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const trainingId = ctx.req.param('id')!;
  const orgId = ctx.req.param('organizationId')!;
  const body = await ctx.req.json();
  const repo = new TrainingRepository(db);

  const training = await repo.getByOrg(trainingId, orgId);
  if (!training) throw new NotFoundError('Training not found');

  // [BR-20] Block completion for cancelled activities
  if (training.status === 'cancelled') {
    throw new ConflictError('Cannot mark complete: training activity is cancelled');
  }

  // [BR-20] Block completion before activity end date has passed
  if (training.endDate && new Date(training.endDate) > new Date()) {
    throw new ConflictError('Cannot mark complete: training activity has not ended yet');
  }

  // Check enrollment before marking complete
  const enrollmentCount = await repo.getEnrollmentCount(trainingId);
  if (enrollmentCount === 0) throw new ConflictError('No active enrollment found');

  // Update enrollment status to completed
  const enrollments = await repo.listEnrollments(trainingId);
  const personEnrollment = enrollments.find((e) => e.personId === body.personId);
  if (!personEnrollment) throw new NotFoundError('Enrollment not found');
  if (personEnrollment.completedAt) throw new ConflictError('Already marked as completed');

  const updated = await repo.updateEnrollmentStatus(personEnrollment.id, 'completed');

  // [BR-13] Auto-create credit entry for credit-bearing trainings
  // [AC-M10-002] Check for existing auto credit to prevent duplicates
  if (training.creditAmount && training.creditAmount > 0) {
    try {
      const creditRepo = new CreditEntryRepository(db);

      // Duplicate guard: skip if auto credit already exists for this training+person
      const existing = await creditRepo.findByTrainingAndPerson(training.id, body.personId);
      if (!existing) {
        const activityDate = training.endDate ?? new Date();

        // [V-12] Look up member registration date for cycle anchor
        const memberRepo = new MembershipRepository(db);
        const membership = await memberRepo.findByPersonAndOrg(
          body.personId,
          training.organizationId,
        );

        let registrationDate: Date;
        if (membership?.startDate) {
          registrationDate = new Date(membership.startDate);
        } else {
          // Fallback: use activity date if no membership found (edge case)
          console.warn(
            `[V-12] No membership found for person ${body.personId} in org ${training.organizationId}, falling back to activity date for cycle anchor`,
          );
          registrationDate = activityDate;
        }

        // [BR-11] Read credit cycle config from association (org → association lookup)
        const orgRepo = new OrganizationRepository(db);
        const org = await orgRepo.findById(training.organizationId);
        let cycleConfig: CreditCycleConfig = {
          cyclePeriodYears: DEFAULT_CYCLE_PERIOD_YEARS,
          requiredCredits: DEFAULT_REQUIRED_CREDITS,
          carryoverEnabled: false,
        };
        if (org) {
          const assocRepo = new AssociationRepository(db);
          const assoc = await assocRepo.findById(org.associationId);
          if (assoc) {
            cycleConfig = {
              cyclePeriodYears: assoc.creditCyclePeriod ?? DEFAULT_CYCLE_PERIOD_YEARS,
              requiredCredits: assoc.requiredCreditsPerCycle ?? DEFAULT_REQUIRED_CREDITS,
              carryoverEnabled: assoc.carryoverEnabled ?? false,
              cycleStartMonth: assoc.cycleStartMonth,
              cycleStartDay: assoc.cycleStartDay,
            };
          }
        }

        const cycle = getCycleForDateWithConfig(activityDate, cycleConfig, registrationDate);

        await creditRepo.createOne({
          personId: body.personId,
          organizationId: training.organizationId,
          type: 'auto',
          trainingId: training.id,
          activityName: training.title,
          provider: training.organizationId,
          activityDate,
          creditAmount: training.creditAmount,
          cycleStart: cycle.cycleStart,
          cycleEnd: cycle.cycleEnd,
        });
      }
      // Wave 2b: Trigger credit.issue job for pipeline processing
      const jobs = ctx.get('jobs') as JobScheduler | undefined;
      if (jobs) {
        try {
          await jobs.trigger('credit.issue', {
            sourceType: 'training_completion',
            sourceId: training.id,
            personId: body.personId,
            organizationId: training.organizationId,
            creditAmount: training.creditAmount,
            activityName: training.title,
            cpdActivityType: (training as any).cpdActivityType ?? null,
          });
        } catch {
          // Job trigger failure should not block marking complete
        }
      }
    } catch {
      // Credit creation failure should not block marking complete
    }
  }

  return ctx.json({ data: updated }, 201);
}
