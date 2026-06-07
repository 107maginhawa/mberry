/**
 * Officer-gated authorization middleware (P1.5).
 *
 * Replaces `requireOfficerTerm()` from utils/officer-check.ts and any
 * hand-rolled `OfficerTermRepository.findActiveByPersonAndOrg` + "any
 * term" check in handlers. Any active officer term in :organizationId
 * passes (no title filter).
 *
 * Driven by TypeSpec `@extension("x-require-officer", true)` on the
 * operation; the generator emits `requireOfficerMiddleware()` into
 * routes.ts between authMiddleware and validators.
 *
 * P1-3: When the officer holds any privileged position (President,
 * Treasurer, Secretary), enforces 2FA in production.
 */

import type { Context, Next } from 'hono';
import { ForbiddenError, ValidationError } from '@/core/errors';
import { getGovernancePort, type GovernancePort } from '@/core/ports';

const PRIVILEGED_POSITIONS = new Set(['president', 'treasurer', 'secretary']);

export interface RequireOfficerDeps {
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

export function requireOfficerMiddleware(deps: RequireOfficerDeps = {}) {
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

    const holdsPrivileged = terms.some(t => {
      const title = ((t.positionTitle as string) ?? '').toLowerCase();
      return PRIVILEGED_POSITIONS.has(title);
    });
    const isDev = process.env['NODE_ENV'] !== 'production';
    if (holdsPrivileged && !user.twoFactorEnabled && !isDev) {
      throw new ForbiddenError(
        'Two-factor authentication required for privileged officer positions (President, Treasurer, Secretary). Please enable 2FA in your account settings.',
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
