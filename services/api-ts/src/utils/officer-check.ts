/**
 * Handler-level officer term check for generated /association/* routes.
 *
 * Unlike officerAuthMiddleware (which runs as Hono middleware and throws),
 * this returns a 403 Response or null (per requireOrgRole convention from D-09).
 *
 * Required because orgContextMiddleware sets role='member' for ALL users,
 * making requireOrgRole() unable to distinguish members from officers.
 */
import type { BaseContext } from '@/types/app';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

export async function requireOfficerTerm(ctx: BaseContext): Promise<Response | null> {
  const user = ctx.get('user');
  if (!user) {
    return ctx.json({ error: 'Authentication required' }, 401);
  }

  const orgId = ctx.get('orgId');
  if (!orgId) {
    return ctx.json({ error: 'Organization context required' }, 403);
  }

  const db = ctx.get('database');
  const repo = new OfficerTermRepository(db);
  const terms = await repo.findActiveByPersonAndOrg(user.id, orgId);

  if (terms.length === 0) {
    return ctx.json({ error: 'Officer access required for this organization' }, 403);
  }

  return null; // allowed
}
