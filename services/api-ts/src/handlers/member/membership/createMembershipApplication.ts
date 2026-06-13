import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError, ConflictError } from '@/core/errors';
import type { CreateMembershipApplicationBody } from '@/generated/openapi/validators';
import { MembershipTierRepository, MembershipApplicationRepository } from '@/handlers/association:member/repos/membership.repo';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * createMembershipApplication
 *
 * Path: POST /association/member/applications
 * OperationId: createMembershipApplication
 */
export async function createMembershipApplication(
  ctx: ValidatedContext<CreateMembershipApplicationBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');

  // FIX-013 (G-15): a user may self-apply, but submitting an application ON
  // BEHALF of another person (personId !== caller) requires officer authority.
  // Without this gate any authenticated user could create an application as
  // someone else (object-level IDOR). Self-apply stays open; the legitimate
  // officer-on-behalf flow is preserved behind a position check.
  if (body.personId !== user.id) {
    const denied = await requirePosition(ctx, [POSITION_TITLES.SECRETARY, POSITION_TITLES.PRESIDENT]);
    if (denied) return denied;
  }

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const tierRepo = new MembershipTierRepository(db, logger);
  const appRepo = new MembershipApplicationRepository(db, logger);

  // Validate tier exists AND belongs to the caller's org.
  // FIX-013 (G-15): previously only existence was checked, so an application
  // could be bound to a tier from a different organization. We surface a
  // NotFoundError (not the foreign org's existence) to avoid leaking that a
  // tier id exists in another org.
  const tier = await tierRepo.findOneById(body.tierId);
  if (!tier || tier.organizationId !== orgId) throw new NotFoundError('Membership tier');

  // FIX-012 / M5-R5: block a duplicate while ANY pre-decision application
  // already exists for this person+org — not just 'submitted'. An application
  // already moved to 'underReview' must also block a new one.
  const PRE_DECISION_STATUSES = ['submitted', 'underReview'] as const;
  for (const status of PRE_DECISION_STATUSES) {
    const existing = await appRepo.findOne({
      organizationId: orgId,
      personId: body.personId,
      status,
    });
    if (existing) {
      throw new ConflictError('A pending application already exists for this person in this organization');
    }
  }

  const application = await appRepo.createOne({
    organizationId: orgId,
    personId: body.personId,
    tierId: body.tierId,
    applicationDate: (body.applicationDate || new Date().toISOString().split('T')[0]) as string,
    status: 'submitted',
  });

  ctx.set('auditResourceId', application.id);
  ctx.set('auditDescription', 'Membership application created');

  return ctx.json(application, 201);
}
