# ADR-0006: Domain event bus for cross-module cascades

- Status: Accepted
- Date: 2026-06-06
- Deciders: Memberry team

## Context

Cross-module side effects are unavoidable in a vertically modular system. When a person is deleted, at least 19 cleanup steps across 9 modules must execute (memberships, status history, credits, governance records, directory entries, dunning flags, credentials, chapters, dues payments, events, training enrollments, election records, certificates, communication subscriptions, documents, invitations, billing). When dues are paid, training credit may be awarded.

Two implementation approaches were considered:

**Inline orchestrator**: The triggering handler imports and directly calls cleanup functions in all affected modules. This is simple but violates the cross-module import rule (`dues` must not import `training`; `person` deletion must not import every affected module directly). It also couples all modules to each other at compile time and makes future module additions require modifying the orchestrator.

**In-process domain event bus**: The triggering handler emits a domain event (e.g., `person.deleted`, `dues.paid`). Each module registers its own subscriber on startup. Modules are decoupled at the import level — the event bus is the only shared dependency.

The in-process bus was chosen over an external message broker (Kafka, RabbitMQ, etc.) because: (a) the platform is a single-process Hono server, (b) subscribers are fire-and-forget with their own try/catch, and (c) the operational overhead of an external broker is not justified at the current scale.

Source: `CLAUDE.md` §"Domain-event cascades (P1.6)", `CONTRIBUTING.md` §"Cross-Module Side Effects", commit `17c75eaf`.

## Decision

Cross-module side effects are routed through the in-process domain event bus (`core/domain-events.ts`). Handlers emit named events; module subscribers register during app initialization in `core/domain-event-consumers.ts`. No handler may directly call another module's repository to perform a side effect. Subscribers are fire-and-forget — each owns its own try/catch and structured log.

## Consequences

### Positive
- Modules are decoupled at compile time — adding a new module's cleanup requires one new `domainEvents.on(...)` block with no changes to the emitter.
- The emitter handler stays small and focused (e.g., `accountDeletionCascade.ts` is 46 LOC after refactor).
- Subscriber failures are isolated — one module's cleanup error does not abort the cascade.

### Negative / tradeoffs
- Fire-and-forget means partial failures are possible: if a subscriber throws, its cleanup is skipped and only a structured log entry records the failure. There is no automatic retry or dead-letter queue.
- Debugging a failed cascade requires searching structured logs across multiple subscribers, not a single stack trace.
- The in-process bus does not survive a process crash mid-cascade. For the current scale this is acceptable; at higher scale an external durable bus would be needed.

### Neutral
- All subscribers are registered synchronously at startup via `registerDomainEventConsumers()` in `core/domain-event-consumers.ts`.
- The pattern is distinct from the WebSocket event system (`core/events.ts`) used for real-time push to connected clients.

## Alternatives considered

- **Inline orchestrator in the triggering handler** — rejected because it violates the cross-module import rule and couples all modules at compile time.
- **External message broker (Kafka, RabbitMQ)** — rejected as operational overkill for a single-process service at current scale.
- **Database triggers** — rejected because they are invisible to the application layer, hard to test, and bypass the structured-log audit trail.

## References

- `CLAUDE.md` §"Domain-event cascades (P1.6)"
- `CONTRIBUTING.md` §"Cross-Module Import Rules > Cross-Module Side Effects"
- `services/api-ts/src/core/domain-events.ts`
- `services/api-ts/src/core/domain-event-consumers.ts`
- `services/api-ts/src/handlers/person/accountDeletionCascade.ts`
- Commit `17c75eaf` — "test(events): per-subscriber person.deleted coverage"
