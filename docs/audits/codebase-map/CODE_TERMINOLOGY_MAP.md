---
oli-version: "1.0"
last-modified: 2026-05-30T12:00:00.000Z
last-modified-by: oli-codebase-map
---

# Code Terminology Map

Strings captured: 1500 (capped 1500)
Clusters: 10
Glossary available: true

- **member** — 20 variants, 91 strings, modules: app-admin, app-memberry
- **membership** — 20 variants, 23 strings, modules: app-memberry
- **dues** — 20 variants, 28 strings, modules: app-memberry
- **invoice** — 12 variants, 23 strings, modules: app-memberry
- **event** — 20 variants, 37 strings, modules: app-admin, app-memberry
- **training** — 18 variants, 21 strings, modules: app-admin, app-memberry
- **credit** — 17 variants, 27 strings, modules: app-admin, app-memberry
- **document** — 15 variants, 20 strings, modules: app-memberry
- **election** — 15 variants, 24 strings, modules: app-memberry
- **committee** — 4 variants, 5 strings, modules: app-admin, app-memberry

## Cycle-4 delta

No net new clusters; cycle 4 changed handler/repository internals (transition guards, ports, schema-registry, observability, CSRF middleware) but did not introduce new domain vocabulary surfaced in user-facing strings. Frontend churn limited to:
- `apps/admin/src/routes/organizations/$organizationId.tsx` (admin-org-status route rename, no new tokens)
- `apps/memberry/src/features/communications/components/notification-preferences.tsx` (re-routed bulk endpoint, no new tokens)
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/finances/members/$memberId.tsx` (consumes new dues-member-summary endpoint, no new tokens)
