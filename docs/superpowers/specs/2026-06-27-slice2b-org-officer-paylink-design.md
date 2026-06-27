# Slice-2b — apps/org Officer UI (send pay-link + dues management)

Date: 2026-06-27
Status: design (brainstorm-locked, autonomous per defer-decisions)
Predecessor: slice-2a (apps/member login-free pay-link page, PR #46, v0.1.5.0)
Engine: FROZEN (additive-only). No `services/api-ts`, `specs/`, or generated-SDK changes in this slice.

## Goal

Close the officer half of the first-peso loop. Slice-2a let a member pay a tokenized
pay-link. Slice-2b gives Dr. Olive (chapter officer) the tool to **mint and send that
link**, and to **see who has paid**. One new authed PWA: `apps/org`.

Loop: officer signs in → picks a member → mints a pay-link (optionally tied to an
outstanding dues invoice) → shares it (copy/SMS/Viber by hand) → member pays (slice-2a)
→ officer sees the payment land in the dues view.

## Scope (LOCKED)

IN:
- Officer sign-in (email + password) against better-auth.
- Org context resolution + officer gate.
- Roster list (members of the org).
- Send pay-link from a member (amount; optionally linked to an outstanding invoice).
- Shareable-link result (copy + `sms:` share) + immediate revoke of the just-minted link.
- Dues / "who paid" view: dashboard tiles + recent payments + outstanding invoices.

OUT (later slices):
- Roster CSV import → slice-2c.
- Member dashboard, apps/console → later.
- Email-OTP / magic-link officer login (password is enough for the beachhead).
- Full "manage all active pay-links" view (blocked: no engine list-tokens endpoint — see Gaps).
- Creating dues invoices / generating dues runs (officer sends links against existing
  invoices or ad-hoc amounts; invoice generation is its own slice).
- Backend SMS dispatch (G3-gated; v1 shares the link by hand).

## Engine facts (verified, file:line)

All routes have NO `/api` prefix (Vite proxy strips it; SDK baseUrl `/api`).

Auth (cookie + CSRF — the novel surface vs public slice-2a):
- Sign-in: `POST /auth/sign-in/email` `{email,password}` → sets **httpOnly session cookie**
  (`src/core/auth.ts:454-458`). No bearer token needed for a same-origin SPA.
- Session read by `auth.api.getSession({headers})` in `src/middleware/auth.ts:145-148`
  (reads cookie automatically). User id + roles land in `ctx.get('user')`.
- **CSRF double-submit** (`src/middleware/csrf-token.ts:82-123`, registered `src/app.ts:272-284`):
  all state-changing methods require header `x-csrf-token` matching cookie `csrf_token`,
  EXCEPT allowlisted prefixes (`/webhooks/`, `/billing/webhooks/`, `/email/unsubscribe`,
  `/pay/`, `/auth/`, `/test/`). **`/org/...` is NOT allowlisted** → send-link + revoke POSTs
  MUST carry the CSRF header. Token obtained via `GET /csrf-token`.
- `requireOfficerMiddleware` (`src/middleware/require-officer.ts:42-57`): requires ≥1 active
  officer term in the org; enforces 2FA in prod for privileged positions.

Officer endpoints:
- Send link: `POST /org/{organizationId}/payments/send-link`, roles
  `["association:admin","association:staff"]` + officer. Body `{ personId (req), amount?, invoiceId? }`.
  → `201 { token, paymentUrl: "/pay/{token}", expiresAt }`
  (`handlers/member/duesspecialassessments/sendPaymentLink.ts:20-84`).
  If `amount` omitted and no `invoiceId` → org dues-config default.
- Revoke: `POST /org/{organizationId}/payments/{tokenId}/revoke` → `200 { revoked }`;
  cross-org / used / not-found → 404 (`revokePaymentLink.ts:18-36`).

Read endpoints:
- Roster: `GET /membership/members/{organizationId}`, role `association:admin` + in-org/platform-admin.
  → `{ data: [{ id(membershipId), personId, firstName, lastName, status, memberNumber?, duesExpiryDate, categoryId? }] }`
  (`handlers/membership/listOrgMembers.ts:21-102`).
- Dues invoices: `GET /association/member/dues-invoices` (officer sees all org). Query
  `offset,limit,membershipId?,status?`. → `{ data:[DuesInvoice + memberName], totalCount, totalPages, currentPage }`
  (`listDuesInvoices.ts:30-55`). `amount` may be bigint at runtime — coerce `Number()`.
- Dues payments: `GET /association/member/dues-payments`. Query `page,pageSize,offset,limit,personId?,status?`.
  → `{ data:[{ amount(number), refundedAmount, ... }], totalCount }` (`listDuesPayments.ts:28-50`).
- Dues dashboard: `GET /dues/dashboard/{organizationId}` (path-scoped; no x-org-id needed) →
  `{ data:{ totalCollected, totalOutstanding, paidCount, unpaidCount, overdueCount, collectionRate(0-100), memberCount } }`
  (`getDuesDashboard.ts:25-47`). `totalCollected/Outstanding` = centavos.
- Org list (officer's orgs): `GET /persons/me/memberships` →
  `{ data:[{ organizationId, orgName, orgSlug, status, ... }], total }` (`getMyMemberships.ts`).
- Officer-term confirm: `GET /persons/me/officer-role/{organizationId}` → `{ data: { isOfficer: boolean; positions: [] } }`
  (`getMyOfficerRole.ts:10`). Read `data.isOfficer` (the wrapper object is always non-null).
- Dues list endpoints (`listDuesInvoices`/`listDuesPayments`) gate on the **`x-org-id` request header**
  (org-context.ts), NOT a query param — apps/org injects it from the selected org via the SDK client.

## Engine gaps (flagged, NOT silent scope creep — no engine change this slice)

- **GAP-1 — no list-payment-tokens endpoint.** `PaymentTokenRepository` has no `findByOrg`/list
  wired to a route. ⇒ Revoke is only offered on the **just-minted link** (tokenId held in UI
  state on the result screen). A full "active links" management view needs an additive engine
  `GET /org/{orgId}/payments` later. Acceptable for v1.
- **GAP-2 — no "my officer orgs" endpoint.** Officer terms ≠ memberships. ⇒ The app lists orgs
  from `GET /persons/me/memberships`, and confirms officer status per selected org via
  `GET /officer-role/{orgId}`. Fine for the single-org beachhead; an engine
  `GET /persons/me/officer-orgs` would be cleaner later.
- **GAP-3 — CSRF + cookie auth** is novel vs slice-2a's public page. Handled in-app by a
  configured SDK client (below), not an engine change.

## Architecture

New workspace `apps/org`, scaffolded by **copying apps/member** (Vite 7, React 19,
TanStack Router ^1.131 + plugin ^1.132, React Query ^5.85, `@monobase/ui`, `@monobase/sdk-ts`,
real vitest + RTL + jsdom, Playwright pinned 1.58.2). Differences from member:
- **Dev port 3005** (member = 3004). Same `/api` → `:7213` proxy with `^/api` rewrite.
- **Authed** (member was public). Adds an auth/session layer + a configured SDK client.

### Authed SDK client (the spine — GAP-3)

`apps/org/src/lib/api.ts`: configure the generated `@monobase/sdk-ts/generated/client.gen`
client once:
- `credentials: 'include'` on every request (send the session cookie).
- A request interceptor that, on mutating methods (POST/PUT/PATCH/DELETE) to non-`/auth`,
  non-`/pay` paths, lazily fetches `GET /csrf-token` (once, cached for the session) and sets
  the `x-csrf-token` header to match the `csrf_token` cookie.
- SDK does NOT throw on non-2xx and returns `data: undefined` on transport error — every
  caller reads `response.status` and throws in queryFns/mutationFns (slice-2a discipline).
- SDK transforms money `amount` → bigint at runtime — `Number(...)` at any math/format boundary.

### Auth / session layer

- `useSession` hook: `GET /persons/me/memberships` doubles as the "am I logged in?" probe
  (401 → not authed). React Query, no retry on 401.
- Router guard: any app route except `/sign-in` redirects to `/sign-in` when the session probe
  401s. On sign-in success, redirect to `/`.
- Sign-in page (`/sign-in`): email + password form → `POST /auth/sign-in/email` (CSRF-allowlisted,
  cookie set on response) → invalidate session query → redirect. role/officer errors surface inline.
- Org context: from memberships. 1 org → auto-select; >1 → a simple picker stored in app state
  (React context or a tiny store; persist selected orgId in `localStorage`). Selected org gated by
  `GET /officer-role/{orgId}` — non-officer → "not an officer of this org" empty state.

### Screens (one primary task each, all on `@monobase/ui` Friendly-Clarity tokens)

1. `/sign-in` — email+password. role=alert on failure. ≥48px controls, 18px base.
2. `/` (Roster) — org name header + org picker (if >1) + member list (name, member#, status badge).
   Primary action per member: **Send pay-link**. Empty state when no members.
3. `/members/$membershipId/send` (Send pay-link) — member header; lists the member's outstanding
   dues invoices (`dues-invoices?membershipId=&status=` generated/sent/overdue) with a "Send link"
   action each (passes `personId+invoiceId+amount`); plus a **custom amount** field for an ad-hoc
   link (`personId+amount`, no invoice). On mint → result panel: the full pay-link URL, **Copy**
   button (sonner toast), an `sms:?body=` share link, the expiry, and **Revoke** (the just-minted
   tokenId). Double-submit guard on the mint mutation.
4. `/dues` (Who paid) — dashboard tiles (collected ₱, collection rate %, paid/unpaid/overdue counts,
   member count) + recent payments list (`dues-payments`, status badges) + outstanding invoices
   (`dues-invoices?status=`). Read-only.

Money formatting: add `centavosToPhp` to **packages/ui** (shared home; both apps format centavos)
and consume it in apps/org. Leave apps/member's existing copy untouched (shipped; lifting it =
needless risk). `// ponytail: 1-line dup in member, shared util lives in packages/ui`.

### Error / edge handling

- send-link: 400 (not configured / bad amount) → inline error; 403 (not officer) → officer empty
  state; success → result panel.
- revoke: 404 → "link already used or revoked" toast (idempotent UX); 200 → "revoked" + disable.
- Money: coerce `Number(amount)` everywhere (bigint trap). Clamp/disallow ≤0 custom amounts.
- All authed mutations go through the CSRF-aware client; a missing/expired CSRF token triggers one
  refetch of `/csrf-token` then retry once.

## Testing

- Unit (vitest + RTL + jsdom): the CSRF-aware api client (injects header on POST, not on GET/`/auth`,
  caches token, refetch-on-403-once); useSession 401→unauthed; org picker auto-select vs choose;
  send-link form (invoice-linked + custom amount, double-submit guard, money coercion, success→result
  panel); revoke (200 disables, 404 idempotent toast); dues view formatting (centavos→₱, rate %,
  bigint coercion); sign-in success/failure.
- E2E (Playwright, pinned 1.58.2, self-contained via `page.route` stubs of `/auth/sign-in/email`,
  `/csrf-token`, memberships, members, send-link, dues — NO live API): sign-in → roster →
  send-link → result panel shows link + copy. Mirrors slice-2a's stubbed-E2E approach.
- NO `@monobase/vitest-test-shim`. vitest `include:['src/**/*.test.ts','src/**/*.test.tsx']` so
  `.spec` E2E files are excluded. `test:e2e` uses portable `../../node_modules/.bin/playwright test`.
- routeTree.gen.ts generated (tsr/build) BEFORE typecheck and COMMITTED.

## CI / gates (hard, don't fake green)

- New CI **`org` job** mirroring the `member` job: build → typecheck → test, bun 1.2.21,
  frozen-lockfile, wired into `ci-gate` `needs` with a `!= "success"` hard-fail check.
- e2e-org NOTE-marked deferred (mirrors deferred e2e-member).
- Engine-frozen invariant: `git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated`
  MUST be EMPTY. apps/org adds NOTHING under `services/`.
- All workspaces typecheck; apps/org unit tests pass; apps/org builds.
- CI is ground truth (slice-1/2a both had local-green/CI surprises) — watch the new `org` job to green.

## Out-of-scope reminders / deferrals

- Real-PayMongo-test-key E2E + seed-in-CI e2e job remain G2-gated (founder long pole).
- Full pay-link management (GAP-1) and `my-officer-orgs` (GAP-2) are additive engine follow-ups,
  not this slice.
