import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError, ForbiddenError } from '@/core/errors';
import type { UpdateMyPrivacySettingsBody } from '@/generated/openapi/validators';
import { eq, and, inArray } from 'drizzle-orm';
import { personPrivacySettings } from './repos/privacy-settings.schema';
import { memberships } from '@/handlers/association:member/repos/membership.schema';
import { auditAction } from '@/utils/audit';

/**
 * updateMyPrivacySettings
 *
 * Path: PATCH /privacy
 * OperationId: updateMyPrivacySettings
 */
export async function updateMyPrivacySettings(
  ctx: ValidatedContext<UpdateMyPrivacySettingsBody, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const personId = session.user.id;
  const body = ctx.req.valid('json');
  const b = body as Record<string, unknown>;

  if (!b['organizationId']) throw new ValidationError('organizationId is required');

  // Verify membership
  const [membership] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(
      eq(memberships.personId, personId),
      eq(memberships.organizationId, b['organizationId'] as string),
      inArray(memberships.status, ['active', 'gracePeriod']),
    ))
    .limit(1);

  if (!membership) throw new ForbiddenError('Not a member of this organization');

  const [existing] = await db
    .select()
    .from(personPrivacySettings)
    .where(and(
      eq(personPrivacySettings.personId, personId),
      eq(personPrivacySettings.organizationId, b['organizationId'] as string),
    ))
    .limit(1);

  const updates = {
    emailVisible: (b['emailVisible'] as boolean | undefined) ?? existing?.emailVisible ?? false,
    phoneVisible: (b['phoneVisible'] as boolean | undefined) ?? existing?.phoneVisible ?? false,
    photoVisible: (b['photoVisible'] as boolean | undefined) ?? existing?.photoVisible ?? true,
    addressVisible: (b['addressVisible'] as boolean | undefined) ?? existing?.addressVisible ?? false,
  };

  let row;
  if (existing) {
    [row] = await db
      .update(personPrivacySettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(personPrivacySettings.id, existing.id))
      .returning();
  } else {
    [row] = await db
      .insert(personPrivacySettings)
      .values({ personId, organizationId: b['organizationId'] as string, ...updates })
      .returning();
  }

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'privacy-settings',
    resourceId: personId,
    description: 'Self-service privacy settings update',
    details: { orgId: b['organizationId'] as string },
  });

  return ctx.json(row, existing ? 200 : 201);
}
