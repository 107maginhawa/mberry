/**
 * Audit logging helper for data-modifying handlers.
 *
 * Wraps the audit service's logEvent() with user/IP extraction and
 * try/catch so audit failures never crash the handler.
 */

import type { BaseContext } from '@/types/app';

interface AuditActionOpts {
  action: 'create' | 'update' | 'delete' | 'approve' | 'deny' | 'renew' | 'terminate' | 'reinstate' | 'mark-paid' | 'complete' | 'transfer';
  resourceType: string;
  resourceId: string;
  description: string;
  details?: Record<string, unknown>;
}

/**
 * Log an audit event for a data-modifying operation.
 * Fire-and-forget with try/catch — never blocks the response.
 */
export async function auditAction(ctx: BaseContext, opts: AuditActionOpts): Promise<void> {
  const audit = ctx.get('audit');
  if (!audit) return;

  const user = ctx.get('user');
  const orgId = ctx.get('organizationId');
  const logger = ctx.get('logger');

  try {
    await audit.logEvent({
      eventType: 'data-modification',
      category: 'association',
      action: opts.action,
      outcome: 'success',
      organizationId: orgId,
      user: user?.id,
      userType: 'client' as const,
      resourceType: opts.resourceType,
      resource: opts.resourceId,
      description: opts.description,
      details: opts.details,
      ipAddress: ctx.req.header('x-forwarded-for') || ctx.req.header('x-real-ip'),
      userAgent: ctx.req.header('user-agent'),
    });
  } catch (error) {
    logger?.error({ error, ...opts }, 'Failed to log audit event');
  }
}
