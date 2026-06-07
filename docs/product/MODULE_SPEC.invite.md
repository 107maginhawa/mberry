# MODULE_SPEC: invite

> Generated as part of Step-2 (MODULE_SPEC backfill).

## 1. Purpose

Issues and resolves HMAC-signed invitation tokens that bring new people into an organization. Two flows share the same token primitive: (a) `invite` — an officer manually invites one prospective member; (b) `claim` — an officer bulk-imports a roster and each imported row gets a token its eventual owner uses to claim the pre-populated account. Either flow goes through the same `validate` → `claim` lifecycle, so frontend onboarding has a single landing page (`/invite/validate/:token`) regardless of origin.

## 2. Bounded Context

**Owns:** the `invitation_token` table, HMAC token issuance + verification, the M1-R2 7-day expiry invariant, single-use enforcement, bulk-import of pre-populated rows.

**Out of scope:** what happens after claim (creating the membership, sending welcome emails) — those land in `association:member` and `email` via the `invite.claimed` domain event. Officer-management invitations (platform-admin admin-of-admin invites) live in `platformadmin/inviteAdmin.ts`, NOT here, despite the similar name.

**Adjacent modules:**
- `association:member` — listens to `invite.claimed` to create the membership row + status-history entry.
- `email` — sends the invitation message via the queue (officer-personalized message rendered into the auth-style template).
- `person` — claim flow creates a person record if the email isn't already tied to one.
- `platformadmin` — owns `inviteAdmin` (platform-admin admin invitation). Don't conflate with this module.

## 3. Handler Inventory

| Handler file | Verb | Auth required | Audit action | Notes |
|---|---|---|---|---|
| `createInvite.ts` | POST `/invite` | `officer` + org context | `invitation.create` | Mints a token, persists hash, kicks the email queue. Officer-only — handler honours the auth chain set in `app.ts` (officer + org-context middleware wraps the prefix). |
| `bulkImportMembers.ts` | (internal, called via createInvite path for bulk variant) | `officer` + org context | `invitation.create` (per-row) | Generates one `type=claim` invitation per imported row. Used by the CSV import flow. |
| `validateInvite.ts` | GET `/invite/validate/:token` | **PUBLIC** (no auth) | (read) | The user clicks the email link before they have an account. Returns invite metadata (org name, pre-populated fields) so the claim page can render. Hand-wired auth opt-out is documented in `app.ts:467`. |
| `claimInvite.ts` | POST `/invite/claim/:token` | `user` (authenticated, any role) | `invitation.complete` | Validates the token + expiry + single-use, emits `invite.claimed` domain event. The follow-on membership creation is a domain-event consumer, not an inline call. |

## 4. TypeSpec source

`specs/api/src/modules/invite.tsp` — three operations (`createInvite`, `validateInvite`, `claimInvite`). `bulkImportMembers` is a separate code path that re-uses `createInvite` internals for many rows — it does not have its own TypeSpec operation today.

## 5. Database schema

- `services/api-ts/src/handlers/invite/repos/invite.schema.ts` — `invitation_token` table + `invite_type` and `invite_status` enums.

Notable shape:
- `tokenHash` is the HMAC of the raw token; the raw token is only ever in the URL and never in the DB.
- `personId` is nullable — for `type=invite` the person doesn't exist yet, for `type=claim` it points at the bulk-imported pre-populated person.
- `organizationId` FK has `ON DELETE cascade` — removing an org wipes pending invites.
- `metadata` jsonb carries the bulk-import row (name, licenseNumber, membershipCategoryId, etc.) that gets pre-filled into the claim form.
- Indexed by tokenHash (unique), email, status, organizationId, personId — covers the lookup patterns of all four handlers.

## 6. Cross-module dependencies

- **Emits domain events:**
  - `invite.claimed` (registry: `core/domain-events.registry.ts:69`) — consumed by association:member to create the membership row, by email to send a welcome message, and by person to upsert the person record.
- **Consumes events from:**
  - `person.deleted` — invitation tokens belonging to the deleted person are scrubbed (`core/domain-event-consumers.ts`, see test at `domain-event-consumers.test.ts:412`).
- **Calls handlers from:** none directly. All side effects flow through the event bus.

## 7. Test coverage status

- Unit tests: 4/4 handlers + an `invite.test.ts` aggregator.
- Contract scenarios: none today as a dedicated `invite.hurl`. The flow is partly covered through `membership-flow.hurl` and `auth-verification.hurl` — adding a dedicated `invite-flow.hurl` is a candidate W4 follow-on.
- E2E: no dedicated spec. Claim is exercised through onboarding e2e specs in `apps/memberry/tests/e2e/auth/*`.

## 8. Hand-wired routes

The middleware chain for `/invite` is wired in `app.ts:465–467` rather than per-route in the registry:

- `app.use('/invite', authMiddleware(), orgContextMiddleware())` — officer creates an invite, both required.
- `app.use('/invite/claim/*', authMiddleware())` — claimer is logged in; org context derived from the token, not the request.
- `/invite/validate/*` — intentionally PUBLIC; no `app.use` is registered for it.

Reason for the hand-wiring: the three sub-paths require *different* auth chains, which the per-operation generator cannot currently express. Allowlist entry: `docs/quality/HAND_WIRED_ROUTES.yaml` — auth-chain divergence.

## 9. Known gotchas

- **`/invite/validate/:token` is the only invite path without auth.** Any change that adds an authMiddleware to `app.use('/invite/*')` will break the new-user-clicks-email flow. Test the public flow whenever touching `app.ts` middleware order.
- **HMAC secret rotation is not currently supported by the verify path** — rotating `AUTH_SECRET` invalidates all outstanding tokens. Operational guidance: rotate during a low-traffic window OR add a multi-secret verify path before rotating.
- **`personId` nullability is significant.** When non-null, the claim flow merges the invite metadata into the existing person row; when null, it creates a new person. The `email` column is what disambiguates returning users — `lower(email)` uniqueness is enforced at the person level, not on `invitation_token`.
- **`type=claim` and `type=invite` share the same URL surface.** The frontend cannot tell from the URL which flow it's in until it calls `validateInvite`. Don't add type-specific routes — the union is intentional, single landing page.

## 10. AI extension checklist

To add a new endpoint to this module:

1. `specs/api/src/modules/invite.tsp` — declare the operation. Add `@extension("x-audit", #{ action: "...", resourceType: "invitation" })` for mutations. For officer-only ops add `@extension("x-require-officer", true)`.
2. `services/api-ts/src/handlers/invite/<verbResource>.ts` — implement. Use `InviteRepository`; never write raw SQL. For events use `domainEvents.emit('invite.<name>', ...)` rather than calling consumer modules.
3. `services/api-ts/src/handlers/invite/<verbResource>.test.ts` — Bun unit test. Always cover expiry + revocation + already-claimed + tampered-token paths.
4. `specs/api/tests/contract/invite-<scope>.hurl` (or extend `membership-flow.hurl`) — covering claim flow if you change the public verification surface.
5. Regenerate: `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`.

If adding a new sub-path under `/invite/`:
- Decide auth posture (public / authenticated / officer + org-context) BEFORE writing the handler.
- Update `app.ts:465–467` wildcard chain to match — and add a HAND_WIRED_ROUTES allowlist entry citing "auth chain divergence" as the reason.

Forbidden:
- Editing `services/api-ts/src/generated/**`.
- Storing the raw token anywhere (DB, logs, audit). The hash is the source of truth; the raw token lives only in the URL.
- Re-using `inviteAdmin` semantics here — that's a separate platform-admin flow with a different DB table.
- Adding global auth middleware over `/invite/*` without auditing the public-validate exception.
