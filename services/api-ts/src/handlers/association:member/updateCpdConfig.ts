import type { Context } from 'hono';
import { eq } from 'drizzle-orm';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { orgCpdConfig } from './repos/credits.schema';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

export async function updateCpdConfig(ctx: Context): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.PRESIDENT, POSITION_TITLES.SECRETARY]);
  if (denied) return denied;
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();
  const organizationId = ctx.req.param('organizationId');
  const body = await ctx.req.json();
  const db = ctx.get('database') as DatabaseInstance;
  const errors: string[] = [];
  if (body.requiredCredits !== undefined && (typeof body.requiredCredits !== 'number' || body.requiredCredits <= 0)) errors.push('requiredCredits must be positive');
  if (body.cycleLengthYears !== undefined && (typeof body.cycleLengthYears !== 'number' || body.cycleLengthYears < 1 || body.cycleLengthYears > 5)) errors.push('cycleLengthYears must be 1-5');
  if (body.sdlCapPercent !== undefined && (typeof body.sdlCapPercent !== 'number' || body.sdlCapPercent < 0 || body.sdlCapPercent > 100)) errors.push('sdlCapPercent must be 0-100');
  if (body.cycleStartMonth !== undefined && (typeof body.cycleStartMonth !== 'number' || body.cycleStartMonth < 1 || body.cycleStartMonth > 12)) errors.push('cycleStartMonth must be 1-12');
  if (errors.length > 0) throw new ValidationError(errors.join('; '));
  const existing = await db.select().from(orgCpdConfig).where(eq(orgCpdConfig.organizationId, organizationId)).limit(1);
  if (existing.length > 0) {
    const [updated] = await db.update(orgCpdConfig).set({ ...(body.requiredCredits !== undefined && { requiredCredits: body.requiredCredits }), ...(body.cycleLengthYears !== undefined && { cycleLengthYears: body.cycleLengthYears }), ...(body.sdlCapPercent !== undefined && { sdlCapPercent: body.sdlCapPercent }), ...(body.activityTypeMinimums !== undefined && { activityTypeMinimums: body.activityTypeMinimums }), ...(body.cycleStartMonth !== undefined && { cycleStartMonth: body.cycleStartMonth }), updatedAt: new Date(), updatedBy: session.user.id }).where(eq(orgCpdConfig.organizationId, organizationId)).returning();
    return ctx.json({ data: updated });
  }
  const [created] = await db.insert(orgCpdConfig).values({ organizationId, requiredCredits: body.requiredCredits ?? 60, cycleLengthYears: body.cycleLengthYears ?? 3, sdlCapPercent: body.sdlCapPercent ?? 40, cycleStartMonth: body.cycleStartMonth ?? 1, activityTypeMinimums: body.activityTypeMinimums ?? null, createdBy: session.user.id, updatedBy: session.user.id }).returning();
  return ctx.json({ data: created }, 201);
}
