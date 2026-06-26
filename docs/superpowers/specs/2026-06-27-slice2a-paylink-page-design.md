# Slice-2a — "First Peso" Login-Free Pay-Link Page (design)

**Status:** approved (brainstorm 2026-06-27) → ready for implementation plan
**Branch:** `feat/slice2a-paylink-page`
**Depends on:** slice-1 dues pay-link engine (PR #45, merged `94491c9f`, v0.1.4.0)

## Goal

A member taps a tokenized link, lands on a **no-login** page, sees the dues amount
in GCash-familiar form, taps **Pay now**, completes a PayMongo **test-mode**
checkout into the org's own account, and sees a clear paid / cancelled result.

This is the **first peso**: it closes the money loop end-to-end in a real browser
and de-risks the lean frontend scaffold (Vite + `packages/ui` + SDK + Vite proxy)
that every later app copies.

## Scope

**In:**
- New `apps/member` app, scaffolded minimally — **one route only**: `/pay/:token`.
  This is the canonical lean-app scaffold (build tooling + `packages/ui` + SDK +
  Vite `/api` proxy) that `apps/org` and the member dashboard will copy later.
- The login-free pay-link page: a small state machine over the two **live** engine
  routes (`GET /pay/:token/validate`, `POST /pay/:token/checkout`).
- A dev seed/setup that produces a **real, openable** pay URL for testing.
- Unit tests of the page state machine (SDK mocked) + an E2E of the flow (PayMongo
  checkout mocked for now — see Testing).

**Out (later slices):**
- `apps/org` officer UI — send-link, dues management → **slice-2b**.
- Roster CSV import → **slice-2c**.
- Member dashboard + passwordless OTP login → later.
- `apps/console` platform-admin → later.
- Real-PayMongo-test-mode E2E (needs real `pk_test`/`sk_test`) → deferred, same
  gate pattern as the G2 live-flip. The page + engine are fully exercised now with
  a mocked checkout; only the hosted-checkout hop is stubbed.

## Architecture

### The app (`apps/member`)
Mirror the reference scaffold (`/desktop/memberry-full/apps/memberry`), but lean and
on the canonical design system:
- **Vite 7** + `@vitejs/plugin-react` + **React 19** + TypeScript (extends
  `@monobase/typescript-config`).
- **TanStack Router** (file-based, `@tanstack/router-plugin`) — one route file
  `src/routes/pay/$token.tsx` + `src/routes/__root.tsx`.
- **@tanstack/react-query** for data (provider in `src/main.tsx`).
- **Tailwind** consuming `packages/ui` — `tailwind.config.ts` `presets: [preset]`,
  `content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}']`;
  `import preset from '@monobase/ui/tailwind-preset'`. Import `@monobase/ui/tokens.css`
  + Hanken Grotesk. `postcss.config.ts` = tailwindcss + autoprefixer.
- **Vite proxy** (the no-`/api`-prefix gotcha): `'/api' → http://localhost:7213`,
  `rewrite: p => p.replace(/^\/api/, '')`. Dev port **3004** (matches the engine's
  default `PUBLIC_URL` fallback `http://localhost:3004` used to build checkout
  return URLs).
- **SDK**: `@monobase/sdk-ts` generated client + react-query helpers
  (`validatePaymentToken`, `checkoutPaymentToken`). Point the SDK `baseUrl` at the
  Vite proxy (`/api`) via `client.setConfig({ baseUrl })` in `main.tsx`
  (`VITE_API_URL` override, default `\`${location.origin}/api\``).
- **No auth** — no `better-auth`, no session/CSRF provider. The page is public; the
  checkout POST is unauthenticated.

### Data contract (engine, live on main — do not change)
- `GET /pay/:token/validate` (`validatePaymentToken`) — **always HTTP 200**:
  - valid: `{ valid: true, invoiceId?, amount: number /*centavos*/, currency, memberName, orgName, dueDate /*ISO*/ }`
  - `{ valid: false, status: 'already_paid', error }`
  - `{ valid: false, error }` (expired / invalid / revoked — distinguished by message)
- `POST /pay/:token/checkout` (`checkoutPaymentToken`):
  - `200 { checkoutUrl }` → redirect immediately
  - `202 { checkoutUrl: '' }` → race (another tap holds the lease) → retry
  - `400 { error }` → bad token OR gateway not configured for the org
  - `409 { error }` → already processed
  - `410 { error }` → revoked or expired
  - `502 { error }` → PayMongo network failure → retryable
- Return URLs the engine builds: `${PUBLIC_URL}/pay/:rawToken?status=success|cancelled`.

## The page state machine (`src/routes/pay/$token.tsx`)

Read `?status` from `Route.useSearch()` on mount; otherwise validate.

| State | Trigger | UI (DESIGN.md: GCash-style, ≥18px, ≥48px targets, labeled, depth) |
|---|---|---|
| `loading` | initial validate in flight | calm spinner + "Checking your payment link…" |
| `payable` | validate `valid:true` | **Pay card**: org name header, **big tabular amount** `₱X,XXX.00`, member name + due date rows, one primary **Pay now** button (≥48px) |
| `paying` | Pay tapped, checkout in flight | button → disabled/spinner |
| `redirecting` | checkout `200` | `window.location.href = checkoutUrl` |
| `retrying` | checkout `202` | bounded retry ~1.5s × 3; on exhaustion → `temporaryError` |
| `succeeded` | mount with `?status=success` | ✓ "Payment received" (re-validate to confirm `already_paid`; if still payable, show "confirming…") |
| `cancelled` | mount with `?status=cancelled` | "Payment cancelled — you can try again" + Pay now |
| `alreadyPaid` | validate `status:'already_paid'` | ✓ "This has already been paid" (terminal) |
| `expired` | validate error = expired, or checkout `410` | "This link has expired — ask your organization for a new one" |
| `invalid` | validate error = invalid/revoked, or checkout `410` revoked | "This payment link is no longer valid" |
| `notConfigured` | checkout `400` gateway | "This organization hasn't finished payment setup yet" (officer-facing copy avoided) |
| `temporaryError` | checkout `502` / retry exhaustion / network | "Something went wrong — please try again" + retry |

Use `packages/ui` primitives: `Button`, card/layout, `ErrorState` (`role="alert"`),
`EmptyState`, `StatusBadge`. Money formatting: centavos → `₱` + `toLocaleString`
with 2 decimals, tabular figures (`.tabular-amount` token).

### Units (isolation)
- `pay/$token.tsx` — route component, owns layout + which state to render.
- `usePayLink(token)` hook — encapsulates validate query + checkout mutation +
  the 202-retry + `?status` reconciliation, returns a discriminated `state`. Keeps
  the component a thin renderer; the hook is unit-testable in isolation with the SDK
  mocked.
- Small presentational pieces (`PayCard`, `PayResult`) if the component grows.

## Seed / test harness

The existing `bun run db:seed` is insufficient for a real openable link (Area-4
findings): its gateway `encryptedSecret` is raw plaintext (decryption fails) and its
payment tokens use fake hashes (not URL-addressable). Add a small dev helper that
produces a **real** testable link:
1. Ensure Dr. Olive's org + a member (person) + a dues invoice exist (reuse seed
   layers where possible).
2. Set a per-org PayMongo gateway config the **correct** way — encrypt the secret
   via the `upsertDuesGatewayConfig` path / `encryptCredential` (NOT raw plaintext),
   using **placeholder** `pk_test`/`sk_test` for now (swap real test keys later).
3. Mint a real pay-link via the `send-link` route (`POST /org/:org/payments/send-link`)
   → `{ token, paymentUrl }`. Print `paymentUrl` to open at `http://localhost:3004/pay/:token`.

This helper is a dev convenience (not shipped behavior); keep it a script under
`services/api-ts/scripts/` or `apps/member`.

## Testing

- **Unit (Vitest + Testing Library):** `usePayLink` / the page state machine with the
  SDK mocked — cover every state transition: valid→payable→redirect(200);
  202→retry→redirect; 400/409/410/502 → the right terminal/error state;
  `?status=success`→succeeded(+re-validate); `?status=cancelled`→cancelled. Assert
  real rendered text/amount, not just "renders".
- **E2E (Playwright / `/browse`):** open the seeded pay URL → see amount → tap Pay.
  **PayMongo hosted checkout is mocked now** (intercept the checkout call / stub the
  redirect) → simulate the `?status=success` return → assert the succeeded state and
  (optionally) that a simulated webhook reconciled the dues invoice to paid. The
  real-PayMongo-test E2E is deferred until real `pk_test`/`sk_test` exist.
- Accessibility smoke: 18px base, ≥48px Pay button, labeled controls, `role="alert"`
  on error — per DESIGN.md.

## Decisions / deviations
- **`apps/member`, not a standalone page** — the pay page is the member app's first
  screen per CLAUDE.md, and scaffolding it now yields the reusable lean-app blueprint.
- **Generated SDK + react-query** over the reference app's raw `fetch` — typed,
  cleaner, and the page benefits from query/mutation state.
- **Mocked-PayMongo E2E now**, real test-key E2E deferred — avoids blocking on an
  external PayMongo test account; the page + engine wiring are fully covered.
- **Ignore `validatePaymentLink`** (orphan, JWT-style legacy) — only the wired
  `validatePaymentToken` is used.
- Engine is FROZEN — this slice is additive frontend + a dev seed helper; no engine
  handler/schema changes. If the page needs a field validate doesn't return, that's
  a flagged engine follow-up, not silent scope creep.

## Risks
- Engine `PUBLIC_URL` default `http://localhost:3004` must match the dev app port, or
  the PayMongo return lands on the wrong origin. Pin app dev port = 3004.
- 202-retry must be bounded (no infinite loop) and must not double-create sessions —
  the engine's claim mutex already guarantees one session; the page just retries the
  read.
