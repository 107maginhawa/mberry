# Slice-3 — apps/member authed dashboard + email-OTP login + account-claim engine link

**Date:** 2026-06-27
**Base:** main `4901b093` v0.1.7.0 (branch `feat/slice3-member-dashboard`)
**Process:** superpowers brainstorming → spec → writing-plans → adversarial plan review → subagent-driven-development.
**Prior slices:** slice-1 (PayMongo dues engine) · slice-2a (login-free `/pay/:token`) · slice-2b (apps/org officer UI) · slice-2c (apps/org roster CSV import) — all merged.

---

## 1. Goal & scope

Give a logged-in **member** a thin, mostly read-only dashboard, reachable via
**passwordless OTP login**. This is the deferrable member half of the funnel
(first-peso comes from the login-free pay-link + officer app, already shipped).

Locked decision (user-approved 2026-06-27): **slice-3 includes a small additive
engine change** — an "account-claim by email" link in the better-auth user
creation hook — because without it the dashboard is **empty for every
roster-imported member** (see §2). The dashboard read endpoints already exist;
the identity link did not.

### In scope
- **Engine (additive):** claim a pre-existing roster `person` for a new
  better-auth `user` whose email matches, at user-creation time, preserving the
  `person.id === user.id` invariant.
- **apps/member (port from apps/org):** anti-false-green test machinery,
  CSRF/credentials SDK client, email-OTP login, session probe + route guard,
  3 read-only dashboard tiles.

### Out of scope (flagged engine follow-ups)
- **Phone-OTP / SMS** — engine has only better-auth `emailOTP`; no `phoneNumber`
  plugin, no SMS integration. Phone-first login needs new engine work + G3 (PH
  SMS sender). We ship **email-OTP** now; phone-OTP is a flagged follow-up.
- **Member self-serve "pay now"** — no member-accessible payment-initiation
  endpoint exists; payment is officer-minted `/pay/:token` only. The dues tile is
  **informational** ("use the link your chapter sent you"). Self-serve pay =
  follow-up.
- **Live OTP click-through** — email-OTP delivery has no dev stub (no inline code
  in response/logs); a live end-to-end OTP test needs email infra (mailpit /
  Postmark). Unit + stubbed-E2E cover the flow now; live verify is G-gated.

### Cuts (YAGNI)
No profile edit, no renewal action, no settings screen, no rich multi-org UI
(auto-select the single membership; minimal selector only if >1).

---

## 2. Why the engine change is required (the blocker)

A roster-imported member who logs in via email-OTP would get an **empty
dashboard**:

- Roster import (`importRosterMembers`) creates a `person` with a DB-generated
  UUID and email in `contactInfo`, and **no** better-auth `user`.
- better-auth's `databaseHooks.user.create.after` (`core/auth.ts:194-213`) links
  person→user **only by `user.id`** (`personRepo.findOneById(user.id)`), never by
  email — and on miss creates a *new* person with `id = user.id`.
- All member reads resolve identity as `personId === session.user.id`
  (`getMyMemberships.ts:21`, `listDuesInvoices.ts:38` FIX-006,
  `listDuesPayments.ts:31` PAY-02).
- → first login makes a fresh, unlinked person; `WHERE personId = session.user.id`
  returns nothing. The roster membership stays under the old UUID. The code
  explicitly acknowledges this: *"account-claiming feature, deliberately out of
  scope for D1"* (`importRosterMembers.ts:26-29`).

This breaks not just roster members but the **post-payment signup upsell** (same
hook → same empty dashboard for someone who just paid). The link is the
precondition for any member-facing data.

---

## 3. Engine design — account-claim by email (additive)

### Mechanism (preferred): id-override in `create.before`

better-auth `1.6.11`. The `create.before` hook already exists and already
returns a modified user (`return { data: { ...user, role: newRole } }`,
`core/auth.ts:185-189`). Extend it:

```
create.before(user):
  ... existing role logic ...
  if (user.email):
    match = personRepo.findByEmailOrLicense(user.email)   // existing repo method
    if (match && match.id !== user.id && not already a user identity):
      logger.info({ personId: match.id }, 'account-claim: linking roster person by email')
      return { data: { ...user, role: newRole, id: match.id } }   // override PK
  return { data: { ...user, role: newRole } }
```

- better-auth then inserts the `user` row with `id = match.id`. The existing
  `create.after` hook's `findOneById(user.id)` now finds the roster person →
  **skips** creating a duplicate. Net: roster person claimed; `person.id ===
  user.id` invariant preserved → **zero handler changes**, no PK re-key, money
  rows untouched.

**Spike gate:** the first engine task PROVES better-auth `1.6.11` honors the
id-override (real-PG test: seed roster person + membership → create a user with
that email through the real auth path → assert `getMyMemberships` returns the
membership and no duplicate person exists). If better-auth ignores the override,
fall back to §3.1.

### 3.1 Fallback (only if spike fails): PK re-key

`create.after`: on email match, re-key the roster person's PK to `user.id` in one
transaction. **No FK uses `ON UPDATE CASCADE`** (verified) and `membership.personId`
has no FK at all, so children must be updated explicitly: `dues_payments.personId`,
`payment_token.personId`, `certificates.personId`, `status_history.personId`,
`dues_payment_status_history.personId`, `booking.*`, `membership.personId`, plus
the new fresh `person` row better-auth's after-hook would create (delete it).
Money-row touching → only if forced; the spike result decides.

### 3.2 Guards & edges

- Only attempt a claim when `user.email` is present.
- **Ambiguous email:** person email is non-unique JSONB; `findByEmailOrLicense`
  is `limit(1)` first-match. For the beachhead (one deduped chapter roster) this
  is low-risk → first-match + a `warn`-log noting ambiguity is acceptable v1.
  (Officer-side dedup / disambiguation UI = follow-up.)
- **Already-claimed:** skip the override if a `user` already exists with
  `id === match.id` (defensive; better-auth's unique `user.email` already
  prevents two users sharing the claimed email).
- Failure is **non-blocking**: a claim error must not break login (mirror the
  existing after-hook's try/catch warn).

### 3.3 Engine gate (replaces "byte-untouched")

- `git diff main -- specs/ packages/sdk-ts/src/generated` MUST be **EMPTY** (no
  new endpoint/schema → no TypeSpec/SDK regen).
- `services/api-ts/src` diff is limited to `core/auth.ts` (+ its tests). No
  migration. No frozen handler touched.
- Full engine test suite green; new real-PG claim test green; contract suite
  unaffected.

---

## 4. apps/member frontend design (port from apps/org)

Port `apps/org` patterns (verified present): `lib/api.ts` CSRF/credentials
client, `features/auth/use-session.ts` + `sign-in.ts`, `__root.tsx` guard,
`tsconfig.test.json`, `test-utils/mock-sdk.ts`.

### 4.1 Anti-false-green machinery (FIRST)
- Add `apps/member/tsconfig.test.json` (mirror org) and change `typecheck` to
  `tsc --noEmit && tsc -p tsconfig.test.json` so **test files are typechecked**.
- Copy `src/test-utils/mock-sdk.ts` (`ok<T>()`/`err()` verbatim).
- Update the CI `member` job to typecheck tests (mirror the `org` job step), so
  SDK-drift in member test mocks is caught. **No new CI job.**

### 4.2 Authed SDK client (`src/lib/api.ts`)
- Mirror org: `credentials:'include'`, CSRF token on mutating non-exempt paths,
  `x-org-id` injected from `localStorage` on org-scoped paths. Exempt prefixes
  include `/auth/`, `/pay/`, `/csrf-token`.
- The member dashboard is **all GETs + `/auth/*` (CSRF-exempt)** → CSRF rarely
  fires; client is ported for correctness/future, not because a mutation needs
  it. `x-org-id` IS needed: dues endpoints gate on the header. Inject the
  **selected membership's organizationId** (auto-select when the member has one
  membership; minimal selector if >1). Store under `member.selectedOrgId`.
- `client.setConfig` moves from `main.tsx` into `configureApiClient()` (called at
  startup), same as org.

### 4.3 Email-OTP login (`features/auth/`)
- `sign-in.ts` (raw `fetch`, not SDK — `/auth/*` isn't in the OpenAPI client):
  - `requestOtp(email)` → `POST /auth/email-otp/send-verification-otp`
    `{ email, type: 'sign-in' }`.
  - `verifyOtp(email, otp)` → `POST /auth/sign-in/email-otp` `{ email, otp }` →
    creates the user (if absent) + sets httpOnly session cookie + emailVerified=true
    (which enables the engine account-claim). (Plan review C1: the verify-only
    `check-verification-otp` endpoint creates no session — not used.)
  - Both `credentials:'include'`. Return `{ ok } | { ok:false, error }`.
- `use-session.ts`: probe via `getMyMemberships` (401 / transport-undef →
  unauthed), mirror org. Memberships data feeds org auto-select.
- `/sign-in` route: two-step UI (email → 6-digit code). a11y: 18px, ≥48px tap,
  `role=alert` on errors, labeled inputs, one primary task. Resend-code link.
  Honest copy: code is sent by **email**.

### 4.4 Route guard (`__root.tsx`)
- Mirror org's `RootGate`, BUT exempt the public pay flow: redirect to `/sign-in`
  only when `status==='unauthed'` AND pathname is not `/sign-in` and not under
  `/pay/`. `/pay/:token` MUST stay login-free.
- `/` (index) → redirect to `/dashboard` if authed else `/sign-in`.

### 4.5 Dashboard (`/dashboard`) — 3 read-only tiles
All on `@monobase/ui` tokens; `Number()` money at display.

1. **Membership status** — from `GET /persons/me/memberships`. Show org name,
   status (active/expired/pending), renewal-due date (`duesExpiryDate`). DRIFT:
   SDK `MyMembership` type omits `orgName`/`duesExpiryDate`/`joinedAt` →
   mock the **real handler shape** with cast+comment; never bind the lying type.
2. **Dues owed** — from `GET /association/member/dues-invoices` (self-scoped to
   session person; needs `x-org-id`). Sum outstanding (`generated|sent|overdue`)
   `totalAmount` (bigint via transformer → `Number()`). Informational CTA: "To
   pay, use the link your chapter sent you" (no self-serve endpoint). Empty →
   "You're all paid up."
3. **Receipts** — from `GET /association/member/dues-payments` (self-scoped).
   List `receiptNumber`, `amount`, `paidAt`, `status`. `amount` is handler-Number
   but the transformer reconverts to bigint → `Number()` defensively.

### 4.6 Pay-success funnel CTA
On the slice-2a pay-success result (`PayResult`), add a single
"Create an account to track your dues" link → `/sign-in`. One line; closes the
post-payment signup upsell. (Optional, trivial — include unless it churns the
shipped pay page.)

---

## 5. Carry-forward gotchas (bake into every task brief)

- **SDK drift / transformers:** verify every consumed shape by READING THE
  HANDLER SOURCE, not `types.gen.ts`. getMyMemberships/dues endpoints have
  response transformers; types drift. Anchor mocks to handler shapes via
  `ok<T>()`/`err()`; DRIFT endpoints get a cast+comment. `Number()` money at
  display, `BigInt()` at any request seam (none this slice — all reads).
- **SDK imports:** client from `@monobase/sdk-ts/generated/client.gen`; fns from
  `@monobase/sdk-ts/generated`. SDK no-throw on non-2xx → read
  `response.status`/`error`.
- **Test mocking:** `vi.mock('@monobase/sdk-ts/generated', () => ({...}))` factory
  (not `vi.spyOn` on generated ESM). Mirror apps/member `use-pay-link.test.tsx`.
- **routeTree.gen.ts** regen (build) + **COMMIT** before typecheck. Playwright
  `testDir = src/e2e`, pin 1.58.2, portable bin. Port **3004**.
- **No `/api` prefix** in route registration (Vite proxy strips). `sonner` toasts.
- **Engine:** only `core/auth.ts` (+ tests) changes; `specs/` +
  `packages/sdk-ts/src/generated` diff EMPTY; no migration; no frozen handler
  touched.

---

## 6. Testing

- **Engine:** unit (auth.test.ts — mocked repo: email match → id override
  returned; no-match → plain create; ambiguous → first-match+warn; already-claimed
  → skip) + **real-PG integration** (createScratch: seed roster person+membership
  → real auth user creation with that email → assert membership visible + no dup
  person). The integration test IS the spike proving better-auth honors the id.
- **Frontend:** unit (RTL + jsdom) for sign-in steps, session probe, guard
  (incl. `/pay/*` exemption), each tile (loading/empty/data/error, drift-shaped
  mocks). **Stubbed E2E** (Playwright): stub `/auth/email-otp/*` + `/csrf-token`
  + the 3 reads → login → dashboard renders tiles. Non-vacuous (assert real copy
  + gated states), independently run by the controller (not trusted from chat).

---

## 7. Definition of done (hard gate — CI is ground truth)

- All workspaces typecheck **including apps/member tests** (tsconfig.test.json).
- apps/member unit tests pass; apps/member builds; routeTree committed.
- Engine: full suite green + real-PG claim test green; `specs/` +
  `packages/sdk-ts/src/generated` diff EMPTY; `services/api-ts/src` diff limited
  to `core/auth.ts`.
- CI `member` job (now typechecking tests) + engine jobs + ci-gate green.
- `/ship` → PR → watch CI green → squash-merge (convention) → sync main.

---

## 8. Task breakdown (for writing-plans)

**Phase A — engine (real-PG TDD):**
- A1. RED real-PG integration test: roster member email-OTP login surfaces
  memberships (proves the gap, then the fix). Spike better-auth id-override.
- A2. GREEN: `create.before` account-claim (id-override) + unit tests +
  guards (ambiguous/already-claimed/non-blocking) + logging. Engine gate green.

**Phase B — apps/member (port + build):**
- B1. Anti-false-green machinery: `tsconfig.test.json`, `test-utils/mock-sdk.ts`,
  `typecheck` script, CI `member` job typechecks tests.
- B2. Authed client (`lib/api.ts`) + `x-org-id`/org-select + session probe +
  `__root` guard (with `/pay/*` exemption) + `/` redirect.
- B3. Email-OTP `/sign-in` two-step flow (send → verify) + tests.
- B4. `/dashboard` + 3 read-only tiles (drift-anchored mocks) + money `Number()`.
- B5. Stubbed E2E (login → dashboard) + pay-success signup CTA + final gate green.
