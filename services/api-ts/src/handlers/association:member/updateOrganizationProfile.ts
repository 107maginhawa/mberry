import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError, NotFoundError, ValidationError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateOrganizationProfileBody, UpdateOrganizationProfileParams } from '@/generated/openapi/validators';
import { eq } from 'drizzle-orm';
import { organizations } from '@/handlers/platformadmin/repos/platform-admin.schema';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
import { domainEvents } from '@/core/domain-events';

const ALLOWED_LOGO_MIME_PREFIXES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const SVG_SIGNATURES = ['<svg', '<?xml', 'xmlns="http://www.w3.org/2000/svg"'];

/**
 * updateOrganizationProfile
 *
 * Path: PUT /association/member/org-profile/{organizationId}
 * OperationId: updateOrganizationProfile
 */
export async function updateOrganizationProfile(
  ctx: ValidatedContext<UpdateOrganizationProfileBody, never, UpdateOrganizationProfileParams>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  // P0: Block SVG uploads to prevent stored XSS
  if (body.logoUrl && typeof body.logoUrl === 'string') {
    const lower = body.logoUrl.toLowerCase();
    if (SVG_SIGNATURES.some(sig => lower.includes(sig.toLowerCase()))) {
      throw new ValidationError('SVG logos are not allowed — use PNG, JPEG, GIF, or WebP');
    }
  }
  const bodyRecord = body as Record<string, unknown>;
  if (bodyRecord['logoMimeType'] && typeof bodyRecord['logoMimeType'] === 'string') {
    const mime = (bodyRecord['logoMimeType'] as string).toLowerCase();
    if (mime.includes('svg') || !ALLOWED_LOGO_MIME_PREFIXES.some(p => mime.startsWith(p))) {
      throw new ValidationError('Logo must be PNG, JPEG, GIF, or WebP format');
    }
  }

  const existing = await db.select().from(organizations).where(eq(organizations.id, params.organizationId)).limit(1);
  if (!existing.length) throw new NotFoundError('Organization');

  const updated = await db
    .update(organizations)
    .set({ ...body, updatedAt: new Date() } as Record<string, unknown>)
    .where(eq(organizations.id, params.organizationId))
    .returning();

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'organization-profile',
    resourceId: params.organizationId,
    description: 'Organization profile updated',
  });

  domainEvents.emit('org.settings.updated', {
    organizationId: params.organizationId,
    updatedBy: session.user.id,
    updatedFields: Object.keys(bodyRecord),
  }).catch(() => {});

  return ctx.json(updated[0], 200);
}