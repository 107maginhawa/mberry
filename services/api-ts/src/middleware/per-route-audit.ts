/**
 * Per-route audit middleware (P1.5).
 *
 * Replaces hand-called `auditAction()` in handlers. Driven by TypeSpec
 * `@extension("x-audit", #{ action, resourceType, eventSubType?, eventType? })`
 * on the operation; the generator emits `createPerRouteAuditMiddleware({...})`
 * into the generated `routes.ts`.
 *
 * After-middleware: calls `next()` first, then composes the audit event from
 * static route metadata + dynamic ctx setters populated by the handler
 * (`auditResourceId`, `auditDescription`, `auditDetails`).
 *
 * Skipped when response status >= 400 (validation failures, 4xx, 5xx).
 * Audit-service failures are caught and logged — they never propagate.
 */

import type { Context, Next } from 'hono';
import type { Variables, AuditEventEntry } from '@/types/app';
import type { AuditEventSubType } from '@/utils/audit-events';

export interface PerRouteAuditMeta {
  action:
    | 'create' | 'update' | 'delete'
    | 'approve' | 'deny' | 'renew'
    | 'terminate' | 'reinstate' | 'mark-paid'
    | 'complete' | 'transfer' | 'resign'
    | 'deceased' | 'read' | 'export'
    | 'capture' | 'finalize';
  resourceType: string;
  eventSubType?: AuditEventSubType | string;
  eventType?: 'data-modification' | 'data-access';
}

export function createPerRouteAuditMiddleware(meta: PerRouteAuditMeta) {
  return async (ctx: Context<{ Variables: Variables }>, next: Next): Promise<void> => {
    await next();

    const audit = ctx.get('audit');
    if (!audit) return;
    if (ctx.res.status >= 400) return;

    const logger = ctx.get('logger');
    const user = ctx.get('user') as { id?: string } | undefined;
    const orgId = ctx.get('organizationId') as string | undefined;
    const ipAddress = ctx.req.header('x-forwarded-for') || ctx.req.header('x-real-ip');
    const userAgent = ctx.req.header('user-agent');

    const events = ctx.get('auditEvents') as AuditEventEntry[] | undefined;

    // Multi-event mode: handler set ctx.auditEvents. Emit one log per entry.
    // Empty array is intentional ("no logging this request") — no fallback.
    if (events !== undefined) {
      for (const entry of events) {
        try {
          await audit.logEvent({
            eventType: entry.eventType ?? meta.eventType ?? 'data-modification',
            eventSubType: entry.eventSubType,
            category: 'association',
            action: entry.action,
            outcome: 'success',
            organizationId: orgId,
            user: user?.id,
            userType: 'client' as const,
            resourceType: entry.resourceType,
            resource: entry.resource,
            description: entry.description ?? `${entry.action} ${entry.resourceType} ${entry.resource}`,
            details: entry.details,
            ipAddress,
            userAgent,
          });
        } catch (error) {
          logger?.error({ error, entry }, 'Per-route audit middleware failed to log event (multi-event mode)');
        }
      }
      return;
    }

    // Single-event mode: compose from static route metadata + ctx setters.
    const resourceId =
      (ctx.get('auditResourceId') as string | undefined) ??
      firstPathParam(ctx) ??
      'unknown';

    const description =
      (ctx.get('auditDescription') as string | undefined) ??
      `${meta.action} ${meta.resourceType} ${resourceId}`;

    const details = ctx.get('auditDetails') as Record<string, unknown> | undefined;

    try {
      await audit.logEvent({
        eventType: meta.eventType ?? 'data-modification',
        eventSubType: meta.eventSubType,
        category: 'association',
        action: meta.action,
        outcome: 'success',
        organizationId: orgId,
        user: user?.id,
        userType: 'client' as const,
        resourceType: meta.resourceType,
        resource: resourceId,
        description,
        details,
        ipAddress,
        userAgent,
      });
    } catch (error) {
      logger?.error({ error, meta }, 'Per-route audit middleware failed to log event');
    }
  };
}

function firstPathParam(ctx: Context): string | undefined {
  const params = ctx.req.param() as unknown as Record<string, string> | undefined;
  if (!params) return undefined;
  const keys = Object.keys(params);
  if (!keys.length) return undefined;
  return params[keys[0]!];
}
