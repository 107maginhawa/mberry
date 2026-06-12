/**
 * Audit logging helper for handlers.
 *
 * Wraps the audit service's logEvent() with user/IP extraction and
 * try/catch so audit failures never crash the handler.
 */

import type { BaseContext } from '@/types/app';
import type { AuditEventSubType } from '@/utils/audit-events';

interface AuditActionOpts {
  action: 'create' | 'update' | 'delete' | 'approve' | 'deny' | 'renew' | 'terminate' | 'reinstate' | 'mark-paid' | 'complete' | 'transfer' | 'resign' | 'deceased' | 'suspend' | 'unsuspend' | 'read' | 'export' | 'capture' | 'finalize';
  resourceType: string;
  resourceId: string;
  description: string;
  details?: Record<string, unknown>;
  eventSubType?: AuditEventSubType | string;  // typed audit sub-type like 'financial.payment-recorded'
  eventType?: 'data-modification' | 'data-access';  // defaults to 'data-modification'
}

/**
 * Log an audit event for a data-modifying or data-access operation.
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
      eventType: opts.eventType ?? 'data-modification',
      eventSubType: opts.eventSubType,
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
