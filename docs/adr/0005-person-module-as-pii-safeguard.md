# ADR-0005: Person module as PII safeguard

- Status: Accepted
- Date: 2026-06-06
- Deciders: Memberry team

## Context

The platform stores personally identifiable information (PII) for members of healthcare professional associations. This includes names, contact details, professional credentials, and eventually consent records. PII handling must be consistent across all modules: no duplication, no orphaned records, and a clear deletion path.

In early iterations of the schema, user data was partially duplicated in module-specific tables (e.g., a member table that redundantly stored name and email). This created divergence and complicated deletion cascades when a user account was removed.

The decision was made to centralize all PII in the `person` table and module-specific entities (member, officer, student, etc.) extend person via a foreign key (`person_id`) rather than storing their own PII copies. The Person module (~27 handlers) is the authoritative source for create, update, and delete of identity data.

This pattern also provides a natural cascade point: when a person is deleted, all dependent records across all modules can be cleaned up via the domain event bus (see ADR-0006).

Source: `CLAUDE.md` §"Person-Centric Design", `CONTRIBUTING.md` §"Person-Centric Design", `CONTRIBUTING.md` §"Module Dependency Rules".

## Decision

The Person module is the single PII safeguard. All module-specific entities reference `person_id` — they never duplicate name, email, phone, or other PII fields. No domain module may store its own copy of person-level PII. Deletion of a person record is routed through `accountDeletionCascade.ts`, which emits `person.deleted` to trigger cross-module cleanup.

## Consequences

### Positive
- PII exists in exactly one place — updates propagate immediately to all consumers.
- GDPR/DPA deletion is a single cascade operation, not a distributed manual sweep.
- Role-based access checks have a single person identity to authorize against.
- Consent management (when implemented) attaches to the person record, not scattered across modules.

### Negative / tradeoffs
- Every module that needs person data must join to the `person` table; slightly more verbose queries.
- Core modules (`person`, `association:member`) must not import domain modules — this creates a strict import hierarchy (see CONTRIBUTING.md §"Cross-Module Import Rules").
- Consent management fields are planned but not yet in the schema (noted in CLAUDE.md: "Consent management is planned but not yet implemented").

### Neutral
- The Person module is the only module permitted to have upward visibility into cross-module relationships. All other modules reference person, never the reverse.

## Alternatives considered

- **Per-module user tables** — rejected because it creates PII duplication, inconsistent deletion paths, and divergence risk when a user updates their profile.
- **Shared `users` table managed by Better-Auth** — Better-Auth manages session/auth state; the `person` table extends it with domain PII and association-specific fields. They coexist; neither replaces the other.

## References

- `CLAUDE.md` §"Person-Centric Design" and §"Consent Management"
- `CONTRIBUTING.md` §"Enterprise Development Best Practices > Person-Centric Design"
- `CONTRIBUTING.md` §"Cross-Module Import Rules > Forbidden"
- `services/api-ts/src/handlers/person/accountDeletionCascade.ts`
- `docs/_archive/oli/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md` §7 — current Person table structure
