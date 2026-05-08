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

/**
 * Position-specific officer check (D-03, D-04, D-05, D-08).
 *
 * Extends requireOfficerTerm by additionally verifying the officer's active
 * position title matches one of the allowed titles (case-insensitive).
 *
 * Per D-04: ANY matching position in allowedTitles grants access (OR logic).
 * Per D-05: No need to call requireOfficerTerm separately — this handles the full check.
 * Per D-08: Matching is case-insensitive; titles come from DB, never from the request.
 * Per T-13-01: Titles are sourced from DB JOIN (findActiveByPersonAndOrg), not client input.
 *
 * @param ctx          - Hono context (BaseContext)
 * @param allowedTitles - Position titles that are permitted (e.g. ['Treasurer', 'President'])
 * @returns null if allowed, 403 Response otherwise
 */
export async function requirePosition(
  ctx: BaseContext,
  allowedTitles: string[],
): Promise<Response | null> {
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

  // Case-insensitive position title matching (D-08)
  const normalizedAllowed = allowedTitles.map(t => t.toLowerCase());
  const hasMatch = terms.some(t =>
    normalizedAllowed.includes((t.positionTitle as string).toLowerCase()),
  );

  if (!hasMatch) {
    return ctx.json(
      { error: 'Position access denied. Required: ' + allowedTitles.join(', ') },
      403,
    );
  }

  return null; // allowed
}
