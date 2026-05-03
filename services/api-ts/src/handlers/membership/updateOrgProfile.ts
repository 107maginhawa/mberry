import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { OrganizationRepository } from '../platformadmin/repos/platform-admin.repo';

/**
 * updateOrgProfile
 *
 * Officer-accessible endpoint to update organization profile.
 * Route: PUT /membership/org-profile/:orgId
 */
export async function updateOrgProfile(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const logger = ctx.get('logger');
  const orgId = ctx.req.param('orgId');

  const repo = new OrganizationRepository(db, logger);
  const existing = await repo.findById(orgId);
  if (!existing) throw new NotFoundError('Organization not found');

  const body = await ctx.req.json();

  // Only allow updating fields that exist in the schema
  const updates: Record<string, any> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.contactEmail !== undefined) updates.contactEmail = body.contactEmail;
  if (body.region !== undefined) updates.region = body.region;

  const updated = await repo.update(orgId, updates);

  return ctx.json({
    data: {
      id: updated!.id,
      name: updated!.name || '',
      slug: updated!.slug || '',
      contactEmail: updated!.contactEmail || '',
      region: updated!.region || '',
      orgType: updated!.orgType || '',
      status: updated!.status || '',
      description: '',
      logoUrl: '',
      phone: '',
      address: '',
      website: '',
      foundingDate: '',
    },
  }, 200);
}
