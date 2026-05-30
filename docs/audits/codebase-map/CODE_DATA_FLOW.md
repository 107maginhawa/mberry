---
oli-version: "1.0"
last-modified: 2026-05-30T12:00:00.000Z
last-modified-by: oli-codebase-map
---

# Code Data Flow

Flows: 411 (unchanged)

Components with API calls: 38

## Cycle-4 delta

Three frontend data flows shifted endpoint identity (no flow count change):

| Component | Old call | New call |
|---|---|---|
| `apps/admin/src/routes/organizations/$organizationId.tsx` | `GET /admin/organizations/{id}/status` | `POST /admin/organizations/{id}/transition` |
| `apps/memberry/src/features/communications/components/notification-preferences.tsx` | `POST /communications/subscriptions/bulk` | `POST /association/person-subscriptions/bulk-update` |
| `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/finances/members/$memberId.tsx` | (new) | `GET /association/member/dues-member-summary/{organizationId}/{personId}` |

Backend-internal flow changes (not visible to FE flows):
- Membership/booking/dues/training/marketplace/email mutators now route status changes through `assertValidTransition(MAP, from, to, name)` — produces 409 ConflictError on illegal transitions (see CODE_STATE_MACHINES.md for 12 wired guard sites).
- `core/ports/` introduces lazy-resolved adapter functions (`getGovernancePort`, `getPlatformAdminPort`, `getImpersonationPort`, `getMembershipPort`) that middleware now consumes instead of direct handler-repo imports. Static dependency graph: `core` → `ports` → (dynamic) → `handlers/*/repos/*.repo`. Bundler still resolves these to constant string literals.
- `core/schema-registry.ts` provides 9 audited cross-module schema re-exports for `core/domain-event-consumers.ts` only.
- New CSRF middleware enforces double-submit cookie on all state-changing methods (POST/PUT/PATCH/DELETE) with allowlist for `/webhooks/`, `/email/unsubscribe`, `/pay/`, `/auth/`.
- OpenTelemetry tracing middleware produces a server span per request when `OTEL_EXPORTER_OTLP_ENDPOINT` is set.
