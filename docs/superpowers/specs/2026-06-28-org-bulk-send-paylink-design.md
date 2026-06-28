# apps/org — Bulk send-pay-link + back-link cleanup

Date: 2026-06-28 · Branch: `feat/org-bulk-send-paylink` · Target: v0.1.18.0

## Goal A — Bulk send-pay-link (Roster)

Officer selects N members, mints one oldest-dues pay-link per member, distributes
the links manually (until SMS / G3 lands). Engine `services/api-ts` is FROZEN —
this is pure new `apps/org` UI over existing endpoints (`listDuesInvoices`,
`sendPaymentLink`), same SDK seams as the single-send path (`use-send-link.ts`).

### Interaction (approved)

Two modes on the roster, never both at once (DESIGN.md: one primary task per
screen; older-dentist accessibility — no two tap targets per row):

- **Browse mode (default):** per-row `Send pay-link` link → existing single
  custom-amount path (`/members/:id/send`). A `Select` button at top enters
  select mode.
- **Select mode:** checkbox per row (`min-h-tap`, labeled) + a `Select all
  (filtered)` checkbox; per-row Send-link **hidden**; a sticky bottom bar shows
  `Send links to N selected` (hidden when N=0); `Cancel` exits back to browse.
- Tapping `Send links to N selected` → **`ConfirmDialog`** first (money gate,
  DESIGN.md "confirm at every money step"): *"Send each of N members a pay-link
  for their oldest outstanding dues?"* Confirm starts the loop.
- On send → roster swaps to a **replace-screen results panel** (one primary
  task): header `Sending N links / Minting X of N…`, one row per member filling
  in live, `Back to roster` when done.

Selection state = `Set<membershipId>`. Search filtering drops filtered-out rows
from the selection; `Select all` selects only the currently-filtered rows.

### Engine facts (frozen, verified)

- `sendPaymentLink` mints **one** link per call → loop **sequentially** with progress.
- `DuesInvoice`: `{ id, membershipId, periodStart: Date, totalAmount: bigint,
  status: 'generated'|'sent'|'paid'|'overdue'|'cancelled'|'writtenOff', ... }`.
- "Oldest outstanding" = min `periodStart` among status ∈ `[generated, sent,
  overdue]`. Tie-break: `createdAt`. None → skip member (`no-dues`).
- `sendPaymentLink({ path:{ organizationId }, body:{ personId,
  amount: BigInt(Number(totalAmount)), invoiceId } })` → 201 `{ paymentUrl,
  token, expiresAt }`. Non-201 → error (reuse `use-send-link.ts` message logic).

### Components

- **`features/roster/use-bulk-send.ts`** — orchestrator hook.
  - In: `orgId: string`, `members: {membershipId, personId, name}[]` (the selected set).
  - Out: `results: Record<membershipId, BulkResult>`, `progress:{done,total}`,
    `running: boolean`, `start(): void`.
  - `BulkResult = { status:'pending'|'minting'|'sent'|'no-dues'|'error', url?:string, message?:string }`.
  - Sequential `for` loop: fetch invoices → pick oldest → mint → record result.
  - ponytail: no extracted shared SDK abstraction — two call sites, copy the ~6
    boundary lines from `use-send-link.ts` (BigInt coerce, `{data,error,response}`
    201 check, 403/fallback message).
- **`features/roster/BulkResults.tsx`** — presentational replace-screen panel.
  - Props: `members`, `results`, `progress`, `onBack`. Per row: name + a
    **`StatusBadge`** (text+color, never icon/color-only) for each status —
    sent / "No dues" / "Failed" / "Minting…" — plus (sent → url + `Copy` button
    via `navigator.clipboard` + `toast`) / (error → message text).
  - Progress header `aria-live="polite"` (`Minting X of N…`); on mount move focus
    to the heading, on `onBack` the container restores focus to the roster heading.
  - Done-summary tally line: `N sent · N failed · N no dues` (scannable partial
    failure). If zero sent → explicit `No links sent — no outstanding dues.`
  - `Copy all sent links` button (multi-line clipboard) — eases manual
    distribution pre-G3 and reduces strand risk. Manual-distribution note line.
    `Back to roster` button. (Tokens are single-use + the engine settle path is
    invoice-lock-guarded against double-charge, so Back needs no extra modal.)
- **`features/roster/Roster.tsx`** (changed) — `RosterView` gains select mode:
  `Select`/`Cancel` toggle, checkboxes, `Select all`, sticky bar, and renders
  `BulkResults` (driven by `use-bulk-send`) once send starts. Container wires
  `orgId`. Single-send `linkFor` path unchanged.
  - Select mode shows a persistent header/instruction + always-visible `Cancel`
    even at N=0 (so it never reads as a dead screen). Whole row toggles the
    checkbox (bigger target than the box alone). `Select all (filtered)` renders
    an indeterminate state when some-but-not-all filtered rows are picked, with a
    live selected-count beside it.
  - Sticky bottom bar adds `pb-[env(safe-area-inset-bottom)]` (over base padding)
    so iOS PWA home-indicator / browser chrome never eats the 48px target.

### Tests (TDD, real behavior not selectors)

- `use-bulk-send.test.tsx` — oldest-by-periodStart pick; no-dues skip; sequential
  order (mock asserts calls don't overlap / run in order); 201→sent, non-201→error;
  BigInt coercion at body seam; progress increments.
- `Roster.test.tsx` (extend) — Select toggle shows checkboxes + hides per-row
  link; Select-all picks filtered only + indeterminate state; search drops
  selection; sticky bar count; `Send` opens ConfirmDialog (loop does NOT start
  until confirmed); confirm swaps to results; Cancel exits.
- `BulkResults.test.tsx` — renders each StatusBadge status variant; Copy copies
  url; Copy-all copies every sent url; tally counts; all-no-dues message; Back
  fires `onBack`.

## Goal B — Back-link cleanup

AppHeader `OfficerNav` (`__root.tsx`) is the single nav on every authed screen.
Remove the now-redundant per-page back-links:

- `routes/events.tsx` — "Back to dashboard" `Link`.
- `routes/announcements.tsx` — "Back to dashboard" `Link`.
- `routes/payment-settings.tsx` — "Back to dashboard" `Link`.
- `features/roster-import/ImportRoster.tsx:176` — "Roster" back-link.
- **Keep** `ImportRoster.tsx:60` "View roster" — post-import success CTA, not nav.

Drop now-unused `Link` imports where applicable. Adjust/keep tests that assert the
removed links.

## Out of scope (YAGNI)

Parallel minting (engine serial); retry-failed button (officer re-selects);
SMS auto-send (G3); bulk custom-amount (bulk = oldest-dues only, single-send
covers custom).

## Verify / ship

`bun run typecheck` (all workspaces) + `cd apps/org && bunx vitest run`.
Then `/ship` → third-digit bump → **v0.1.18.0** (repo squash-merges PRs).
