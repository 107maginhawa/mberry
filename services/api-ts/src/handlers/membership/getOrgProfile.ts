import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { OrganizationRepository } from '../platformadmin/repos/platform-admin.repo';

/**
 * getOrgProfile
 *
 * Officer-accessible endpoint to read organization profile.
 * Route: GET /membership/org-profile/:orgId
 */
export async function getOrgProfile(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const logger = ctx.get('logger');
  const orgId = ctx.req.param('orgId');

  const repo = new OrganizationRepository(db, logger);
  const org = await repo.findById(orgId);
  if (!org) throw new NotFoundError('Organization not found');

  return ctx.json({
    data: {
      id: org.id,
      name: org.name || '',
      slug: org.slug || '',
      contactEmail: org.contactEmail || '',
      region: org.region || '',
      orgType: org.orgType || '',
      status: org.status || '',
      // Fields the frontend expects but the schema doesn't have yet:
      description: '',
      logoUrl: '',
      phone: '',
      address: '',
      website: '',
      foundingDate: '',
    },
  }, 200);
}
