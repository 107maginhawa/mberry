import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { eq, and, inArray } from 'drizzle-orm';
import { ValidationError, ForbiddenError } from '@/core/errors';
import { personPrivacySettings } from './repos/privacy-settings.schema';
import { memberships } from '@/handlers/association:member/repos/membership.schema';

/**
 * updatePrivacySettings
 *
 * Path: PATCH /persons/me/privacy
 * Body: { orgId, emailVisible?, phoneVisible?, photoVisible?, addressVisible? }
 *
 * Upserts privacy settings for the authenticated user in a given org.
 */
export async function updatePrivacySettings(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const body = await ctx.req.json().catch(() => null) as any;
  if (!body?.orgId) {
    throw new ValidationError('orgId is required');
  }

  const db = ctx.get('database') as DatabaseInstance;

  // Verify user belongs to this org
  const [membership] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(
      eq(memberships.personId, user.id),
      eq(memberships.orgId, body.orgId),
      inArray(memberships.status, ['active', 'gracePeriod']),
    ))
    .limit(1);

  if (!membership) {
    throw new ForbiddenError('Not a member of this organization');
  }

  // Check if row exists
  const [existing] = await db
    .select()
    .from(personPrivacySettings)
    .where(and(
      eq(personPrivacySettings.personId, user.id),
      eq(personPrivacySettings.orgId, body.orgId),
    ))
    .limit(1);

  const updates = {
    emailVisible: body.emailVisible ?? existing?.emailVisible ?? false,
    phoneVisible: body.phoneVisible ?? existing?.phoneVisible ?? false,
    photoVisible: body.photoVisible ?? existing?.photoVisible ?? true,
    addressVisible: body.addressVisible ?? existing?.addressVisible ?? false,
  };

  if (existing) {
    const [row] = await db
      .update(personPrivacySettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(personPrivacySettings.id, existing.id))
      .returning();
    return ctx.json(row, 200);
  }

  const [row] = await db
    .insert(personPrivacySettings)
    .values({
      personId: user.id,
      orgId: body.orgId,
      ...updates,
    })
    .returning();

  return ctx.json(row, 201);
}
