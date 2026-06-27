# B2 Member Self-Serve Pay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A logged-in member taps "Pay now" and is taken to the existing `/pay/:token` checkout for their own dues. Adds one member-auth mint endpoint (reusing the slice-1 payment_token rail), a nullable migration, and a member-app button.

**Architecture:** New `POST /org/{organizationId}/payments/mint-mine` → `mintMyPaymentLink` mirrors the officer `sendPaymentLink` minus the officer gate, plus self-ownership checks; amount is server-derived from the member's own unpaid invoice; `created_by_officer` becomes nullable so member rows can omit it. The member redirects to the unchanged public `/pay/:token` flow.

**Tech Stack:** TypeSpec → OpenAPI → Hono/Drizzle, `@monobase/sdk-ts`, React, vitest + createScratch real-PG + Hurl, bun.

## Global Constraints (CORRECTED per adversarial review — these are source-verified, do not re-litigate)

- **Engine ADDITIVE (not frozen) — but ONLY the agreed files** (spec §invariant). No existing handler/schema/contract logic may change. Settlement / checkout / validate / officer-mint stay byte-unchanged.
- **Amount is ALWAYS server-derived** from the member's invoice — NO amount field in the request body (`{ invoiceId }` only). **The invoice amount column is `totalAmount` (bigint, mode:'number'), NOT `amount`.** `payment_token.amount` is `integer` → assign `Number(invoice.totalAmount)` (centavos; fits int4 for dental dues). Currency = `invoice.currency ?? 'PHP'`.
- **Invoice loader:** `DuesInvoiceRepository.findOneById(invoiceId)` from the **dues** repo (`@/handlers/dues/repos/dues.repo`). **NOT** the billing `InvoiceRepository`/`getInvoice` (different `invoices` table — a footgun).
- **Security invariants (every one MUST hold):** invoice **ownership** (`invoice.personId === session.user.id` — person.id===user.id holds via slice-3; mirrors `listDuesInvoices` FIX-006 self-scope), invoice **org match** (`invoice.organizationId === orgId`), invoice **unpaid** (status ∈ `generated | sent | overdue` only — reject `paid | cancelled | writtenOff`; there is no `void`), `createdByOfficer: null`. Violation = 403/404/409, never a mint. **NO membership/officer-term check** — a *current-membership* gate would wrongly block lapsed members paying overdue dues, and no shared "member-belongs-to-org" util exists; ownership + org match fully cover IDOR.
- **Double-charge guard (C2 — money safety):** two mints for one unpaid invoice → two `payment_token`s → two `paymentId`s → both can settle → a completed orphan dues_payment = a real double charge (settlement is idempotent only per-payment; `markPaid` is guarded but the 2nd payment still completes). The raw token can't be reused (only its hash is stored). So: **the handler MUST reject minting when an active token already exists for the invoice** — before generating, call `PaymentTokenRepository.findActiveForInvoice(invoiceId, personId)` (unused, unrevoked, `expiresAt > now`); if one exists → **409** "A payment is already in progress for this invoice." This guarantees ≤1 active token per invoice → at most one completable checkout → no self-serve double charge. Use a **short TTL (1 hour)** for member-minted tokens (vs officer 72h) so an abandoned token frees the invoice quickly. FE also disables the button after the first tap. (Residual cross-source officer+member case is pre-existing and out-of-scope: locked v1 = overpayment→manual officer refund.)
- **Migration:** `created_by_officer` → nullable; new journal entry `idx 86, when 1782700000001` (strictly monotonic — ci-gotchas #1); update `dues-repos.integration.test.ts` hand-DDL to nullable (ci-gotchas #2). Non-destructive `DROP NOT NULL` (no DELETE → migration-safety lint clean). Verified: no production reader asserts `created_by_officer` non-null.
- **Regen everything** after spec/schema changes (openapi, routes, validators, SDK) and **commit the generated files** (CI git-diff gate — feedback `api-first-sdk-regen`).
- **Auth role:** `bearerAuth` + `["association:member"]` (verified: `listDuesInvoices` allows `association:admin, association:member`; `downloadReceipt` uses `association:member`). The OTP member carries it.
- **`registry.ts` is AUTO-GENERATED (DO NOT EDIT).** `bun run generate` derives the handler import path from the op's namespace tag (`DuesCustomModule` → `Member/DuesSpecialAssessments` → `handlers/member/duesspecialassessments/<operationId>`) and rewrites the registry. So the op MUST be added **inside `namespace DuesCustomModule`** (in the existing `PaymentLinkManagement` interface) and the handler file MUST live at the derived path. Never hand-edit `registry.ts`.
- **No `/api` prefix** in route registration. Restart the API after adding the route.
- **Mirror, don't invent:** read `sendPaymentLink.ts` for `generatePaymentToken` + `PaymentTokenRepository.create` + the expiry/TTL helper. Do NOT fabricate signatures.
- **Version:** v0.1.13.0 at ship.

---

### Task 1: Migration — `created_by_officer` nullable

**Files:**
- Modify: `services/api-ts/src/handlers/dues/repos/payment-token.schema.ts` (drop `.notNull()` on `createdByOfficer`)
- Generate: a new migration under `services/api-ts/src/generated/migrations/` + its `meta/_journal.json` entry
- Modify: `services/api-ts/src/handlers/dues/repos/dues-repos.integration.test.ts` (DDL `created_by_officer uuid` nullable)
- Test: `services/api-ts/src/handlers/dues/repos/payment-token.repo.test.ts` (add a null-officer insert case, createScratch)

- [ ] **Step 1: Make the column nullable.** In `payment-token.schema.ts`, change the `createdByOfficer` column from `uuid('created_by_officer').notNull()...` to the same without `.notNull()` (keep the FK reference). This is the ONLY schema edit.

- [ ] **Step 2: Generate the migration.**

```bash
cd services/api-ts && bun run db:generate
```
This emits a new `00XX_*.sql` with `ALTER TABLE ... ALTER COLUMN "created_by_officer" DROP NOT NULL;` and a `_journal.json` entry. **Review the SQL** — it must be only the DROP NOT NULL (no table drop/recreate). If db:generate is broken locally (exit 127 wasm path — see slice-1), hand-author the SQL file + journal entry.

- [ ] **Step 3: Fix the journal `when` to be monotonic.** Open `services/api-ts/src/generated/migrations/meta/_journal.json`; the new entry must be `"idx": 86, "version": "7", "when": 1782700000001, "tag": "00XX_...", "breakpoints": true` (the existing latest is idx 85 / when 1782700000000). If db:generate wrote a different `when`, set it to `1782700000001`. Rename the SQL file's `00XX` prefix to `0086` if needed so it matches.

- [ ] **Step 4: Update the hand-rolled test DDL.** In `dues-repos.integration.test.ts`, change `created_by_officer uuid NOT NULL,` to `created_by_officer uuid,` (nullable) in the inline `CREATE TABLE ... payment_token (...)`.

- [ ] **Step 5: Add the `findActiveForInvoice` finder** (additive, for the double-charge guard) to `PaymentTokenRepository` (`payment-token.repo.ts`): `findActiveForInvoice(invoiceId: string, personId: string): Promise<PaymentToken | null>` — returns a token where `invoiceId` + `personId` match AND `usedAt IS NULL` AND `revokedAt IS NULL` AND `expiresAt > now()`, else null. Mirror the existing finders' drizzle style in that repo.

- [ ] **Step 6: Add real-PG tests** in `payment-token.repo.test.ts` (createScratch): (a) insert with `createdByOfficer: null` → inserts + reads back `null`; keep an officer-id insert passing. (b) `findActiveForInvoice` returns an active unused token, and returns `null` when the token is used / revoked / expired / for a different person.

```bash
cd services/api-ts && bun test payment-token.repo
cd services/api-ts && bun test dues-repos.integration
```
Expected: PASS (null case + finder cases; DDL now nullable).

- [ ] **Step 7: Commit.** `git add services/api-ts/src/handlers/dues services/api-ts/src/generated/migrations && git commit -m "feat(dues): payment_token.created_by_officer nullable + findActiveForInvoice finder (B2)"`

---

### Task 2: TypeSpec op + generate + SDK + stub handler (compiles)

**Files:**
- Modify: `specs/api/src/modules/dues-custom.tsp` (add `MintMyPaymentLinkRequest` model + `mintMyPaymentLink` op)
- Generated: `specs/api/dist/openapi/*`, `services/api-ts/src/generated/openapi/*` (routes + validators)
- Create: `services/api-ts/src/handlers/member/duesspecialassessments/mintMyPaymentLink.ts` (stub returning 501)
- Modify: the handler registry / route registration so the generated route resolves
- Generated: `packages/sdk-ts/src/generated/*` (regen)

- [ ] **Step 1: Add the TypeSpec op + model** in `dues-custom.tsp`, **inside `namespace DuesCustomModule`** (the tag drives the generated handler path — it MUST be this namespace so the path resolves to `handlers/member/duesspecialassessments/`). Add the model near `SendPaymentLinkResponse` (line ~81), and add the op to the **existing `PaymentLinkManagement` interface** (alongside `sendPaymentLink`/`revokePaymentLink`). Mirror `sendPaymentLink` but member-auth (drop `@extension("x-require-officer", ...)`), reusing `SendPaymentLinkResponse`:

```tsp
@doc("Request body for a member minting a pay-link for their own dues.")
model MintMyPaymentLinkRequest {
  @doc("The member's own unpaid invoice to pay.")
  invoiceId: string;
}
```
…and inside `interface PaymentLinkManagement { ... }`:
```tsp
    @doc("Mint a one-tap payment link for the authenticated member's own dues invoice (self-serve).")
    @operationId("mintMyPaymentLink")
    @post
    @route("/org/{organizationId}/payments/mint-mine")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:member"])
    mintMyPaymentLink(
      @path organizationId: string,
      @body body: MintMyPaymentLinkRequest,
    ): ApiCreatedResponse<SendPaymentLinkResponse>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      // 409 — an active payment link already exists for this invoice (double-charge guard).
      | ApiConflictResponse
      | ApiNotFoundResponse;
```
> `SendPaymentLinkResponse` is top-level in this file (line ~81) and reachable. No `x-require-officer` on this op.

- [ ] **Step 2: Build the spec + generate routes/validators.**

```bash
cd specs/api && bun run build
cd ../../services/api-ts && bun run generate
```
Confirm: `mintMyPaymentLink` now appears in the generated routes + a `MintMyPaymentLinkBody` validator exists. The generated route references `registry.mintMyPaymentLink` — so the handler must exist (next step) for the API to compile.

- [ ] **Step 3: Stub handler so it compiles** — create `handlers/member/duesspecialassessments/mintMyPaymentLink.ts` (the path the generator derives from the `DuesCustomModule` tag — confirm by reading where `sendPaymentLink.ts` sits; it's the same dir):

```ts
import type { Context } from 'hono'
export async function mintMyPaymentLink(ctx: Context): Promise<Response> {
  return ctx.json({ error: 'Not implemented' }, 501)
}
```
**Do NOT hand-edit `registry.ts` — it is AUTO-GENERATED.** `bun run generate` (Step 2) already wrote the registry entry + import for `mintMyPaymentLink` pointing at this file path; creating the file at that exact path is all that's needed for it to resolve. If `generate` reported the handler missing, the file path is wrong — fix the path to match the generator's derived import, do not edit the registry.

- [ ] **Step 4: Regenerate the SDK.**

```bash
bun run --filter @monobase/sdk-ts generate
```
Confirm `mintMyPaymentLink` is now an exported SDK fn with a `MintMyPaymentLinkRequest`/`SendPaymentLinkResponse` type.

- [ ] **Step 5: Typecheck the engine + sdk compile.**

```bash
cd services/api-ts && bun run typecheck
bun run --filter @monobase/sdk-ts typecheck
```
Expected: exit 0 (the stub 501 compiles; route resolves).

- [ ] **Step 6: Commit (contract + stub + regen).**

```bash
git add specs/ services/api-ts/src/generated services/api-ts/src/handlers/member/duesspecialassessments/mintMyPaymentLink.ts packages/sdk-ts/src/generated && git add -A services/api-ts/src && git commit -m "feat(dues): mintMyPaymentLink contract + SDK + stub (B2)"
```

---

### Task 3: Implement `mintMyPaymentLink` handler (TDD, real-PG) — the security meat

**Files:**
- Modify: `services/api-ts/src/handlers/member/duesspecialassessments/mintMyPaymentLink.ts` (real logic)
- Test: `services/api-ts/src/handlers/member/duesspecialassessments/mintMyPaymentLink.integration.test.ts` (createScratch real-PG)

- [ ] **Step 1: Read the references.** Read `sendPaymentLink.ts` fully (mirror its `generatePaymentToken` + secret source + `PaymentTokenRepository.create` call). Read `DuesInvoiceRepository.findOneById` in `@/handlers/dues/repos/dues.repo` and the dues invoice schema (`dues.schema.ts`) to confirm the row fields: `personId`, `organizationId`, **`totalAmount` (bigint mode:'number')**, `currency`, `status` (enum `generated|sent|paid|overdue|cancelled|writtenOff`). Note the real `create` field names.

- [ ] **Step 2: Write the failing real-PG integration test** — `mintMyPaymentLink.integration.test.ts` (createScratch harness; mirror an existing `*.integration.test.ts`). Seeded member + org + dues invoice. Cover:

```
- mint with an OWNED, UNPAID (generated/sent/overdue) invoice → 201; a payment_token row exists with
  personId=member, organizationId=org, invoiceId=invoice.id, amount === Number(invoice.totalAmount),
  createdByOfficer === null; response = { token, paymentUrl: `/pay/${token}`, expiresAt }.
- invoice owned by ANOTHER person → 403 (or 404), NO token row created.
- invoice in ANOTHER org → 403/404, NO token row.
- invoice status 'paid' → 409, NO token row. Also 'cancelled' and 'writtenOff' → 409, NO token row.
- missing/unknown invoiceId → 404.
- DOUBLE-CHARGE GUARD: a second mint for the SAME invoice while the first token is active (unused) → 409,
  and NO second token row is created (assert exactly one active token for the invoice).
- amount comes from invoice.totalAmount (there is no amount in the body).
- NO membership/officer-term check: a member whose membership is lapsed but who owns an OVERDUE invoice
  can still mint (assert 201) — do NOT block lapsed members.
```
Run it — expect FAIL (501 stub).

- [ ] **Step 3: Implement the handler.** Mirror `sendPaymentLink` structure (replace placeholders with the real names from Step 1):

```ts
import type { Context } from 'hono'
import { UnauthorizedError, ForbiddenError, NotFoundError } from '@/core/errors'
// + real imports: DatabaseInstance, PaymentTokenRepository, DuesInvoiceRepository,
//   generatePaymentToken + the secret source (READ sendPaymentLink.ts).

const UNPAID = new Set(['generated', 'sent', 'overdue'])
const MEMBER_TOKEN_TTL_MS = 60 * 60 * 1000 // 1h — short so an abandoned self-serve token frees the invoice

export async function mintMyPaymentLink(ctx: Context): Promise<Response> {
  const user = ctx.get('user')
  if (!user) throw new UnauthorizedError()
  const personId = user.id
  const orgId = ctx.req.param('organizationId') ?? ''
  const { invoiceId } = ctx.req.valid('json') as { invoiceId: string }
  const db = ctx.get('database') as DatabaseInstance
  if (!orgId) return ctx.json({ error: 'organizationId is required' }, 400)

  // 1. load + validate the invoice (server-derived amount; ownership; org; unpaid). NO membership check.
  const invoice = await new DuesInvoiceRepository(db).findOneById(invoiceId)
  if (!invoice) throw new NotFoundError('Invoice not found')
  if (invoice.personId !== personId) throw new ForbiddenError('Not your invoice')          // IDOR guard
  if (invoice.organizationId !== orgId) throw new ForbiddenError('Invoice not in this organization')
  if (!UNPAID.has(invoice.status)) return ctx.json({ error: 'This invoice is not payable.' }, 409)

  const tokenRepo = new PaymentTokenRepository(db)

  // 2. double-charge guard: at most one active token per invoice
  const existing = await tokenRepo.findActiveForInvoice(invoiceId, personId)
  if (existing) return ctx.json({ error: 'A payment is already in progress for this invoice.' }, 409)

  // 3. mint (createdByOfficer: null; amount from invoice.totalAmount; short TTL)
  const { raw, hash } = generatePaymentToken(secret)
  const expiresAt = new Date(Date.now() + MEMBER_TOKEN_TTL_MS)
  await tokenRepo.create({
    tokenHash: hash, personId, organizationId: orgId, invoiceId,
    amount: Number(invoice.totalAmount), currency: invoice.currency ?? 'PHP',
    expiresAt, createdByOfficer: null,
  })

  return ctx.json({ token: raw, paymentUrl: `/pay/${raw}`, expiresAt }, 201)
}
```
Use the real `generatePaymentToken`/secret exactly as `sendPaymentLink.ts` does. Keep every check.

- [ ] **Step 4: Run the integration test — expect PASS.**

```bash
cd services/api-ts && bun test mintMyPaymentLink.integration
```
All cases green.

- [ ] **Step 5: Full engine typecheck + the touched suites.**

```bash
cd services/api-ts && bun run typecheck && bun test payment-token mintMyPaymentLink dues-repos.integration
```
Expected: green.

- [ ] **Step 6: Commit.** `git add services/api-ts/src/handlers/member/duesspecialassessments && git commit -m "feat(dues): implement member self-serve mintMyPaymentLink (B2)"`

---

### Task 4: FE "Pay now" button in DuesOwedTile

**Files:**
- Create: `apps/member/src/features/dashboard/use-pay-now.ts` (useMutation → mintMyPaymentLink)
- Modify: `apps/member/src/features/dashboard/DuesOwedTile.tsx` (Pay-now button when an outstanding invoice exists)
- Test: `apps/member/src/features/dashboard/use-pay-now.test.ts`, extend `DuesOwedTile.test.tsx`

**Interfaces:**
- Consumes: `mintMyPaymentLink` from `@monobase/sdk-ts/generated`; `useMemberOrg`; `useMemberData` (`outstandingInvoices`); `toast` from sonner.

- [ ] **Step 1: Write failing hook test** — `use-pay-now.test.ts`: mock `mintMyPaymentLink`; assert it calls with `{ path: { organizationId: 'org-1' }, body: { invoiceId: 'inv-1' } }` and returns `{ token, paymentUrl, expiresAt }`; 403 → throws serverError. Use `@/test-utils/mock-sdk` `ok()`/`err()`.

- [ ] **Step 2: Implement** — `use-pay-now.ts`:

```ts
import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { mintMyPaymentLink, type SendPaymentLinkResponse } from '@monobase/sdk-ts/generated'
import { useMemberOrg } from '@/features/org/use-member-org'

function serverError(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'error' in error) {
    const e = (error as { error?: unknown }).error
    if (typeof e === 'string') return e
  }
  return undefined
}

export function usePayNow(): UseMutationResult<SendPaymentLinkResponse, Error, { invoiceId: string }> {
  const { orgId } = useMemberOrg()
  return useMutation<SendPaymentLinkResponse, Error, { invoiceId: string }>({
    mutationFn: async ({ invoiceId }) => {
      if (!orgId) throw new Error('No organization selected.')
      const { data, error } = await mintMyPaymentLink({ path: { organizationId: orgId }, body: { invoiceId } })
      if (!data) throw new Error(serverError(error) ?? 'Could not start payment. Please try again.')
      return data as SendPaymentLinkResponse
    },
  })
}
```

- [ ] **Step 3: Wire the button** in `DuesOwedTile.tsx`. When `outstandingInvoices.length > 0`, replace the "use the link your chapter sent you" footer with a **"Pay now"** `<Button className="min-h-[48px]">`; on click `pay.mutate({ invoiceId: outstandingInvoices[0].id }, { onSuccess: ({ paymentUrl }) => { window.location.href = paymentUrl }, onError: (e) => setErr(e.message) })`. Show a `role="alert"` on error. Keep the informational text when there are no outstanding invoices.

- [ ] **Step 4: Test the tile** — extend `DuesOwedTile.test.tsx`: with an outstanding invoice + mocked `usePayNow`, the "Pay now" button renders and calls mutate with the invoice id; no button when no outstanding; 403 → alert. (Mock `window.location` via `vi.stubGlobal` or assign a setter.)

- [ ] **Step 5: Run + typecheck.** `cd apps/member && bun run test -- "use-pay-now|DuesOwedTile" && bun run typecheck`.
- [ ] **Step 6: Commit.** `git add apps/member/src/features/dashboard && git commit -m "feat(member): Pay-now button on dues tile (B2)"`

---

### Task 5: Contract test + final verification

**Files:**
- Modify/Create: a Hurl contract file for the member mint (mirror the slice-1 dues pay-link contract; find it under the contract suite dir)

- [ ] **Step 1: Add a Hurl contract case** for `mintMyPaymentLink`: a seeded member mints their own invoice → 201 with `token`/`paymentUrl`; a non-member or someone-else's invoice → 403/404. Mirror the existing payment-link contract file's auth/seed setup.

- [ ] **Step 2: Run the contract suite.** `bun run test:contract` (or the documented command). Expected: the new case passes; no regressions.

- [ ] **Step 3: Full verification.**

```bash
bun run typecheck                                   # all workspaces
cd services/api-ts && bun test                      # engine suite (real-PG) — green
cd apps/member && bun run test && bun run build     # member app + build
```

- [ ] **Step 4: ADDITIVE invariant check.** `git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated --stat` — confirm the changed files are ONLY: the migration + journal, `payment-token.schema.ts`, `dues-custom.tsp`, the regenerated openapi/routes/validators, `mintMyPaymentLink.ts` + its registration, the test-DDL update + new tests, and the regenerated SDK. **No diff to any existing handler's logic or other schema.**

- [ ] **Step 5: Commit.** `git add -A && git commit -m "test(dues): member mint contract + final verify (B2)"`

---

## Self-Review

- **Spec coverage:** migration (T1), contract+sdk+stub (T2), handler security logic (T3), FE (T4), contract+verify (T5). ✓
- **Placeholder scan:** the handler (T3) uses explicit `// placeholder — replace with real name` markers tied to a "read sendPaymentLink.ts" step; this is deliberate (do not fabricate repo method names) — every security check + the data flow is fully specified.
- **Type consistency:** `SendPaymentLinkResponse` reused for the response (T2/T4); `MintMyPaymentLinkRequest` `{ invoiceId }` (T2) consumed by the FE (T4); `usePayNow` returns `SendPaymentLinkResponse`.
- **Security re-check:** amount server-derived (T3 step 3), ownership/org/unpaid/membership guards (T3 step 2-3), `createdByOfficer: null` (T1 enables, T3 sets) — all asserted by the T3 real-PG test.
- **Risk notes:** (a) confirm the member auth role vs `listDuesInvoices` (T2 step 1). (b) confirm the invoice-by-id repo method + membership util names (T3 step 1) — read source, don't invent. (c) journal `when` monotonic + test DDL update (T1) — the two ci-gotchas. (d) regen SDK + commit generated files (T2/T4) or CI git-diff fails.
