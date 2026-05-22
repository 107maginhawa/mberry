# Known Technical Debt — Team Onboarding Reference

Identified during team-readiness audit (2026-05-22). Items below are documented,
not blocking. Create GitHub issues when repo access is available.

---

## Database

### Migrate all timestamp columns to timestamptz
All timestamp columns use `TIMESTAMP WITHOUT TIME ZONE`. Violates documented convention.
80+ columns across dozens of tables. Migration generator has known issues — needs dedicated phase.
**Files:** `services/api-ts/src/core/database.schema.ts`, all `handlers/*/repos/*.schema.ts`

### Dual dues schemas with inconsistent ID types
`association:member/repos/dues.schema.ts` uses `varchar` for org_id.
`dues/repos/dues-payments.schema.ts` uses `uuid`. Same domain, two modules.
**Priority:** Low — both work independently. Consolidate when splitting mega-module.

### No organizationId foreign keys
`organizationId` defined as `uuid().notNull()` everywhere but never `.references()`.
No referential integrity at database level.
**Priority:** Medium — dedicated migration PR with testing needed.

## Security

### In-memory rate limiting
Rate limiter and account lockout use `Map()` — resets on restart, no cross-instance sharing.
Fine for single-instance MVP. Move to Redis/PostgreSQL for production scaling.
**File:** `services/api-ts/src/middleware/rate-limit.ts`, `services/api-ts/src/core/account-lockout.ts`

## Testing

### Integration tests silently skip when server down
`API_AVAILABLE` check makes integration tests `describe.skip`. `bun test` passes with false confidence.
**Fix:** Separate unit and integration test commands, or add warning banner.

## Code Quality

### Inconsistent backend error handling
Some handlers use typed `AppError` hierarchy, others use inline `ctx.json({error}, status)`.
Two different response shapes for clients to handle.
**Fix:** Grep for `ctx.json.*error` patterns, migrate to typed errors. Add lint rule.

### Frontend error handling — 4 competing patterns
No shared mutation wrapper enforcing consistent onError. Each component implements its own
toast + invalidation logic. Create `useApiMutation` wrapper and migrate incrementally.

## Out of Scope (Unused Template Modules)

These bugs exist in Monobase template modules not used by Memberry:
- Double-booking race condition (booking module)
- Stripe webhook findAll() full-table scan (billing module)
- WebSocket chat no input validation (comms module)
- WebSocket zombie connections (comms module)
- Media stream stale closure (comms hooks)
- Booking invoice orphans (booking module)

Fix these if/when the modules are activated.
