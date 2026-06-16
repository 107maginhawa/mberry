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
 * Outcome:
 *  - 2xx/3xx  → `outcome: 'success'`.
 *  - 4xx/5xx  → `outcome: 'denied'` (403) or `'failure'` (all other ≥400),
 *               with `{ statusCode, failureReason }` merged into details.
 *
 * Healthcare-AMS compliance: denied/forbidden/conflict mutations on TypeSpec
 * routes MUST leave an audit row — the failure path is not skipped.
 *
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
    | 'deceased' | 'suspend' | 'unsuspend'
    | 'read' | 'export'
    | 'capture' | 'finalize';
  resourceType: string;
  eventSubType?: AuditEventSubType | string;
  eventType?: 'data-modification' | 'data-access';
}

export function createPerRouteAuditMiddleware(meta: PerRouteAuditMeta) {
  return async (ctx: Context<{ Variables: Variables }>, next: Next): Promise<void> => {
    let handlerError: unknown;
    try {
      await next();
    } catch (e) {
      handlerError = e;
    }

    const audit = ctx.get('audit');
    if (audit) {
      const logger = ctx.get('logger');
      const user = ctx.get('user') as { id?: string } | undefined;
      const orgId = ctx.get('organizationId') as string | undefined;
      const ipAddress = ctx.req.header('x-forwarded-for') || ctx.req.header('x-real-ip');
      const userAgent = ctx.req.header('user-agent');

      const events = ctx.get('auditEvents') as AuditEventEntry[] | undefined;

      // Multi-event mode: handler set ctx.auditEvents. Emit one log per entry.
      // Throw-safety: when handler throws after pushing entries, still emit so
      // pre-throw mutations have audit rows. Validation-failure responses (4xx
      // without a throw) still skip — the handler had no chance to mutate.
      if (events !== undefined) {
        const skipForValidationResponse = handlerError === undefined && ctx.res.status >= 400;
        if (!skipForValidationResponse) {
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
        }
      } else {
        // Single-event mode: composed from static route metadata + ctx setters.
        const statusCode = handlerError !== undefined ? 500 : ctx.res.status;
        const isFailure = statusCode >= 400;

        // Failure path (4xx/5xx or handler throw): emit a 'denied'/'failure'
        // audit row so denied/forbidden/conflict mutations are never silent.
        // Healthcare AMS requires every failed mutation to be auditable.
        const outcome: 'success' | 'failure' | 'denied' = !isFailure
          ? 'success'
          : statusCode === 403
            ? 'denied'
            : 'failure';

        const resourceId =
          (ctx.get('auditResourceId') as string | undefined) ??
          firstPathParam(ctx) ??
          'unknown';

        const failureSuffix = isFailure ? ` (failed: ${statusCode})` : '';
        const description =
          (ctx.get('auditDescription') as string | undefined) ??
          `${meta.action} ${meta.resourceType} ${resourceId}${failureSuffix}`;

        const baseDetails = ctx.get('auditDetails') as Record<string, unknown> | undefined;
        const details = isFailure
          ? {
              ...(baseDetails ?? {}),
              statusCode,
              failureReason:
                handlerError !== undefined
                  ? handlerError instanceof Error
                    ? handlerError.message
                    : String(handlerError)
                  : `HTTP ${statusCode}`,
            }
          : baseDetails;

        try {
          await audit.logEvent({
            eventType: meta.eventType ?? 'data-modification',
            eventSubType: meta.eventSubType,
            category: 'association',
            action: meta.action,
            outcome,
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
      }
    }

    if (handlerError !== undefined) throw handlerError;
  };
}

function firstPathParam(ctx: Context): string | undefined {
  const params = ctx.req.param() as unknown as Record<string, string> | undefined;
  if (!params) return undefined;
  const keys = Object.keys(params);
  if (!keys.length) return undefined;
  return params[keys[0]!];
}
