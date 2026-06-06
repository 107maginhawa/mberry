# UI-REVIEW — Batch 3 (Retroactive 6-Pillar Audit)

**Date:** 2026-06-02
**Scope:** m11 Documents/Credentials, m12 Elections/Governance, m14 National Dashboard, m19 Committee Management, m20 Booking, m21 Billing
**Mode:** Code-only (no dev server / no screenshot capture)
**Pillars:** 1 = Visual hierarchy/IA, 2 = Interaction state coverage, 3 = Design-system alignment, 4 = AI-slop patterns, 5 = Responsive + a11y, 6 = Trust + polish (1-10 scale)

---

## m11 — Documents & Credentials

**Primary user:** Member (browses docs / views own certificates) and Officer (uploads docs, bulk-issues certs).
**Primary task:** Find/preview a published document; view a personal certificate; officer issues a batch.

**Surfaces:**
- `apps/memberry/src/features/documents/components/document-browser.tsx` (member browser)
- `apps/memberry/src/features/documents/components/document-library.tsx` (officer library)
- `apps/memberry/src/features/certificates/components/certificate-list.tsx`
- `apps/memberry/src/features/certificates/components/certificate-preview.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/certificates.tsx`

| # | Pillar | Score | Evidence |
|---|---|---|---|
| 1 | Visual hierarchy | 7 | Clean two-tier IA (stats row → filters → list). Cert preview has accent bar + 2-col grid (`certificate-preview.tsx:60-92`). Officer certs page uses 2-col card layout but lacks any results list of past issuances — only forms (`officer/certificates.tsx:63-163`). |
| 2 | State coverage | 7 | Loading skeletons present everywhere (`document-browser.tsx:186-191`, `document-library.tsx:503-508`, `certificate-list.tsx:26-34`). Empty states with copy + icon (`document-browser.tsx:196-207`, `certificate-list.tsx:36-44`). Errors handled (`document-browser.tsx:192-195`). **Gap:** officer bulk-issue has no in-page result/history list; toast only (`officer/certificates.tsx:26-35`). |
| 3 | Design-system | 6 | Mostly token-driven (`var(--color-*)`). **Drift:** `document-browser.tsx:226` uses raw Tailwind `bg-emerald-100 text-emerald-800` instead of token. `document-library.tsx:114-122` mixes status pills with token classes plus inline `STATUS_COLORS` map duplicating tokens. Two parallel browser components for the same domain (browser vs library) — divergent: browser uses `border rounded-lg`, library uses `GlassCard`. |
| 4 | AI-slop | 5 | Multiple smells: (a) `alert('Verification link copied to clipboard!')` (`certificate-preview.tsx:51`) — native alert instead of sonner toast, against project convention (CLAUDE.md "use sonner, not useToast"). (b) Two doc UIs with overlapping responsibility (browser vs library). (c) `document-browser.tsx:107-124` fires two parallel queries for `tenantOnly` + `public` and merges client-side — likely an LLM workaround for missing API support. (d) `Showing` stat card duplicates `Total` (`document-library.tsx:375-381`). |
| 5 | Responsive + a11y | 6 | `aria-label` on icon buttons (`document-library.tsx:128`, `election-detail.tsx:395`). `role="alert"` on errors (`document-library.tsx:349`). **Gaps:** dropdown menu in `document-library.tsx:132-167` is a hand-rolled DIV — no `role=menu`, no keyboard escape, no outside-click close, no focus return. File input `<label>` wraps `<input type="file" className="hidden">` (line 399-402) — no visible focus ring. |
| 6 | Trust + polish | 6 | Cert preview is formal and trustworthy. **But:** `confirm`-style alert at line 51, `cert.trainingId?.slice(0, 8)` truncation in `certificate-list.tsx:57` exposes raw UUID stub to members ("Training ID: 0c8a3e2c..."), `cert.organizationId` shown to user as a UUID in preview (`certificate-preview.tsx:90`). Officer bulk-issue takes person UUIDs by paste — no member-picker (`officer/certificates.tsx:90-98`). |

**Module overall:** **6.2 / 10** (weighted toward state coverage and slop).

**Top 3 findings:**
1. **P0 — replace `alert()` with sonner toast** in `certificate-preview.tsx:51`. Violates CLAUDE.md convention; jarring native modal.
2. **P1 — collapse the two document UIs** (`document-browser.tsx` member vs `document-library.tsx` officer) into one with role-gated affordances. Today the divergent visual systems and double-query merge in `document-browser.tsx:107-146` are slop indicators.
3. **P1 — officer bulk-issue UX** at `officer/certificates.tsx:90-98` takes raw UUIDs in a textarea. Replace with a member multi-select; also surface issuance history below the form.

---

## m12 — Elections & Governance

**Primary user:** Member (votes, views nominees) and Officer (creates election, manages phases).
**Primary task:** Cast a ballot during voting phase; advance election lifecycle.

**Surfaces:**
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/governance/index.tsx`
- `apps/memberry/src/features/elections/components/election-list.tsx`
- `apps/memberry/src/features/elections/components/election-detail.tsx`
- `apps/memberry/src/features/elections/components/voting-ballot.tsx`
- `apps/memberry/src/features/elections/components/election-timeline.tsx`
- `apps/memberry/src/features/elections/components/nominee-picker-dialog.tsx`, `self-nomination-dialog.tsx`

| # | Pillar | Score | Evidence |
|---|---|---|---|
| 1 | Visual hierarchy | 8 | Governance hub: stat cards → active elections → recent docs is a sensible scan path (`governance/index.tsx:60-170`). Election detail has clear lifecycle banner + timeline + positions list + per-nominee tally bars (`election-detail.tsx:259-414`). Voting ballot uses radio-card pattern with "Selected ✓" microcopy (`voting-ballot.tsx:217-272`). |
| 2 | State coverage | 8 | Loading, error, empty, "no positions yet", "no nominees", "already voted" guard (`voting-ballot.tsx:122-136`), "voting not open" guard (`voting-ballot.tsx:103-119`), per-position partial-success retry in `handleConfirmedSubmit` (`voting-ballot.tsx:148-197`). This is the most thorough state coverage in the batch. Confirm dialog before submit (line 300-325). |
| 3 | Design-system | 5 | **Inconsistency:** election-list uses snake_case statuses (`nominationsOpen`, `votingOpen` — `election-list.tsx:14`), election-detail uses snake_case ALL different (`nominations_open`, `voting_open` — `election-detail.tsx:50-65`) — two STATUS_COLORS maps. Hardcoded `bg-emerald-100 text-emerald-800` (`election-detail.tsx:54,71,347`, `election-list.tsx:29`), `bg-purple-100`, `bg-orange-100` (`election-list.tsx:34-35`) bypass tokens. `text-h4` token sits next to raw `text-[26px] font-bold font-display` (`election-list.tsx:90`). |
| 4 | AI-slop | 5 | (a) Two parallel status enums (`nominations_open` vs `nominationsOpen`) suggest the model copy-pasted across files without picking one. (b) `text-[28px]`, `text-[26px]`, `text-[22px]` arbitrary sizes used 3+ times in governance + elections — token says `font-display` but sizes are arbitrary. (c) Hand-rolled modal in `voting-ballot.tsx:300-325` instead of using `Dialog` from `@monobase/ui` — `// eslint-disable-next-line no-restricted-syntax` markers acknowledge this. (d) `Yes, proceed` button (`election-detail.tsx:236`) is a generic phrasing for a status transition; specific verb would be clearer ("Open Voting Now"). |
| 5 | Responsive + a11y | 6 | Radio inputs are real `<input type="radio">` with proper `name`/`checked` (`voting-ballot.tsx:243-249`) — passes keyboard. `role="alert" aria-live="polite"` on errors (`voting-ballot.tsx:276`). **Gap:** Hand-rolled confirm modal at `voting-ballot.tsx:300-325` has no `role="dialog"`, no `aria-modal`, no focus trap, no `aria-labelledby`. Modal closes on backdrop click but no Escape handler. Grid layouts are responsive (`grid-cols-2 sm:grid-cols-4`). |
| 6 | Trust + polish | 7 | Ballot confirmation includes "⚠ Your vote cannot be changed after submission" warning (`voting-ballot.tsx:315`) — strong trust signal. Timeline component visualizes 4 phases. Winner highlight with Trophy icon (`election-detail.tsx:350`). **Minor:** results page mixes `bg-emerald-50` ad-hoc with token surface. |

**Module overall:** **6.5 / 10**.

**Top 3 findings:**
1. **P0 — unify status enums.** `election-list.tsx` uses camelCase, `election-detail.tsx` uses snake_case. Two STATUS_COLORS / STATUS_LABELS maps. Pick one (API contract is camelCase) and delete the other. Bugs already lurk (line 33-35 of `governance/index.tsx` filter relies on camelCase; `election-detail.tsx:172` uses snake_case — same value won't match across pages).
2. **P1 — replace hand-rolled confirm modal** at `voting-ballot.tsx:300-325` with `Dialog` from `@monobase/ui`. Adds focus trap, escape, aria-modal — essential for a vote confirmation.
3. **P1 — replace arbitrary text sizes** `text-[28px]/[26px]/[22px]` across the module with declared display tokens; or extend the token scale.

---

## m14 — National Dashboard

**Primary user:** Authenticated member (any role, any org).
**Primary task:** Get an at-a-glance health check across all their memberships.

**Surface:** `apps/memberry/src/routes/_authenticated/dashboard.tsx` (493 lines, single file).

> The `/dashboard` route at `_authenticated/dashboard.tsx` is the cross-org member dashboard. No separate "national" route exists. Treating this as the National Dashboard for the audit.

| # | Pillar | Score | Evidence |
|---|---|---|---|
| 1 | Visual hierarchy | 7 | AlertBanner → greeting header → org membership cards → 3 action widgets (Dues/CPD/Next Event) → QuickActions → Announcements + Credit Breakdown (`dashboard.tsx:197-349`). Reads top-to-bottom by urgency. Status dot on org card (`dashboard.tsx:418-422`) is small but effective. |
| 2 | State coverage | 7 | Skeletons (`dashboard.tsx:230-234`), EmptyState with CTA (`dashboard.tsx:235-240`), error fallback per-widget via `errorMessage` prop (`dashboard.tsx:266,284`). **Gap:** when ALL queries error, no global "dashboard couldn't load" — user sees a soup of "Unable to load X" pills. Onboarding prompt only shows if no specialization (`dashboard.tsx:212`) — good. |
| 3 | Design-system | 7 | Heavy use of design tokens (`var(--color-primary)`, `var(--color-muted)`, `var(--shadow-soft)`). `GlassCard`, `StaggerGrid`, `CountUp` are recurring patterns. **Drift:** uses inline `Object.keys`, hand-rolled status-color maps with token vars (lines 393-403) — OK but repeats the pattern from elections. `text-h4` mixed with arbitrary `text-[28px]` once. |
| 4 | AI-slop | 5 | (a) **`any` everywhere:** `useQuery<any[]>`, `as any`, `(m: any)` count: 18+ occurrences (`dashboard.tsx:45,53,84,107-114,121-126,137,143-148,...`). Implies LLM bypassed SDK typing rather than fix the underlying type mismatch. (b) Two parallel API-shape probes (`person_id` vs `personId`, snake vs camel — lines 144-156) suggest the model patched over a backend serialization issue at the FE. (c) Direct `api.get('/api/persons/me/memberships')` mixed with SDK `getPersonOptions` — convention violated (CLAUDE.md says no `/api` prefix). (d) Single 493-line route file: routes should delegate to feature components. |
| 5 | Responsive + a11y | 7 | `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3` for org cards. `aria-hidden` on decorative icons (`dashboard.tsx:218,467`). `role="img" aria-label` on the status dot (lines 419-422). **Gap:** no `<main>` or page landmark; no skip link. Greeting changes mid-day but `<h1>` is dynamic — could confuse screen readers if they re-read. |
| 6 | Trust + polish | 7 | "Good morning, {name}" + subtitle is warm. Dues amount formatted with `₱` and `toLocaleString()` (`dashboard.tsx:259`) — locale-aware. CountUp on numeric stats adds polish. **But:** "Unable to load X" microcopy is repetitive (3 widgets show same). |

**Module overall:** **6.7 / 10**.

**Top 3 findings:**
1. **P0 — kill the `any` cascade.** 18+ `as any` / `<any>` across `dashboard.tsx`. Type fields from the SDK. The snake/camel divergence (`compliance_status` vs `complianceStatus`, lines 153-156) belongs in a single adapter, not inline `??` chains.
2. **P1 — split the 493-line route.** Move `OrgCard`, derived computations, and section JSX into `features/dashboard/components/`. Today logic + view + data layer in one file.
3. **P1 — direct `api.get('/api/persons/me/...')` calls** at `dashboard.tsx:48,80,111` should be SDK hooks; the manual `/api/` prefix violates the documented "no `/api` prefix" convention (CLAUDE.md).

---

## m19 — Committee Management

**Primary user:** N/A.
**Primary task:** N/A.

**Status:** **NO UI YET.**

`find apps/memberry/src -name "committee*"` returns zero results. No committees feature folder, no committees route, no committees component. The domain may be partially handled by elections (officer positions) but there is no surface labelled "committee" anywhere.

**Pillar scoring: skipped.**

**Top finding (informational):**
- Either (a) committees are out of scope for v1 and the spec should say so explicitly, or (b) the m19 surface was never built — confirm with product. If it should exist, even a placeholder route with "Coming soon" would close the gap.

---

## m20 — Booking

**Primary user:** Member browsing hosts; host receiving bookings (UI captured here is the booker side).
**Primary task:** Pick a host, see availability, select slot, proceed to confirm.

**Surfaces:**
- `apps/memberry/src/features/booking/components/booking-widget.tsx`
- `apps/memberry/src/features/booking/components/host-directory.tsx`
- `apps/memberry/src/features/booking/components/active-booking-card.tsx`
- `apps/memberry/src/features/booking/components/booking-event-editor.tsx`
- `apps/memberry/src/features/booking/components/booking-widget-skeleton.tsx`
- `apps/memberry/src/routes/_authenticated/my/bookings/host.$personId.tsx`

| # | Pillar | Score | Evidence |
|---|---|---|---|
| 1 | Visual hierarchy | 7 | Card → CardHeader/Title → date grid (7 days) → time slot grid → selected summary → CTA → policy footer (`booking-widget.tsx:51-184`). Clear top-down flow. Host page wraps with `HostHeader` avatar card above widget (`host.$personId.tsx:131-141`). |
| 2 | State coverage | 7 | Dedicated skeleton component exists (`booking-widget-skeleton.tsx`). `Loader2` spinner shown while events fetch (`host.$personId.tsx:95-101`). Empty: "This host doesn't have a public schedule yet" (line 118). No-slots Alert (`booking-widget.tsx:117-122`). Error: `ErrorState` with retry (`host.$personId.tsx:81-93`). **Gap:** no per-day-no-availability vs no-slots-overall differentiation; the widget shows the same Alert. Day buttons go `opacity-50` + disabled when no availability — good (line 77-80). |
| 3 | Design-system | 7 | Uses `@monobase/ui` primitives (`Card`, `Button`, `Separator`, `Alert`, `Badge`, `Avatar`) consistently. **Drift:** local hand-rolled `Label` component at line 218-220 of `booking-widget.tsx` instead of UI lib's Label. `$` price symbol hardcoded (`booking-widget.tsx:142`) while rest of app uses `₱`. |
| 4 | AI-slop | 6 | (a) Hardcoded "30 minutes" duration in summary (`booking-widget.tsx:138`) regardless of slot length. (b) Hardcoded `$` currency symbol while membership/dues use `₱` (m11/m14). (c) "15-minute confirmation" promise in footer (line 162-167) — text is hardcoded, no backing data, looks AI-generated boilerplate. (d) `'use client'` directive at top of file (line 1) — this is a Vite SPA, not Next.js. Pure slop indicator. (e) Local `Label` wrapper that does nothing but render a div — could just use `<div>`. |
| 5 | Responsive + a11y | 6 | `grid-cols-4` for date buttons — fine. `grid-cols-3` for time slots with `max-h-64 overflow-y-auto` (line 100). `aria-label` on continue button (line 149). **Gaps:** date buttons inside the date row don't announce "selected"/"not available" to AT; `data-testid` plumbing is solid but no `aria-pressed` on the toggle. No keyboard hint for the overflow-scroll slot list. |
| 6 | Trust + polish | 6 | "15-minute confirmation" + "Free cancellation up to X" build trust IF accurate. Pricing in `$` but app is PH-first — mismatch with `apps/memberry`'s peso convention. Cancellation policy only shown when `cancellationThresholdMinutes !== undefined` — good defensive check. |

**Module overall:** **6.5 / 10**.

**Top 3 findings:**
1. **P1 — currency mismatch.** `booking-widget.tsx:142` renders `$${price}`. Rest of memberry (dues `dashboard.tsx:259`, certs in PH locale) uses `₱`. Pull currency from `event.billingConfig.currency` and format properly.
2. **P1 — remove `'use client'`.** Vite app; the directive is meaningless slop from a Next.js training distribution. Delete `booking-widget.tsx:1`.
3. **P2 — hardcoded "30 minutes"** at line 138 should come from `selectedSlot.duration` or `event.duration`. Today every slot regardless of actual length displays 30 min.

---

## m21 — Billing

**Primary user:** Host/member onboarding a Stripe Connect account.
**Primary task:** Set up payment account → land back on dashboard.

**Surfaces:**
- `apps/memberry/src/features/billing/components/merchant-account-setup.tsx`
- `apps/memberry/src/routes/_authenticated/my/billing.tsx`

| # | Pillar | Score | Evidence |
|---|---|---|---|
| 1 | Visual hierarchy | 7 | Single column. Heading + sub → status card (one of 3 variants) → action row. Status card uses border-color + icon to telegraph state (`merchant-account-setup.tsx:117-180`). The transport-error fallback in the route (`billing.tsx:65-103`) is properly elevated. |
| 2 | State coverage | 8 | Best state coverage in batch alongside elections: loading skeleton (line 101-113), incomplete (133-155), complete (117-130), no account (158-178), transport-failed branch with Retry button + Skip (`billing.tsx:65-102`), stall-timeout fallback (line 18, 54-61, 65). 404 from API treated as "no account" not "error" — correct UX (`billing.tsx:34`). |
| 3 | Design-system | 5 | Heavy raw Tailwind divergence: `border-green-200 bg-green-50 text-green-900 text-green-700 text-green-600` (line 119-127), `border-amber-200 bg-amber-50 text-amber-900 text-amber-700 text-amber-600` (134-144). The success/warning palette is duplicated literally instead of using `var(--color-success)` / `var(--color-warning)` tokens that every other module uses. `text-muted-foreground` (line 106) vs `var(--color-muted)` elsewhere — two muted tokens in the same codebase. |
| 4 | AI-slop | 4 | (a) Hardcoded color palette repeated 3× (above) is a strong slop signal. (b) Extensive JSDoc with `@example` block (line 58-90) that nothing reads — looks like a boilerplate generator artifact. (c) "You can manage your account settings from the dashboard" (line 126) followed by no link to said dashboard. (d) Loading state inside component AND the route also reasons about loading (`billing.tsx:116`) — duplicated loading concern. (e) `cn` not imported; component uses raw className strings only — fine, but inconsistent with rest of app. |
| 5 | Responsive + a11y | 7 | `aria-hidden` on decorative icons (multiple). `aria-label` on action buttons (line 149, 173). `role="alert"` on transport error (`billing.tsx:74`). Single-column, `max-w-3xl` works on mobile. **Gap:** the green/amber status cards have no `role="status"` or `aria-live`. |
| 6 | Trust + polish | 7 | Excellent for trust: clear status, retry/skip option, stall timeout pattern (12s), 404-aware error handling. **Polish gap:** copy is slightly verbose — "Your payment account onboarding is incomplete. Started X. Complete the process to start accepting payments." could be 1 sentence. "Connect a Stripe account if you want to charge for your sessions." in the page header (`billing.tsx:70`) exposes the implementation (Stripe) directly. |

**Module overall:** **6.3 / 10**.

**Top 3 findings:**
1. **P0 — replace raw green/amber Tailwind with status tokens.** `merchant-account-setup.tsx:119-144` duplicates the success/warning palette literally. Use `var(--color-success-bg) / --color-success` and `var(--color-warning-bg) / --color-warning` — the tokens already exist (used in elections + dashboard). This is the single biggest design-system drift in the batch.
2. **P1 — page header leaks "Stripe"** (`billing.tsx:70`). Either rebrand as "Payment account" generically or own the integration in copywriting more deliberately.
3. **P2 — strip the dead JSDoc example block** at `merchant-account-setup.tsx:58-90`. The example references hooks that don't exist (`useMyMerchantAccount` is not actually exported in current SDK shape). Either delete or fix.

---

## Cross-batch observations

1. **Two status-color systems coexist.** Token-driven `var(--color-success-bg)` etc. is used in dashboard + elections + governance, but raw Tailwind `bg-emerald-100 / bg-green-50 / bg-amber-50 / bg-purple-100 / bg-orange-100` appears in `merchant-account-setup.tsx`, `election-list.tsx`, `election-detail.tsx`, `document-browser.tsx`. Pick one. The token system is already comprehensive — the raw-class usage is pure entropy.

2. **Two status enum casing conventions in elections.** `nominationsOpen` (election-list) vs `nominations_open` (election-detail). One file uses the wire shape, another the legacy. Will silently fail status-color lookup when components are composed together. P0 to unify.

3. **Modal/menu hand-rolled when `@monobase/ui` has primitives.** `voting-ballot.tsx:300-325` (confirm modal), `document-library.tsx:132-167` (dropdown). All bypass `Dialog`/`DropdownMenu`. Cost: no focus trap, no escape handler, no aria-modal — a11y debt across multiple modules.

4. **`any`-typing and snake/camel patching at the FE/SDK boundary.** Dashboard, election-detail, voting-ballot all carry `as any` + dual-key reads like `r.person_id ?? r.personId`. The SDK contract is the single source of truth; this slop indicates handlers are returning shapes the SDK types don't cover. Backend serialization should be fixed once, not re-patched per consumer.

5. **Currency inconsistency.** `₱` in dashboard/dues; `$` in booking. The product is PH-first per CLAUDE.md.

6. **AI-slop signatures detected:** `'use client'` in a Vite app, native `alert()` calls, dead JSDoc `@example` blocks referencing non-existent hooks, duplicated stats cards (Total + Showing), client-side merge of paginated queries to work around missing API params, "Submit" generic verbs.

7. **`/api/` prefix in raw fetches** — CLAUDE.md says no `/api` prefix; `dashboard.tsx` uses it 7×. Vite proxy strips it, so it works, but the codebase is split between conformant and non-conformant call sites.

---

## Per-module score summary

| Module | Score | Status |
|---|---|---|
| m11 Documents & Credentials | 6.2 / 10 | scored |
| m12 Elections & Governance | 6.5 / 10 | scored |
| m14 National Dashboard | 6.7 / 10 | scored |
| m19 Committee Management | — | no UI yet |
| m20 Booking | 6.5 / 10 | scored |
| m21 Billing | 6.3 / 10 | scored |

## Top P0/P1 across batch

1. **P0 — Election status enum unification.** Camel vs snake case in two files for the same data — broken status-color lookup risk. (m12)
2. **P0 — Replace `alert()` with sonner toast** in certificate-preview. CLAUDE convention violation. (m11)
3. **P0 — Status-color token enforcement.** Strip raw `bg-emerald/green/amber/purple/orange-X00` and use the existing `var(--color-success-bg)` / `--color-warning-bg)` / etc. tokens. Largest design-system drift, mostly in m21 + m11. (cross-batch)

**Report path:** `/Users/elad-mini/Desktop/memberry/docs/audits/UI-REVIEW-batch3.md`
