# Phase 14: P0/P1 Remediation + Codex Fixes - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning
**Mode:** Auto-generated from Codex review + audit findings

<domain>
## Phase Boundary

Fix 4 Codex-verified bugs (2 P1, 2 P2) in org-context middleware and event form. Close remaining P0/P1 remediation items from codebase audit.

</domain>

<decisions>
## Implementation Decisions

### Codex P1-1: org-context UUID-path fallback
**File:** `services/api-ts/src/middleware/org-context.ts:53-55`
**Bug:** Regex `uuidInPath` grabs first UUID in path — on nested routes like `/association/events/:eventId/cancel`, the `eventId` gets treated as `orgId`.
**Fix:** Remove the regex UUID fallback entirely. Only accept orgId from `x-org-id` header, `orgId`/`organizationId` query params, or `organizationId` path param.

### Codex P1-2: body-supplied orgId ignored
**File:** `services/api-ts/src/middleware/org-context.ts:56-61`
**Bug:** Middleware doesn't extract organizationId from request body, so mutations that only supply it in JSON body get 403.
**Fix:** Add body extraction as final fallback (parse body only for POST/PUT/PATCH methods to avoid overhead on GETs).

### Codex P2-1: public directory allowlist mismatch
**File:** `services/api-ts/src/app.ts:116`
**Bug:** Allowlist has `/association/member/directory/public` but generated route is `/association/member/directory/search/:personId/public`.
**Fix:** Add the correct path pattern to ASSOCIATION_PUBLIC_PATHS array.

### Codex P2-2: BigInt serialization in event form
**File:** `apps/memberry/src/features/events/components/event-form.tsx:85`
**Bug:** `BigInt()` used for `registrationFee` but API validates as number. BigInt serializes to string in JSON.
**Fix:** Replace `BigInt(Math.round(...))` with `Math.round(...)`.

### P0/P1-remaining: invitation_token orgId
**File:** `services/api-ts/src/handlers/invite/repos/invite.schema.ts`
**Fix:** Add `organizationId` column with FK reference to organizations table.

</decisions>

<code_context>
## Existing Code Insights

- org-context middleware at `services/api-ts/src/middleware/org-context.ts` (129 lines)
- Auth bypass list at `services/api-ts/src/app.ts` lines 112-116
- Event form at `apps/memberry/src/features/events/components/event-form.tsx`
- Invitation schema at `services/api-ts/src/handlers/invite/repos/invite.schema.ts`
- Existing tests: `services/api-ts/src/middleware/org-context.test.ts`

</code_context>

<specifics>
## Specific Ideas

All fixes have specific file:line targets from Codex review. No ambiguity.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
