# B2 Member Self-Serve Pay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A logged-in member taps "Pay now" and is taken to the existing `/pay/:token` checkout for their own dues. Adds one member-auth mint endpoint (reusing the slice-1 payment_token rail), a nullable migration, and a member-app button.

**Architecture:** New `POST /org/{organizationId}/payments/mint-mine` → `mintMyPaymentLink` mirrors the officer `sendPaymentLink` minus the officer gate, plus self-ownership checks; amount is server-derived from the member's own unpaid invoice; `created_by_officer` becomes nullable so member rows can omit it. The member redirects to the unchanged public `/pay/:token` flow.

**Tech Stack:** TypeSpec → OpenAPI → Hono/Drizzle, `@monobase/sdk-ts`, React, vitest + createScratch real-PG + Hurl, bun.

## Global Constraints

- **Engine ADDITIVE (not frozen) — but ONLY the agreed files** (spec §invariant). No existing handler/schema/contract logic may change. Settlement / checkout / validate / officer-mint stay byte-unchanged.
- **Amount is ALWAYS server-derived** from the member's invoice — there is NO amount field in the request. The request body is `{ invoiceId }` only.
- **Security invariants (every one MUST hold):** invoice ownership (`invoice.personId === session.user.id`), invoice org match, invoice unpaid, member belongs to org, `createdByOfficer: null`. A violation = 403/404/400, never a mint.
- **Migration:** `created_by_officer` → nullable; new journal entry `idx 86, when 1782700000001` (strictly monotonic — ci-gotchas #1); update `dues-repos.integration.test.ts` hand-DDL to nullable (ci-gotchas #2). Non-destructive `DROP NOT NULL` (no DELETE → migration-safety lint clean).
- **Regen everything** after spec/schema changes (openapi, routes, validators, SDK) and **commit the generated files** (CI git-diff gate — feedback `api-first-sdk-regen`).
- **Auth role:** member endpoints use `bearerAuth` + `["association:member"]`. **Confirm** the OTP member carries it by matching the role on `listDuesInvoices` (the member dashboard calls it successfully) — use whatever that uses.
- **No `/api` prefix** in route registration. Restart the API after adding the route (no hot-reload for routes).
- **Mirror, don't invent:** read `sendPaymentLink.ts` + the dues invoice repo for exact method names (`generatePaymentToken`, `PaymentTokenRepository.create`, the invoice-by-id lookup, the membership-check util, the expiry default). Do NOT fabricate signatures.
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

- [ ] **Step 5: Add a real-PG proof test** in `payment-token.repo.test.ts` (createScratch harness): create a payment_token with `createdByOfficer: null` (alongside the other required fields) → expect it inserts and reads back with `createdByOfficer === null`. Also keep an existing officer-id insert passing.

```bash
cd services/api-ts && bun test payment-token.repo
```
Expected: PASS (incl. the new null case). Run the dues-repos integration test too:
```bash
cd services/api-ts && bun test dues-repos.integration
```
Expected: PASS (DDL now nullable).

- [ ] **Step 6: Commit.** `git add services/api-ts/src/handlers/dues services/api-ts/src/generated/migrations && git commit -m "feat(dues): payment_token.created_by_officer nullable for member-initiated mint (B2)"`

---

### Task 2: TypeSpec op + generate + SDK + stub handler (compiles)

**Files:**
- Modify: `specs/api/src/modules/dues-custom.tsp` (add `MintMyPaymentLinkRequest` model + `mintMyPaymentLink` op)
- Generated: `specs/api/dist/openapi/*`, `services/api-ts/src/generated/openapi/*` (routes + validators)
- Create: `services/api-ts/src/handlers/member/duesspecialassessments/mintMyPaymentLink.ts` (stub returning 501)
- Modify: the handler registry / route registration so the generated route resolves
- Generated: `packages/sdk-ts/src/generated/*` (regen)

- [ ] **Step 1: Add the TypeSpec op + model** in `dues-custom.tsp`. Add a model near the other payment models and an interface (or extend an existing member interface). Mirror `sendPaymentLink` but member-auth, reusing `SendPaymentLinkResponse`:

```tsp
@doc("Request body for a member minting a pay-link for their own dues.")
model MintMyPaymentLinkRequest {
  @doc("The member's own unpaid invoice to pay.")
  invoiceId: string;
}

@doc("Member self-serve endpoint for paying their own dues")
interface MemberSelfPayEndpoints {
  @doc("Mint a one-tap payment link for the authenticated member's own dues invoice.")
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
    | ApiNotFoundResponse;
}
```
> Confirm `SendPaymentLinkResponse` is in scope in this file (sendPaymentLink uses it) and that the interface is included by the namespace. If member endpoints must live in a specific namespace to get routed, place the interface accordingly (mirror where `downloadReceipt`/`ReceiptEndpoints` sits).

- [ ] **Step 2: Build the spec + generate routes/validators.**

```bash
cd specs/api && bun run build
cd ../../services/api-ts && bun run generate
```
Confirm: `mintMyPaymentLink` now appears in the generated routes + a `MintMyPaymentLinkBody` validator exists. The generated route references `registry.mintMyPaymentLink` — so the handler must exist (next step) for the API to compile.

- [ ] **Step 3: Stub handler so it compiles** — `mintMyPaymentLink.ts`:

```ts
import type { Context } from 'hono'
export async function mintMyPaymentLink(ctx: Context): Promise<Response> {
  return ctx.json({ error: 'Not implemented' }, 501)
}
```
Wire it into the handler registry exactly as `sendPaymentLink` is wired (find where `sendPaymentLink` is registered — mirror it). Ensure the route registration uses the generated validator + the member auth middleware that the generated route expects.

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

- [ ] **Step 1: Read the references.** Read `sendPaymentLink.ts` fully (mirror its token-gen + `PaymentTokenRepository.create` + expiry). Find the dues **invoice repo** method to load an invoice by id (grep the dues repos for a `findById`/`getInvoice`/`findOneById` that returns `{ id, personId, organizationId, amount, currency, status }`) and the **membership-check** util the other member endpoints use (e.g. `utils/membership-check.ts`). Note exact names; the code below uses placeholders you must replace with the real ones.

- [ ] **Step 2: Write the failing real-PG integration test** — `mintMyPaymentLink.integration.test.ts`, using the createScratch harness (mirror an existing `*.integration.test.ts` for setup). Cover, with a seeded member + org + invoice:

```
- mint with an OWNED, UNPAID invoice → 201; a payment_token row exists with personId=member,
  organizationId=org, invoiceId=invoice.id, amount === invoice.amount, createdByOfficer === null;
  response = { token, paymentUrl: `/pay/${token}`, expiresAt }.
- invoice owned by ANOTHER person → 403/404, NO token row created.
- invoice in ANOTHER org → 403/404, NO token row.
- invoice already PAID → 400/409, NO token row.
- caller is NOT a member of the org → 403.
- missing/unknown invoiceId → 404.
- amount is taken from the invoice (assert the row amount equals the invoice amount, regardless of body — there is no amount in the body).
```
Run it — expect FAIL (handler is the 501 stub).

- [ ] **Step 3: Implement the handler.** Mirror `sendPaymentLink` structure:

```ts
import type { Context } from 'hono'
import { UnauthorizedError, ForbiddenError, NotFoundError, ValidationError } from '@/core/errors'
// + the real imports for: DatabaseInstance, PaymentTokenRepository, the invoice repo,
//   generatePaymentToken, the expiry helper, the membership-check util (READ sendPaymentLink.ts).

export async function mintMyPaymentLink(ctx: Context): Promise<Response> {
  const user = ctx.get('user')
  if (!user) throw new UnauthorizedError()
  const personId = user.id
  const orgId = ctx.req.param('organizationId') ?? ''
  const { invoiceId } = ctx.req.valid('json') as { invoiceId: string }
  const db = ctx.get('database') as DatabaseInstance
  if (!orgId) return ctx.json({ error: 'organizationId is required' }, 400)

  // 1. membership: the member must belong to orgId (reuse the same util other member endpoints use)
  //    → ForbiddenError if not a member.

  // 2. load + validate the invoice (server-derived amount; ownership; org; unpaid)
  //    const invoice = await invoiceRepo.<findById>(invoiceId)
  //    if (!invoice) throw new NotFoundError('Invoice not found')
  //    if (invoice.personId !== personId) throw new ForbiddenError('Not your invoice')  // IDOR guard
  //    if (invoice.organizationId !== orgId) throw new ForbiddenError('Invoice not in this organization')
  //    if (isPaid(invoice.status)) return ctx.json({ error: 'This invoice is already paid' }, 409)

  // 3. mint (mirror sendPaymentLink): generate token, create payment_token with createdByOfficer: null
  //    const { raw, hash } = generatePaymentToken(secret)
  //    const expiresAt = <same TTL helper sendPaymentLink uses>
  //    await new PaymentTokenRepository(db).create({
  //      tokenHash: hash, personId, organizationId: orgId, invoiceId,
  //      amount: invoice.amount, currency: invoice.currency ?? 'PHP', expiresAt, createdByOfficer: null,
  //    })

  // 4. return
  //    return ctx.json({ token: raw, paymentUrl: `/pay/${raw}`, expiresAt }, 201)
}
```
Replace every placeholder with the real names read in Step 1. Keep the 5 security checks exactly. `amount` and `currency` come from the invoice, never the request.

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
