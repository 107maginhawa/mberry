# Membership-Management UI — `apps/org` Design Direction

> **Status:** Design direction approved · 2026-06-30
> **Scope:** Officer app (`apps/org`) membership/CRM layer · cross-references `apps/member`
> **Source of truth for:** member directory, member detail, events + check-in, Certificate of
> Good Standing, and how dues/renewals surface inside the officer experience.
> **Sits with:** [`WORKFLOW_MAP.md`](./WORKFLOW_MAP.md) (membership = module **M05**),
> [`/PRODUCT.md`](../../PRODUCT.md), [`/DESIGN.md`](../../DESIGN.md).
>
> **How to extend:** this doc is durable. New membership features append a screen/flow section
> here; each build slice gets a numbered tactical plan in `plans/0NN-membership-<slice>.md` that
> links back. The doc grows; plans stay per-slice.

## Context

`apps/org` today is a set of single-purpose screens (roster, dues, events, announcements,
payment-settings) with **no nav** — each one stands alone. The officer (Dr. Olive: older
dentist, low tech tolerance, runs her chapter ~once a year) wants it to *feel like a
membership app*: open it, see her members, click one, see their history and membership-since
date, track who paid. Mental model is **people-first — "I manage members,"** not "I run a
finance dashboard."

This doc is the design direction + wireframes, grounded in what the frozen engine actually
exposes. It includes a feasibility verdict on Certificate of Good Standing and the list of
net-new additive endpoints needed.

The three jobs the app must serve well: **manage members**, **post events (incl. paid + track
payments)**, **track payments**. Lean discipline applies: intuitive over feature-rich, one
primary task per screen, reuse `packages/ui` + DESIGN.md, don't reinvent or overdo.

---

## Core functions (the app's job)

| # | Function | State today |
|---|----------|-------------|
| 1 | **Dues collection** (login-free pay-link, PayMongo) | Live |
| 2 | **Renewals** (once-a-year cycle, who's due/lapsed) | Data derivable, no UI |
| 3 | **Roster import** (CSV → members) | Live (`/import`) |
| 4 | **Member directory** (list + paid/unpaid + status) | NEW — this work |
| 5 | **Member profile** (history, since-date, actions) | NEW — this work |
| 6 | **Events** (post free/paid, track) | Free live; paid = gap |
| 7 | **Event check-in / paid verification** | NEW — this work |
| 8 | **Certificate of Good Standing** | NEW — feasible, mostly FE |
| 9 | Announcements, payment-settings | Live (secondary) |

---

## Information architecture: people-first, one nav

Today there's no nav (`apps/org` has no `AppHeader`). To become a "membership app" it needs a
simple, thumb-reachable structure. **Bottom tab bar, 3 tabs, icon + text label** (DESIGN.md
forbids icon-only):

```
[ 👥 Members ] [ 📅 Events ] [ ⚙ More ]
```

- **Members** = home (directory). Dues/renewals live *inside* member rows + member detail —
  money is a property of a member, never a separate silo.
- **Events** = list + create + per-event attendee/check-in.
- **More** = roster import, announcements, payment-settings, sign-out (low-frequency stuff).

This collapses the current flat route set under one coherent shell. Reuse `AppHeader`
(`packages/ui`) for the top bar; add a small bottom-tab component (see gaps).

---

## Screen 1 — MEMBERS (home / directory)

**IA — what shows, and where it comes from**
- Source: `listRosterMembers` → `GET /association/member/roster`
  (`services/api-ts/src/handlers/member/membership/listRosterMembers.ts`). One call returns:
  `name`, `email`, `status`, `tierId`, `categoryName`, `duesExpiryDate`, `joinedAt`,
  `startDate`, `duesInvoiceStatus`, `creditsEarned`, `trainingCompliant`. Paginated
  (`page`/`pageSize`, `totalCount`), server-side `search` + `status` + `duesStatus` filters.
- **Paid/unpaid** is derived, not a flag: `status='pendingPayment'` or
  `duesInvoiceStatus ∈ {generated,sent,overdue}` → **Unpaid**; `status='active'` with no open
  invoice → **Paid/current**; `gracePeriod` → due soon; `lapsed` → lapsed.
- **Thin health strip** (one line — NOT a dashboard): active count · ₱ outstanding · # due to
  renew. Counts come from the roster page + a light client tally; ₱ outstanding ideally from
  `generateDuesReport` (type=aging) — optional v1.

**Inspiration (membership/CRM track)**
- **Stripe Dashboard customer list** → row = identity left, status + balance right; top metric
  strip is thin, not a panel.
- **Linear / Notion list** → fast filter chips (All / Unpaid / Lapsed), calm density.

**Wireframe (mobile, primary)**
```
┌─────────────────────────────┐
│ Olive Dental Chapter     ⚙  │  AppHeader
├─────────────────────────────┤
│ 142 active · ₱48k due · 12 ↻ │  thin health strip (1 line)
├─────────────────────────────┤
│ 🔍 Search members           │  Input (min-h-tap 48)
│ [All][Unpaid][Lapsed][Due]  │  filter chips
├─────────────────────────────┤
│ Maria Santos          ●Paid │  list-item: name + StatusBadge
│ Member since 2019 · Gold    │  one meta line of present facts
├─────────────────────────────┤
│ Jose Cruz           ●Unpaid │
│ Since 2021 · ₱1,500 due     │
├─────────────────────────────┤
│ Ana Reyes          ●Lapsed  │
│ Since 2018 · expired Mar    │
└─────────────────────────────┘
[ 👥 Members ][ 📅 Events ][ ⚙ More ]
```
Desktop reflow: list-item rows → `Table` (sortable name/status/since/dues). Never
horizontal-scroll; container-query swap per DESIGN.md.

**packages/ui mapping**: `AppHeader`, `Input`, `StatusBadge` (statuses exist:
active/grace/lapsed/pending/suspended), list-item card pattern (from `roster/Roster.tsx`),
`Skeleton`/`EmptyState`/`ErrorState`, `centavosToPhp`. Filter chips = `Toggle`/`ToggleGroup`.

**Gaps**: bottom-tab-bar component (not in ui); health-strip ₱-outstanding wants
`generateDuesReport` aggregation (else omit ₱ in v1).

---

## Screen 2 — MEMBER DETAIL

**IA — what shows, and where it comes from**
- Profile header: `firstName/lastName`, `memberNumber`, `joinedAt` ("Member since"), `tier`,
  `status` — all on the roster record (avatar optional; photo only if present).
- Standing + outstanding dues: reuse the member-app `StandingHero` logic — status badge +
  outstanding amount + invoice count.
- **Payment history timeline** (dues): `listDuesPayments`
  (`GET /association/member/dues-payments`, filter `personId`) → `receiptNumber`, `amount`,
  `currency`, `paymentMethod` (online/cash/check/bankTransfer/gcash), `status`, `paidAt`,
  `membershipExtendedTo`. Richer combined view: `getDuesMemberSummary`
  (invoices + payments + balance + timeline) — **position-gated to TREASURER/PRESIDENT**
  (`getDuesMemberSummary.ts`); a Secretary/Society-Officer may 403. Use `listDuesPayments`
  (officer-visible) as the baseline; upgrade to summary when role allows.
- Quick actions: **Send pay-link** (existing `members/$id/send`), **Record payment** (manual
  cash/bank — existing dues path), **Renew** (`renewMembership` — TypeSpec defined, verify
  handler wired).
- Certificate of Good Standing button → see verdict below.

**Inspiration (membership/CRM track)**
- **Stripe customer detail** → header summary + chronological payment timeline + quick actions
  (on mobile: a button row under the header).
- **A member-CRM profile** → "since" date + lifecycle status front and center.

**Wireframe (mobile)**
```
┌─────────────────────────────┐
│ ← Maria Santos              │
│ ┌──┐ Maria Santos    ●Paid  │  Avatar + name + StatusBadge
│ │MS│ #00142 · Gold tier     │
│ └──┘ Member since Jan 2019  │  joinedAt
├─────────────────────────────┤
│  In good standing           │  StandingHero-style band
│  Renews 12 Jan 2026         │  duesExpiryDate
├─────────────────────────────┤
│ [Send pay-link][Record pay] │  action buttons (≥48px)
│ [Renew] [Certificate ▸]     │
├─────────────────────────────┤
│ Payment history             │
│ ● ₱1,500  Paid · GCash      │  timeline (listDuesPayments)
│   12 Jan 2025 · Receipt #88 │
│ ● ₱1,500  Paid · Cash       │
│   10 Jan 2024 · Receipt #61 │
└─────────────────────────────┘
```
Desktop reflow: two-column (summary + actions left, timeline right).

**packages/ui mapping**: `Avatar`, `StatusBadge`, `Card`, `Button`, `centavosToPhp`,
`Skeleton`/`Error`/`Empty`. **Build a small Timeline** (vertical `<ol>` + left border-line) —
not in `packages/ui`.

**Gaps**: Timeline component (build minimal, reusable for member + event).
`getDuesMemberSummary` role-gating (fall back to `listDuesPayments`). **Event payments are NOT
in this dues timeline** (see Screen 4 / cross-cutting fork) — v1 shows dues only; unifying is
net-new.

---

## Screen 3 — EVENTS (list + post)

**IA — what shows, and where it comes from**
- List: `listEvents` → `GET /association/{organizationId}/events` (officer sees all statuses
  incl. `draft`). Fields: `title`, `eventType`, `startDate`/`endDate`, `location`,
  `registrationFee` (bigint PHP cents), `currency`, `status`
  (draft/published/cancelled/completed), `capacity`.
- Create: `createEvent` (`POST /association/events`) → defaults to **draft**. Publish is a
  **separate step**: `publishEvent` (`POST .../{id}/publish`) — and it **blocks paid-event
  publish unless the org has an active Stripe merchant account** (`publishEvent.ts` [S6]).
- The current `/events` screen already does create + publish — extend, don't rebuild.

**Inspiration (events track)**
- **Luma** → dead-simple create-event form (title, date, location, fee) + clear Draft → Publish.
- **Eventbrite organizer** → event card shows date, registered count, paid/free pill.

**Wireframe (mobile)**
```
┌─────────────────────────────┐
│ Events                  + New│
│ [Upcoming] [Past] [Drafts]  │  status filter
├─────────────────────────────┤
│ Annual Assembly      ●Live  │  StatusBadge
│ 14 Mar · ₱500 · 38 going    │  date · fee · count
├─────────────────────────────┤
│ Free CPD Webinar     ●Live  │
│ 02 Apr · Free · 12 going    │
├─────────────────────────────┤
│ Fellowship Night    ●Draft  │
│ 20 Apr · ₱800 · not posted  │
└─────────────────────────────┘
[ 👥 Members ][ 📅 Events ][ ⚙ More ]
```

**packages/ui mapping**: reuse `events/EventsList.tsx` + `CreateEventForm.tsx`, `StatusBadge`,
`Button`, `Calendar` (date), `centavosToPhp`.

**Gaps**: **Paid events run on Stripe, not PayMongo** — the strategic mismatch (see below).
"38 going" count needs a registration tally (from `listCustomEventRegistrations` `totalCount`).

---

## Screen 4 — EVENT DETAIL (attendee list + door check-in / paid verification)

**IA — what shows, and where it comes from**
- Attendees: `listCustomEventRegistrations`
  (`GET /association/event-lifecycle/{eventId}/registrations`) → person `firstName`/`lastName`,
  registration `status` (confirmed/waitlisted/cancelled/refunded/noShow), **`paidAt`** (NULL =
  unpaid; set when payment settles). The door-verification signal: paid event +
  `paidAt != null` → green; else → "payment not confirmed."
- Check-in: `searchCheckIns` (`GET /association/events/checkins`) reads existing check-ins;
  recording a check-in (`POST .../checkin`) handler exists in validators but **endpoint name
  needs confirming** before wiring.

**Inspiration (events track)**
- **Eventbrite Organizer check-in app** → searchable guest list, big tap row, instant
  paid/checked status, one-tap check-in.
- **Luma guest list** → paid badge + RSVP status inline.

**Wireframe (mobile — at the door)**
```
┌─────────────────────────────┐
│ ← Annual Assembly · 14 Mar  │
│ 38 confirmed · 35 paid · 3 ✗ │  summary (see gap)
├─────────────────────────────┤
│ 🔍 Search attendee          │
├─────────────────────────────┤
│ Maria Santos     ●Paid  [✓] │  paidAt set → green · check-in btn
│ Jose Cruz      ●Unpaid  [!] │  paidAt null → warn at door
│ Ana Reyes    ●Checked-in    │  already checked in
└─────────────────────────────┘
```

**packages/ui mapping**: list-item pattern, `StatusBadge`, `Input` search, `Button`,
`ConfirmDialog` (mark paid / check in).

**Gaps**:
- **Per-attendee paid status display = available now** (`registration.paidAt`) — not a gap.
- **Door cash collection** ("mark paid" for walk-up cash) = net-new
  `PATCH .../registrations/{id}/mark-paid`.
- **Attendee summary counts** (confirmed/paid/checked-in) = net-new
  `GET .../registrations/summary`, or tally client-side in v1.
- Confirm the **record-check-in** endpoint name before building.

---

## Certificate of Good Standing — VERDICT: KEEP (mostly front-end)

Feasible and cheap because the pieces already exist:
1. **Certificate API exists**: `GET /association/member/certificates`,
   `GET /association/member/certificates/{id}`, `POST /certificates/bulk-issue` (officer-side).
2. **QR / verifiable-card pattern exists**: member digital-card
   (`apps/member/.../IdCardView.tsx`, `useIdCard`) renders a card + QR via `qrcode.react`,
   verified by `verifyCredentialPublic`.
3. **"Good standing" is already computed**: `StandingHero` derives it from membership status +
   outstanding invoices.

**Plan**: officer issues from member detail → reuse card layout + `StatusBadge` + QR. **v1 must
be shareable, not screen-only** (print / PDF / email) — a member needs it for license renewal /
hospital credentialing (see Round-2 review #5). Ship after directory + detail are live (depends
on member detail existing).

---

## Round-2 review — gaps folded in (UX/UI expert + officer-user lenses)

Two review passes (senior designer + Dr. Olive as the real user) converged. Sorted by what they
change. **Trust-killers are non-negotiable v1**; the rest is sequenced or explicitly deferred.
Added flows reuse existing engine paths and `packages/ui`, not new abstractions.

### A. Must-fix in v1 (or the app loses trust / can't do its core job)

1. **Add ONE member** (mid-year join). No single-add today; forcing a CSV on a phone = abandon.
   Reuse `importRosterMembers` with a one-row payload, or wire a small create-member form
   (verify a create-membership handler exists first). → Members screen, `+ Add member`.
2. **Bulk pay-link / reminder on the directory** (the renewal-season grind). The current app
   already bulk-sends pay-links — it MUST survive the new IA as a Members toolbar:
   `Select → Send pay-link to N`. One-by-one for 40 unpaid members is a dealbreaker.
3. **Record cash / GCash payment + confirmation + correction.** Money is collected offline
   (cash at meetings, GCash to a personal number). The `Record payment` modal must: explicit
   **method dropdown — Cash / GCash / Check / Bank transfer** (engine `paymentMethod` enum has
   these; do NOT bury GCash under "Online"), amount + receipt #, a **confirmation step**
   (DESIGN.md mandates it), and an **edit/void** path (mis-typed ₱5,000 vs ₱500, or a
   duplicate). Without undo she fears corrupting data and reverts to a spreadsheet.
4. **First-run / empty state.** Day-one she imports 200 members with zero payment history — all
   `active`, none "paid this cycle." The directory must show this as a distinct, calm state
   ("Roster imported · no dues collected yet · Send pay-links"), not 200 scary "unpaid" rows
   that read as a broken import.
5. **Certificate must be shareable, not screen-only.** A QR on her phone is useless at a
   credentialing desk. v1 needs at least **print / PDF download / email**.
6. **Paid-event Stripe limitation surfaced in the UI, before she sets a fee.** Today
   `publishEvent` silently blocks paid publish without a Stripe merchant account, while her rail
   is PayMongo. The create-event form must warn at the fee field ("Paid events need card
   setup — PayMongo coming soon"), not fail at publish. Until paid-events-on-PayMongo lands,
   **free events are fully supported; paid is gated + honest.**
7. **Confirmation dialogs at every money step** shown in the flows (Send pay-link, Record
   payment, Renew, Mark-paid) with step indicators ("Step 2 of 3"). DESIGN.md law.
8. **Graceful role-gating.** `getDuesMemberSummary` is TREASURER/PRESIDENT-only; a Secretary
   opening member detail must see a clean reduced view (payments via `listDuesPayments`, summary
   hidden with a plain note) — never a raw 403 that reads as "broken."

### B. v1.x follow-ons (real value, fast-follow, not launch-blocking)

- **Walk-up at the door**: quick-register + collect cash for someone not pre-registered. Pairs
  with the `mark-paid` endpoint below.
- **Door no-show + count summary**: mark `noShow`; show `38 confirmed · 35 paid · 3 ✗` header
  (tally client-side until the summary endpoint exists).
- **Export / report**: CSV of (name, since, status, renewal date, paid, due) for the
  regional/national body — back `generateDuesReport` (already TypeSpec-defined) with a download.
- **"Due soon" filter + grace-period highlighting**: amber rows for members in grace, a
  `Due soon` chip matching the health-strip renewal count.
- **Timeline pagination**: a 20-year member's history shows last ~3 years + "Earlier."
- **Timezone on event dates** (e.g. "14 Mar, 10am PHT").

### C. Deferred / out-of-scope by lock (named, not silently dropped)

- **Offline roster + offline check-in.** Reviewers (rightly) want it for spotty PH venues — but
  CLAUDE.md locks **PWA online-only** for the lean launch. v1 must at least handle a failed
  check-in/record POST gracefully (retry, pending state) rather than silent failure. Full
  offline = post-PMF.
- **Per-member notes, QR-scan check-in, event attendance history on the member** — CRM polish,
  not core to the money/membership wedge. Backlog.

---

## Net-new additive endpoints (frozen-engine-safe)

| Priority | Endpoint / work | Why |
|----------|-----------------|-----|
| v1 verify | single create-member (or reuse `importRosterMembers` one-row) | "Add one member" mid-year |
| v1 verify | record-manual-payment path + **void/edit** | cash/GCash recording + correction (trust-killer) |
| v1 reuse | `generateDuesReport` → CSV download | regional/national reporting |
| **Strategic** | Paid-event collection on **PayMongo** (mirror the dues pay-link) | engine wires paid events to **Stripe**; lean rail is PayMongo. Until wired: free events ship, paid gated + honest |
| v1.x | `PATCH .../registrations/{id}/mark-paid` | walk-up cash at the door |
| v1.x | `GET .../events/{id}/registrations/summary` | attendee counts without N+1 |
| Verify | record-check-in endpoint name | validator exists; confirm route before wiring |
| Later | `GET .../renewals` (due / grace / lapsing) | v1 derives client-side from `duesExpiryDate + gracePeriodDays` |
| Later | unified member payment history (dues + event payments) | event payments live on `event_registrations.paidAt` (Stripe), separate from `dues_payments`; true merge is net-new |

---

## Cross-cutting fork: paid events

The engine's paid-event rail is **legacy Stripe** (`registerAndPayForEvent` + Stripe webhook;
`publishEvent` blocks paid publish without a Stripe merchant account), but the lean strategy
collects through each org's **PayMongo** account. So "paid events, trackable in member history"
can't fully land on the current rail.

**Recommendation**: ship **free events fully + paid-events-gated-with-an-honest-message** now;
treat **paid-events-on-PayMongo** as a follow-on slice (it mirrors the already-built dues
pay-link). Membership/CRM value (directory, detail, standing, free events, door check-in) lands
first; money-rail unification second.

---

## Design discipline

DESIGN.md constraints are folded into every wireframe (18px base, ≥48px tap targets, labeled
icons, status = text+color via `StatusBadge`, single-column mobile-first, present-facts-only
meta lines, no `—` placeholders). Run **`/impeccable`** during implementation, per screen, once
each is rendered in the browser, then fold fixes back.

---

## Build sequence (people-first, value-first, review-hardened)

1. **Nav shell** — `AppHeader` + bottom tab bar (Members / Events / More); move existing routes
   under it; **sign-out to the header**, roster import surfaced (not buried).
2. **Members directory** (Screen 1) — FE over `listRosterMembers`; thin health strip; filter
   chips incl. `Due soon`; **first-run empty state**; **`+ Add member`**; **bulk select →
   send pay-link** (preserve current capability).
3. **Member detail** (Screen 2) — profile + standing + `listDuesPayments` timeline (paginated) +
   **Record payment modal (method dropdown + confirm + void/edit)** + send-pay-link + renew;
   graceful role-gated summary. Build the minimal `Timeline`.
4. **Certificate of Good Standing** — card + QR over existing certificate API **+ print/PDF**.
5. **Event detail / check-in** (Screen 4) — attendee list + `paidAt` verification + no-show +
   client-side count summary + **graceful POST-failure retry**; confirm check-in endpoint.
6. **Events polish** (Screen 3) — extend `/events`: counts, filters, **paid-event fee warning**.
7. **Follow-on**: paid-events-on-PayMongo, walk-up door charge, `mark-paid` + summary endpoints,
   CSV export, renewals endpoint.

Each slice follows the project skill chain (`/typespec` only where a net-new endpoint is needed
→ `/handler` → `/test-api` → `/frontend-design` on `packages/ui` → `/module-review` →
`/pre-commit` → `/commit`). Steps 1–4 are mostly additive FE over **already-frozen** endpoints;
the record-payment void/edit + create-member need handler verification first.

---

## Verification (per slice, end-to-end)

- **Directory**: `cd apps/org && bun dev`; sign in as officer; `/members` lists real roster;
  `Unpaid` filter matches `status=pendingPayment` + open `duesInvoiceStatus`; freshly-imported
  org shows the first-run state; `+ Add member` creates one; bulk-select sends N pay-links.
- **Detail**: since-date = `joinedAt`; timeline rows = `listDuesPayments` for that `personId`,
  money via `centavosToPhp` (no ₱NaN); Record-payment modal writes Cash/GCash with a confirm
  step; void reverses it; Secretary role sees the reduced view, not a 403.
- **Event check-in**: paid event → `paidAt` set ⇒ ●Paid green, null ⇒ ●Unpaid; check-in writes;
  a forced POST failure shows retry, not silent loss.
- **Certificate**: issue from member detail → card + QR verify via `verifyCredentialPublic`;
  print/PDF produces a shareable copy.
- **Engine untouched**: `cd services/api-ts && bun test` green for additive-FE steps; any
  net-new endpoint adds RED→GREEN tests + SDK regen (`bun run --filter @monobase/sdk-ts
  generate`) before contract gates.
- Drift guard: anchor mocks to real **handler** shapes, not generated SDK types; add typecheck
  test files. (See the lean-launch CI gotchas: generated SDK types drift from frozen handlers.)
