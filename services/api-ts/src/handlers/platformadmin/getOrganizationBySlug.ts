import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import { OrganizationRepository, AssociationRepository } from './repos/platform-admin.repo';

/**
 * getOrganizationBySlug
 *
 * Path: GET /public/org/:slug
 * Public endpoint — no auth required.
 * Returns org public profile or 404.
 */
export async function getOrganizationBySlug(
  ctx: BaseContext
): Promise<Response> {
  const slug = ctx.req.param('slug');
  if (!slug?.trim()) {
    throw new NotFoundError('Organization not found');
  }
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const orgRepo = new OrganizationRepository(db, logger);

  const org = await orgRepo.findBySlug(slug);

  if (!org || org.status === 'cancelled') {
    throw new NotFoundError('Organization not found');
  }

  const assocRepo = new AssociationRepository(db, logger);
  const association = await assocRepo.findById(org.associationId);

  return ctx.json({
    id: org.id,
    name: org.name,
    slug: org.slug,
    orgType: org.orgType,
    region: org.region,
    contactEmail: org.contactEmail,
    status: org.status,
    associationName: association?.name ?? null,
  }, 200);
}
