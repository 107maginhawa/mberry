/**
 * Domain Event Bus
 *
 * Lightweight in-process event bus for cross-module communication.
 * Fire-and-forget within the request lifecycle — handlers run async,
 * errors are caught per-handler so one failure doesn't block others.
 *
 * Not distributed. Can upgrade to pg-boss queued delivery later if needed.
 */

import type { DomainEventMap, DomainEventName } from './domain-events.registry';
import type { Logger } from '@/types/logger';

type Handler<T> = (payload: T) => Promise<void>;

export class DomainEventBus {
  private handlers = new Map<string, Array<Handler<any>>>();
  private logger?: Logger;

  /**
   * Optionally attach a logger for observability.
   */
  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  /**
   * Register a handler for a domain event type.
   * Multiple handlers per event are supported — all are called on emit.
   */
  on<T extends DomainEventName>(
    event: T,
    handler: Handler<DomainEventMap[T]>,
  ): void {
    const existing = this.handlers.get(event) ?? [];
    existing.push(handler);
    this.handlers.set(event, existing);
  }

  /**
   * Remove a previously registered handler.
   */
  off<T extends DomainEventName>(
    event: T,
    handler: Handler<DomainEventMap[T]>,
  ): void {
    const existing = this.handlers.get(event);
    if (!existing) return;
    const idx = existing.indexOf(handler);
    if (idx !== -1) existing.splice(idx, 1);
  }

  /**
   * Emit a domain event. All registered handlers are called concurrently.
   * Errors in individual handlers are caught and logged — they do not
   * propagate to the caller or block other handlers.
   */
  async emit<T extends DomainEventName>(
    event: T,
    payload: DomainEventMap[T],
  ): Promise<void> {
    this.logger?.debug({ event, payload }, 'Domain event emitted');

    const eventHandlers = this.handlers.get(event);
    if (!eventHandlers || eventHandlers.length === 0) {
      this.logger?.debug({ event }, 'No handlers registered for event');
      return;
    }

    const results = await Promise.allSettled(
      eventHandlers.map((handler) => handler(payload)),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger?.error(
          { event, error: result.reason },
          'Domain event handler failed',
        );
      }
    }
  }

  /**
   * Remove all handlers (useful for testing).
   */
  reset(): void {
    this.handlers.clear();
  }
}

/** Singleton instance used across the application. */
export const domainEvents = new DomainEventBus();
