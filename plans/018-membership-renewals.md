# 018 — Renewals View (Slice 7b)

> Step-7 follow-on of the `apps/org` membership-management build.
> Design: [`docs/product/MEMBERSHIP_MANAGEMENT_UI.md`](../docs/product/MEMBERSHIP_MANAGEMENT_UI.md)
> Core function #2 (Renewals) + Net-new "Later: derive client-side" + Round-2 B (Due soon).
> Protocol + scope locks: [`plans/000-execution-standards.md`](./000-execution-standards.md).
> **Classification: FRONTEND-ONLY**, client-derived. No engine/spec/SDK change.

## Goal

A renewal-season worklist: "who do I chase to renew." Grouped by urgency — **Due soon** (active,
expiring within 30 days), **In grace**, **Lapsed** — each member tapping through to their detail
(where you renew / send a pay-link). Derived from `listRosterMembers`; no engine touch.

Distinct from the directory's chips: the directory's "Due" chip = `gracePeriod` status only; this
view adds the **active-but-expiring-soon** bucket (the actual "renew before you lapse" list).

## Persona audit (done)

Officer in renewal season. Entry: More → Renewals. Sees the three urgency groups (counts +
soonest first), taps a member → detail to act. Gaps: empty state ("Everyone's up to date");
role-403 friendly; epoch-null `duesExpiryDate` (transformer coerces null→1970) guarded out;
100-row cap noted honestly.

## Grounded facts (FE-only)

- `listRosterMembers` rows: `status` (active/gracePeriod/lapsed/expired/…), `duesExpiryDate`
  (Date; null coerced to epoch by the transformer — guard `getTime()<=0`), `name`, `memberNumber`,
  `id` (membershipId), `personId`. Handler shape `{ data, totalCount }`.
- Buckets: **lapsed** = status lapsed|expired; **grace** = status gracePeriod; **dueSoon** =
  status active AND `0 ≤ daysUntil(duesExpiryDate) ≤ 30`. Sort dueSoon by daysLeft asc.

## Tasks (vertical, FE-only)

1. **`use-renewals.ts`** — `listRosterMembers(all)` → map + bucket into `{ dueSoon, grace, lapsed }`
   (+ `total`/`shown` for the cap note); epoch-date guarded; status idle/loading/ready/empty/error.
2. **`Renewals.tsx`** — three labeled sections (Due soon / In grace / Lapsed) with counts; each a
   list of member rows (name + memberNumber + "Renews {date}" / "{n} days left", `StatusBadge`)
   that link to `/members/$membershipId`; calm empty state when all three are empty; Skeleton/
   Error (403 friendly). "Showing first N of M" note when the cap bites.
3. **Route `/renewals`** + a **More-page "Renewals" link** (new ui icon `RefreshCw`).
4. **Tests:** `use-renewals` (bucket derivation incl. dueSoon window + epoch guard + sort, drift
   `{data,totalCount}`); `Renewals` (sections + counts, rows link to detail, empty, 403); E2E —
   More → Renewals → the three buckets render with the right members; tap a member → detail.

## Scope locks honored

Engine/specs/SDK untouched. DESIGN.md: ≥48px taps, `StatusBadge`, mobile-first, no new dep, no new
abstraction (reuse the row/Link pattern). Drift guard: handler `{data,totalCount}` shape +
typecheck tests; epoch-date guard.

## Verification (step d)

`bun dev`; More → Renewals; active members expiring within 30d appear under Due soon (soonest
first), gracePeriod under In grace, lapsed/expired under Lapsed; tapping a member opens detail;
an all-current org shows the calm empty state. Gates: ui+org typecheck, full org unit + e2e,
build, lint:no-skips/shallow. Engine untouched.

## Out of scope

Server renewals endpoint (design "Later"); reminder cron/bulk-renew; ₱ amounts (status-level only).
