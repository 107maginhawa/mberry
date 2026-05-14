/**
 * listEmailSuppressions
 *
 * Officer/admin-only endpoint to query the org-scoped suppression list.
 *
 * Security: T-25-09 — Requires admin role; all queries are org-scoped to
 * organizationId from session context to prevent cross-tenant reads.
 *
 * Path: GET /email/suppressions
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ForbiddenError } from '@/core/errors';
import { SuppressionRepository } from './repos/suppression.repo';

export async function listEmailSuppressions(c: Context): Promise<Response> {
  // Auth check — user must be present
  const user = c.get('user') as User | null;
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Role check — admin only (T-25-09)
  const userRoles = user.role ? user.role.split(',').map(r => r.trim()) : [];
  if (!userRoles.includes('admin')) {
    throw new ForbiddenError('Admin role required for email suppression list');
  }

  // Org scope — from context (set by orgContextMiddleware)
  const orgId = c.get('organizationId') as string;

  // Pagination from query params
  const rawLimit = c.req.query('limit');
  const rawOffset = c.req.query('offset');
  const limit = rawLimit ? Math.min(parseInt(rawLimit, 10) || 50, 200) : 50;
  const offset = rawOffset ? parseInt(rawOffset, 10) || 0 : 0;

  // Get suppressions
  const db = c.get('database') as DatabaseInstance;
  const logger = c.get('logger');
  const repo = new SuppressionRepository(db, logger);

  const result = await repo.listByOrg(orgId, { pagination: { limit, offset } });

  logger?.info({
    action: 'list_email_suppressions',
    userId: user.id,
    orgId,
    resultCount: Array.isArray(result) ? result.length : (result as any).data?.length ?? 0,
  }, 'Email suppressions listed');

  // Support both array result (legacy) and paginated result
  if (Array.isArray(result)) {
    return c.json({ data: result, total: result.length }, 200);
  }

  return c.json(result, 200);
}
