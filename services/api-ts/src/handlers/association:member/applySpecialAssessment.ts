/**
 * applySpecialAssessment
 *
 * POST /association/member/special-assessments/{id}/apply
 * Generates duesInvoices for targeted members. Idempotent (BR-T8-004).
 * If appliesTo=all, targets all active members (BR-T8-002).
 * If appliesTo=selected, targets only pre-selected members (BR-T8-003).
 * If fundId set, invoices inherit fund allocation (BR-T8-005).
 */
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';
import { SpecialAssessmentRepository } from './repos/special-assessments.repo';

export async function applySpecialAssessment(
  ctx: ValidatedContext<never, never, any>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Authentication required' }, 401);

  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const params = ctx.req.valid('param');
  const organizationId = ctx.get('organizationId') as string;

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new SpecialAssessmentRepository(db);

  const assessment = await repo.findById(params.id);
  if (!assessment) return ctx.json({ error: 'Assessment not found' }, 404);

  // Determine target person IDs
  let targetPersonIds: string[];
  if (assessment.appliesTo === 'all') {
    targetPersonIds = await repo.getActiveOrgMemberPersonIds(organizationId);
  } else {
    targetPersonIds = await repo.getTargetPersonIds(assessment.id);
  }

  // Get existing targets to check for already-processed members
  const existingTargets = await repo.getTargets(assessment.id);
  const existingPersonIds = new Set(existingTargets.map(t => t.personId));
  const targetsWithInvoice = new Set(
    existingTargets.filter(t => t.invoiceId !== null).map(t => t.personId),
  );

  // If appliesTo=all, ensure targets exist for all active members
  if (assessment.appliesTo === 'all') {
    const newPersonIds = targetPersonIds.filter(pid => !existingPersonIds.has(pid));
    if (newPersonIds.length > 0) {
      await repo.addTargets(assessment.id, newPersonIds);
    }
  }

  // BR-T8-005: fund allocation
  const fundAllocations = assessment.fundId
    ? [{ fundName: assessment.fundId, amount: assessment.amount }]
    : [];

  // Generate invoices for targets that don't already have one (BR-T8-004: idempotent)
  const invoicesCreated: any[] = [];
  let counter = 1;
  for (const personId of targetPersonIds) {
    // Skip if already has invoice (BR-T8-004)
    if (targetsWithInvoice.has(personId)) continue;

    const invoiceNumber = `SA-${assessment.id.slice(0, 8)}-${String(counter).padStart(4, '0')}`;
    const invoice = await repo.createInvoiceForTarget({
      personId,
      organizationId,
      totalAmount: assessment.amount,
      currency: assessment.currency,
      periodStart: assessment.dueDate,
      periodEnd: assessment.dueDate,
      invoiceNumber,
      fundAllocations,
      membershipId: personId, // use personId as fallback membershipId
    });

    await repo.markTargetWithInvoice(assessment.id, personId, invoice!.id);
    invoicesCreated.push(invoice);
    counter++;
  }

  // Set status to active
  await repo.setStatus(assessment.id, 'active');

  return ctx.json({
    message: 'Assessment applied',
    invoicesCreated: invoicesCreated.length,
    skipped: targetsWithInvoice.size,
  }, 200);
}
