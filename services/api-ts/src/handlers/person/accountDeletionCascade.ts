/**
 * Account Deletion Cascade — Flow 6.6 (event-emit thin wrapper)
 *
 * This function used to inline a 19-step cascade across every module that
 * references a person. It is now an emit-only shim: it publishes
 * `person.deleted` on the domain event bus and returns immediately.
 *
 * The actual per-module cleanup (anonymize/delete/soft-delete) is implemented
 * by subscribers registered in `services/api-ts/src/core/domain-event-consumers.ts`.
 *
 * BR-32 (financial-record preservation) and DPA 2012 anonymization rules now
 * live with each module's subscriber rather than centrally here.
 */

import type { DatabaseInstance } from '@/core/database';
import { domainEvents } from '@/core/domain-events';

// ─── Types ──────────────────────────────────────────────────

export interface CascadeResult {
  emitted: true;
  personId: string;
  emittedAt: string;
}

interface CascadeContext {
  db: DatabaseInstance;
  personId: string;
  logger?: any;
}

// ─── Main Executor ──────────────────────────────────────────

/**
 * Emit a `person.deleted` domain event. Subscribers in
 * `core/domain-event-consumers.ts` perform the actual cascade.
 */
export async function executeCascadeDeletion(ctx: CascadeContext): Promise<CascadeResult> {
  const emittedAt = new Date().toISOString();
  await domainEvents.emit('person.deleted', {
    personId: ctx.personId,
    scheduledAt: emittedAt,
  });
  ctx.logger?.info?.({ personId: ctx.personId }, 'Account deletion cascade emitted');
  return { emitted: true, personId: ctx.personId, emittedAt };
}
