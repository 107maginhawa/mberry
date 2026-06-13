/**
 * deleteEmailSuppression
 *
 * Admin-only endpoint to remove an email suppression by ID — lets an admin
 * unblock a wrongly or mistyped-suppressed address (WF-125 / FIX-007).
 *
 * Security: admin role required (mirrors the suppression GET endpoint, T-25-09).
 * All access is org-scoped to organizationId from session context to prevent
 * cross-tenant deletes (T-25-02). RBAC + audit are also enforced by the
 * generated route middleware (`x-security-required-roles` + `x-audit`); the
 * inline admin check is defense-in-depth, matching the sibling email handlers.
 *
 * Path: DELETE /email/suppressions/{id}
 * OperationId: deleteEmailSuppression
 */

import type { ValidatedContext } from '@/types/app';
import type { DeleteEmailSuppressionParams } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ForbiddenError, NotFoundError } from '@/core/errors';
import { SuppressionRepository } from './repos/suppression.repo';

export async function deleteEmailSuppression(
  ctx: ValidatedContext<never, never, DeleteEmailSuppressionParams>
): Promise<Response> {
  // Auth check — user must be present
  const user = ctx.get('user') as User | null;
  if (!user) {
    return ctx.json({ error: 'Unauthorized' }, 401);
  }

  // Role check — admin only (mirrors listEmailSuppressions, T-25-09)
  const userRoles = user.role ? user.role.split(',').map((r) => r.trim()) : [];
  if (!userRoles.includes('admin')) {
    throw new ForbiddenError('Admin role required for email suppression management');
  }

  // Extract validated path param
  const params = ctx.req.valid('param') as { id: string };

  // Org scope — from context (set by orgContextMiddleware on /email/*)
  const orgId = ctx.get('organizationId') as string;

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new SuppressionRepository(db, logger);

  // Org-scoped delete; null means the suppression isn't in this org → 404
  const removed = await repo.deleteByIdForOrg(params.id, orgId);

  if (!removed) {
    throw new NotFoundError('Email suppression not found', {
      resourceType: 'email-suppression',
      resource: params.id,
      suggestions: ['Verify the suppression ID', 'Confirm it belongs to your organization'],
    });
  }

  logger?.info({
    action: 'delete_email_suppression',
    userId: user.id,
    orgId,
    suppressionId: params.id,
    email: removed.email,
    reason: removed.reason,
  }, 'Email suppression removed by admin');

  // Dynamic audit fields consumed by the generated x-audit middleware
  ctx.set('auditResourceId', params.id);
  ctx.set('auditDescription', `Email suppression removed: ${removed.email} (${removed.reason})`);
  ctx.set('auditDetails', { email: removed.email, reason: removed.reason });

  // 204 No Content per TypeSpec ApiNoContentResponse
  return ctx.body(null, 204);
}
