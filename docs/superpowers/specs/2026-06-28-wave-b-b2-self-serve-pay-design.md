# Wave B / B2 — Member self-serve dues pay (ADDITIVE engine)

**Date:** 2026-06-28 · **Apps:** services/api-ts (engine, approved additive) + apps/member · **Version:** v0.1.13.0
**Engine status:** NOT frozen for THIS slice — user-approved ADDITIVE only. Allowed changes:
one new migration (make `payment_token.created_by_officer` nullable), one new TypeSpec op + request
model, the generated routes/validators/openapi for it, the regenerated SDK, and one new member-auth
handler + route registration. **No existing handler/schema/contract may break.** Settlement, checkout,
validate, and the officer mint stay byte-unchanged.

## Goal

Turn the member dues tile from informational into actionable: a logged-in member taps **"Pay now"**
and is taken to the existing login-free `/pay/:token` checkout for their own outstanding dues. Reuses
the slice-1 PayMongo `payment_token` rail end-to-end. Buildable + testable now; **live checkout is
G2-gated** (PayMongo platform account) — the mint endpoint itself needs no PayMongo and is fully testable.

## What exists (recon, verified vs handler source)

- **Officer mint to mirror:** `POST /org/{organizationId}/payments/send-link` → `sendPaymentLink`
  (`handlers/member/duesspecialassessments/sendPaymentLink.ts`): generates an HMAC token
  (`generatePaymentToken(secret) → {raw, hash}`), creates a `payment_token` row via
  `PaymentTokenRepository.create({ tokenHash, personId, organizationId, invoiceId, amount, currency,
  expiresAt, createdByOfficer })`, returns `{ token: raw, paymentUrl: '/pay/${raw}', expiresAt }`.
  TypeSpec: `specs/api/src/modules/dues-custom.tsp` (`PaymentLinkManagement` interface, `SendPaymentLinkResponse`).
- **`payment_token` schema** (`handlers/dues/repos/payment-token.schema.ts`): `created_by_officer uuid NOT NULL`
  (→ persons.id). **This NOT NULL blocks a member-initiated row** → the migration makes it nullable.
- **Rail is reused unchanged:** the member redirects to the existing public `/pay/:token` page
  (apps/member slice-2a) → `validatePaymentToken` (GET) → `checkoutPaymentToken` (POST, creates the
  PayMongo session) → webhook → `settleOnlinePayment`. **Settlement is tokenId-agnostic** (does NOT read
  `created_by_officer`), so a member-minted token settles identically. No changes to checkout/validate/webhook.
- **Member auth:** sibling member dues endpoints (e.g. `downloadReceipt`) use `@useAuth(bearerAuth)` +
  `@extension("x-security-required-roles", #["association:member"])`. The new op uses the same. **CONFIRM**
  the OTP-logged-in member carries `association:member` by matching the role on `listDuesInvoices` (the
  member dashboard already calls it successfully) — use whatever that uses.
- **Migration journal:** latest `idx: 85, when: 1782700000000` (`services/api-ts/src/generated/migrations/meta/_journal.json`).
  New migration → `idx: 86, when: 1782700000001` (monotonic +1 — ci-gotchas #1).
- **Test DDL to update:** `handlers/dues/repos/dues-repos.integration.test.ts` hand-rolls the
  `payment_token` table with `created_by_officer uuid NOT NULL` → must become nullable (ci-gotchas #2).

## Design

### New engine endpoint (additive)
`POST /org/{organizationId}/payments/mint-mine` → `mintMyPaymentLink`. Auth: `bearerAuth` +
`x-security-required-roles ["association:member"]` (NO `x-require-officer`). Request:

```tsp
model MintMyPaymentLinkRequest { @doc("Member's own unpaid invoice to pay") invoiceId: string; }
```

Response: **reuse `SendPaymentLinkResponse`** `{ token, paymentUrl, expiresAt }` (201).

Handler (`handlers/member/duesspecialassessments/mintMyPaymentLink.ts`, mirrors sendPaymentLink minus the
officer requirement, plus self-ownership checks):
1. `personId = ctx.get('user').id`; `orgId` from path.
2. **Membership check:** the member belongs to `orgId` (else 403). (Reuse the membership-check util the other
   member endpoints use.)
3. **Load the invoice** (`invoiceId`) via the dues invoice repo. **Reject (400/403/404)** unless:
   - it exists, AND
   - `invoice.personId === personId` (**ownership — no paying others' invoices**), AND
   - `invoice.organizationId === orgId`, AND
   - it is **unpaid** (status in generated/sent/overdue — not paid/void).
4. **`amount = invoice.amount` (server-derived — NEVER from the client).** `currency = invoice.currency ?? 'PHP'`.
5. Generate token (`generatePaymentToken`), create the `payment_token` row with `personId`, `organizationId`,
   `invoiceId`, `amount`, `currency`, `expiresAt` (same TTL as officer mint), **`createdByOfficer: null`**.
6. Return `{ token: raw, paymentUrl: '/pay/${raw}', expiresAt }` (201).

### Migration (additive, reversible-safe)
`ALTER TABLE payment_token ALTER COLUMN created_by_officer DROP NOT NULL;` (idx 86, when 1782700000001).
Existing officer rows keep their value; member rows are null. **Confirm nothing reads `created_by_officer`
with a non-null assumption** (revoke is org-scoped, settlement is tokenId-agnostic — verify in review).

### SDK + FE
- Regen SDK → typed `mintMyPaymentLink` fn.
- **DuesOwedTile**: replace the "use the link your chapter sent you" footer with a **"Pay now"** button when
  there is an outstanding invoice. On click: `mintMyPaymentLink({ path: { organizationId: orgId },
  body: { invoiceId: firstOutstanding.id } })` → on success `window.location.href = paymentUrl` (the
  existing `/pay/:token` page). No outstanding invoice → keep informational text. Error → friendly `role=alert`.

## Money / security invariants (opus review MUST verify)

1. **Amount is server-derived from the invoice**, never trusted from the client body.
2. **Invoice ownership** enforced (`invoice.personId === session.user.id`) — no cross-member pay / IDOR.
3. **Invoice org match** + **unpaid** enforced (no minting against a paid invoice → no double-charge surface;
   settlement is already idempotent, but mint should still reject paid).
4. **Membership** enforced (can't mint for an org you're not in).
5. **`createdByOfficer: null`** for member-initiated provenance (not a fake officer id).
6. Token single-use + TTL + the existing claim-mutex/CAS on checkout are inherited from the rail (unchanged).
7. BigInt/Number discipline at the FE seam (invoice `totalAmount` is bigint → the mint sends only `invoiceId`,
   so no money crosses the wire from the client — amount is derived server-side; FE redirects, no money math).

## Testing (anti-false-green + real-PG where money/member data moves)

- **Migration repo test (real-PG, createScratch):** insert a `payment_token` with `createdByOfficer: null`
  succeeds (proves nullable); officer rows still insert with a value.
- **Handler real-PG integration test (createScratch):** mint with an owned unpaid invoice → a `payment_token`
  row with `personId=member`, `createdByOfficer=null`, `amount=invoice.amount`, returns `{token,paymentUrl,expiresAt}`.
  Reject: invoice owned by another person (403/404), invoice in another org, paid invoice, non-member of org,
  missing invoice. **Amount comes from the invoice even if the request had no amount field** (there is no amount
  field — assert the row amount equals the invoice's).
- **Update `dues-repos.integration.test.ts` DDL** to nullable `created_by_officer` (else its drizzle inserts break).
- **Contract (Hurl):** member mints (201 token/paymentUrl), non-member 403, someone-else's-invoice 403/404.
- **FE DuesOwedTile.test.tsx:** "Pay now" shows with an outstanding invoice (mock `mintMyPaymentLink` via
  `ok()`), calls the fn with the invoice id, redirects on success (mock `window.location`); no button when no
  outstanding; 403 → friendly alert. Typecheck includes tests.
- **Engine generated artifacts:** after `cd specs/api && bun run build`, `cd services/api-ts && bun run generate`,
  `bun run --filter @monobase/sdk-ts generate` — commit the regenerated openapi/routes/validators/sdk (CI's
  git-diff gate fails otherwise — feedback `api-first-sdk-regen`).

## Build order (spec-first, CLAUDE.md)

1. Migration: edit `payment-token.schema.ts` (nullable) → `bun run db:generate` → review SQL → fix journal `when` to 1782700000001 → update test DDL.
2. TypeSpec: add the op + model to `dues-custom.tsp` → `cd specs/api && bun run build` → `cd services/api-ts && bun run generate`.
3. Handler + route registration (no `/api` prefix) → restart API for the new route.
4. `bun run --filter @monobase/sdk-ts generate` (regen SDK).
5. FE button.

## CI gotchas to respect (carry-forward)

- Migration journal `when` strictly monotonic (else skipped on incremental prod deploy) — ci-gotchas #1.
- Update the hand-rolled `dues-repos.integration.test.ts` DDL — ci-gotchas #2.
- Regen the SDK or the lint-typecheck git-diff gate fails — feedback `api-first-sdk-regen`.
- Generated SDK types may drift; anchor FE mocks to the real handler response (`SendPaymentLinkResponse` =
  `{token,paymentUrl,expiresAt}` — confirmed matches handler, typed-bind safe).
- Migration-safety lint: any `DELETE` needs `WHERE` on one line; schema PR references the migration-safety
  checklist (this migration is a non-destructive `DROP NOT NULL` — no DELETE).

## Out of scope (flagged)

- LIVE checkout (G2 / PayMongo platform account) — the mint + token + `/pay` page work in test mode; real
  card/GCash payment needs G2. Carry to Wave C.
- Partial payments, choosing among multiple invoices (v1 pays the first/only outstanding invoice), saved cards.
- Officer revoke of member-minted links (org-scoped revoke already works; not wired to the member UI).

## Engine ADDITIVE invariant (replaces FROZEN for this slice)

`git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated` is NON-empty but contains ONLY:
the new migration + journal entry, `payment-token.schema.ts` nullable change, the new `dues-custom.tsp` op +
model, the regenerated openapi/routes/validators, the new handler + its route registration, the test-DDL
update, and the regenerated SDK. **No diff to any existing handler's logic or any other schema.**
