# MODULE_SPEC: reviews

> Generated as part of Step-2 (MODULE_SPEC backfill). See `~/.claude/plans/ill-ask-this-again-validated-graham.md`.

## 1. Purpose

Captures Net Promoter Score (NPS) feedback from one person about a flexible "context" (booking, session, order, marketplace transaction, platform, etc.). The module is intentionally vertical-neutral — the application picks the `reviewType` string and the `context` UUID, the module stores the score, comment, optional reviewed-entity reference, and enforces an "one review per (context, reviewer, reviewType)" uniqueness rule. Reviews are immutable after creation (delete-only) to preserve the integrity of historical NPS trends.

## 2. Bounded Context

**Owns:** review submission, retrieval, deletion, listing with role-based filtering, NPS-domain invariants (0–10 score, ≤1000-char comment, ≤50-char reviewType).

**Out of scope:** review aggregation / trend computation (that lives in consumers — `surveys` owns NPS trend analytics; `reviews` only stores rows), notification of the reviewed party (handled by `notifs`), template-driven survey-style review flows (use `surveys`).

**Adjacent modules:**
- `person` — `reviewer_id` and `reviewedEntity` FK into `persons`, `ON DELETE RESTRICT` (a person with reviews cannot be deleted without first cascading those rows; the `person.deleted` cascade in `core/domain-event-consumers.ts` does not currently scrub reviews — flagged as future work).
- `surveys` — distinct module; `surveys` owns templated multi-question surveys with sessions, `reviews` owns single-NPS-row records.
- `notifs` — out-of-band; reviews never call notifs directly. Trigger downstream notification by emitting a domain event in the calling module (e.g. `booking.completed`) and let the consumer enqueue a notification.

## 3. Handler Inventory

| Handler file | Verb | Auth required | Audit action | Notes |
|---|---|---|---|---|
| `createReview.ts` | POST `/reviews/` | `user` | `review.create` | Enforces `(context, reviewer, reviewType)` uniqueness; rejects duplicates with ConflictError. |
| `listReviews.ts` | GET `/reviews/` | `user` | (read) | Org-scoped (AHA FIX-011): the caller's `organizationId` from ctx is applied to the filter — officers/members see only their org's reviews; a platform admin without org context lists cross-org. Role-based filtering (via `hasRole`) layers on top: callers see reviews they authored + reviews about them; admins bypass the author/entity filter. |
| `getReview.ts` | GET `/reviews/:review` | `user` | (read) | Visibility uses the same role filter as listReviews — non-author, non-reviewedEntity, non-admin → NotFoundError (not 403, to avoid leaking existence). |
| `deleteReview.ts` | DELETE `/reviews/:review` | `review:owner` or `admin` | `review.delete` | Ownership-based — middleware passes through, handler validates `reviewer === session.user.id` OR `hasRole(session.user, 'admin')`. |

Test coverage: 4 unit specs + `reviews-handlers.test.ts` aggregator. All four handlers covered.

## 4. TypeSpec source

`specs/api/src/modules/reviews.tsp` — single file, operations `createReview`, `listReviews`, `getReview`, `deleteReview`. Uses `@operationId` + `@doc`. AHA FIX-012 added `@extension("x-audit", #{ action: "delete", resourceType: "review" })` to `deleteReview` (the per-route audit middleware composes the event after the handler returns; `createReview` still logs inline). `x-require-officer`/`x-require-position` are not used (reviews use role-based `bearerAuth` + `review:owner`/`admin`).

## 5. Database schema

- `services/api-ts/src/handlers/reviews/repos/review.schema.ts` — single `review` table.

Notable constraints:
- `npsScore` CHECK 0–10.
- `comment` CHECK ≤1000 chars.
- `reviewType` CHECK ≤50 chars.
- `(context_id, reviewer_id, review_type)` UNIQUE — duplicate review submission becomes a ConflictError, not a silently-overwritten row.
- `reviewer_id` + `reviewed_entity_id` FK → `persons.id` ON DELETE RESTRICT (intentional — preserves NPS history through person deletion lifecycle).

## 6. Cross-module dependencies

- **Emits domain events:** none today. Adding `review.created` is a reasonable extension when downstream "notify the reviewed entity" use cases appear.
- **Consumes events from:** none.
- **Calls handlers from:** none. Module is leaf-only.

## 7. Test coverage status

- Unit tests: 4/4 handlers (100% file coverage); plus `reviews-handlers.test.ts` integration-style suite.
- Contract scenarios: `specs/api/tests/contract/reviews.hurl` (1 file, 2 requests in the Step-1 baseline run).
- E2E: 0 specs. No `/reviews` page in `apps/memberry` today.

## 8. Hand-wired routes

None. All four routes go through the generated registry; nothing in `docs/quality/HAND_WIRED_ROUTES.yaml` references reviews.

## 9. Known gotchas

- **Immutability is enforced by absence, not by code** — there is no `updateReview` handler. If a caller wants "edit my NPS", they must DELETE + create a new row. Be deliberate about adding update semantics — it changes the NPS trend story.
- **Person deletion does not scrub reviews** — `core/domain-event-consumers.ts` cascades 19 entities on `person.deleted`, but `reviews.reviewer_id` / `reviewed_entity_id` are `ON DELETE RESTRICT`, so a person delete that has reviews will throw. The current behaviour is "block the delete"; this is intentional for the M2-R5 grace-period flow but warrants explicit handling once the rebuild plan touches person.
- **`getReview` returns 404 (not 403) for unauthorised reads** — by design, to avoid leaking row existence. Consumers must not infer "row exists" from a 403.

## 10. AI extension checklist

To add a new endpoint to this module:

1. `specs/api/src/modules/reviews.tsp` — add the operation. If the operation mutates a row, add `@extension("x-audit", #{ action: "...", resourceType: "review" })`. For org-scoped reads, no extension needed — `authMiddleware({ roles: ["user"] })` is the default chain.
2. `services/api-ts/src/handlers/reviews/<verbResource>.ts` — implement. Reuse `ReviewRepository` (`repos/review.repo.ts`); never write raw SQL.
3. `services/api-ts/src/handlers/reviews/<verbResource>.test.ts` — Bun unit test; cover at minimum: happy path, role-based access (owner / reviewedEntity / admin / other), invariant violation (NPS bounds, comment length, duplicate `(context, reviewer, type)`).
4. `specs/api/tests/contract/reviews.hurl` — extend the existing scenario; if the operation crosses a new auth boundary (officer/platformAdmin), add a separate `reviews-<scope>.hurl`.
5. Regenerate: `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`.
6. Frontend hook auto-generated; no manual SDK edits.

Forbidden:
- Editing `services/api-ts/src/generated/**`.
- Adding to `app.ts` for a route that fits the generated registry (no allow-list reason applies to reviews).
- Verb prefixes `new*` / `make*` / `do*` / `process*`.
- Adding an `updateReview` handler without a deliberate decision — see §9.

When in doubt, mirror `createReview.ts` for mutations and `listReviews.ts` for role-filtered reads.
