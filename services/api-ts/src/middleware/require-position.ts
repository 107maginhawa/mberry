/**
 * Position-gated officer authorization middleware (P1.5).
 *
 * Replaces hand-called `requirePosition()` from utils/officer-check.ts.
 * Verifies the authenticated user has an active officer term in the
 * organization specified by the `:organizationId` route parameter AND
 * holds at least one of the allowed position titles (case-insensitive,
 * OR semantics).
 *
 * Driven by TypeSpec `@extension("x-require-position", #["Treasurer", ...])`
 * on the operation; the generator emits `requirePositionMiddleware({...})`
 * into routes.ts between authMiddleware and validators.
 *
 * P1-3: Enforces 2FA for privileged positions (President, Treasurer,
 * Secretary) when any allowed title is privileged. Skipped outside
 * production for dev ergonomics.
 */

import type { Context, Next } from 'hono';
import { ForbiddenError, ValidationError } from '@/core/errors';
import { getGovernancePort, type GovernancePort } from '@/core/ports';

const PRIVILEGED_POSITIONS = new Set(['president', 'treasurer', 'secretary']);

export interface RequirePositionDeps {
  titles: string[];
  /**
   * Optional override for the governance port. Tests inject a fake to
   * avoid the dynamic-import + DB round-trip. Production resolves the
   * adapter via `getGovernancePort(db)`.
   */
  governancePort?: GovernancePort;
  /**
   * Where to read the organization id from. Default is `path` (reads
   * `:organizationId` path param). When `body`, reads from
   * `ctx.req.valid('json')[bodyField]` — the middleware must be
   * registered AFTER the zValidator for the body. Generator handles
   * emission order automatically.
   */
  orgIdFrom?: 'path' | 'body';
  /** Body field to read when `orgIdFrom: 'body'`. Defaults to `orgId`. */
  bodyField?: string;
}

export function requirePositionMiddleware(deps: RequirePositionDeps) {
  const normalizedAllowed = deps.titles.map(t => t.toLowerCase());
  const requestingPrivileged = normalizedAllowed.some(t => PRIVILEGED_POSITIONS.has(t));
  const orgIdFrom = deps.orgIdFrom ?? 'path';
  const bodyField = deps.bodyField ?? 'orgId';

  return async (ctx: Context, next: Next) => {
    const user = ctx.get('user');
    if (!user) throw new ForbiddenError('Authentication required');

    const orgId = resolveOrgId(ctx, orgIdFrom, bodyField);
    if (!orgId) {
      const where = orgIdFrom === 'body' ? `body field "${bodyField}"` : ':organizationId path parameter';
      throw new ValidationError(`Missing organization context — route must supply ${where}`);
    }

    const db = ctx.get('database');
    const port = deps.governancePort ?? (await getGovernancePort(db));
    const terms = await port.findActiveOfficerTermsByPersonAndOrg(user.id, orgId);

    if (terms.length === 0) {
      throw new ForbiddenError('Officer access required for this organization');
    }

    const hasMatch = terms.some(t => {
      const title = ((t.positionTitle as string) ?? '').toLowerCase();
      return normalizedAllowed.includes(title);
    });
    if (!hasMatch) {
      throw new ForbiddenError(`Position access denied. Required: ${deps.titles.join(', ')}`);
    }

    const isDev = process.env['NODE_ENV'] !== 'production';
    if (requestingPrivileged && !user.twoFactorEnabled && !isDev) {
      throw new ForbiddenError(
        'Two-factor authentication required for privileged officer positions. Please enable 2FA in your account settings.',
      );
    }

    return next();
  };
}

function resolveOrgId(ctx: Context, from: 'path' | 'body', bodyField: string): string | undefined {
  if (from === 'body') {
    let body: Record<string, unknown> | undefined;
    try {
      body = ctx.req.valid('json' as never) as Record<string, unknown> | undefined;
    } catch {
      body = undefined;
    }
    const value = body?.[bodyField];
    return typeof value === 'string' ? value : undefined;
  }
  return ctx.req.param('organizationId') ?? (ctx.get('organizationId') as string | undefined);
}
