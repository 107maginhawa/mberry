# 017 — CSV Export (Slice 7a)

> Step-7 follow-on of the `apps/org` membership-management build.
> Design: [`docs/product/MEMBERSHIP_MANAGEMENT_UI.md`](../docs/product/MEMBERSHIP_MANAGEMENT_UI.md) Round-2 B
> ("Export / report: CSV of name, since, status, renewal date, paid, due") + Net-new "v1 reuse".
> Protocol + scope locks: [`plans/000-execution-standards.md`](./000-execution-standards.md).
> **Classification: FRONTEND-ONLY.** No engine/spec/SDK change.

## Decision (recon)

Build the CSV **client-side from `listRosterMembers`** — NOT `generateDuesReport`. The report
endpoint is TREASURER/PRESIDENT-gated and its rows carry only `personId` (no name/status/renewal).
The roster row already has every column the design wants and is readable by any officer.

## Goal

Officer downloads a members CSV (name, member #, since, status, renewal, dues) for the
regional/national body. One tap on the More page → file downloads. No new dependency.

## Persona audit (done)

Officer (any role) needs a roster+dues report. Entry: More → "Export members (CSV)". Action:
click → CSV downloads. Gaps: empty roster → friendly "no members to export"; **CSV-injection
safety** (cells starting with `= + - @` prefixed with `'` — member-entered names cross into a
spreadsheet, a trust boundary); proper RFC-4180 quoting (commas/quotes/newlines); the roster
pageSize=100 cap → note "first 100" if exceeded.

## Grounded facts (FE-only)

- `listRosterMembers` (`GET /association/member/roster`, handler shape `{ data, totalCount }`)
  rows: `name`/`firstName`/`lastName`, `memberNumber`, `status`, `joinedAt` (Date), `duesExpiryDate`
  (Date), `categoryName` (tier), `duesInvoiceStatus`. Unpaid = `status==='pendingPayment'` OR
  `duesInvoiceStatus ∈ {generated,sent,overdue}`.
- No CSV stringify or download helper exists (`roster-import/csv.ts` only parses). Build a tiny
  client-side stringify + `Blob` + anchor download — no lib.

## Tasks (vertical, FE-only)

1. **`members-csv.ts`** (pure + IO split):
   - `membersToCsv(rows): string` — header `Name,Member number,Member since,Status,Renews,Dues`
     + a row per member; RFC-4180 quoting; **injection-safe** cell escaping (`'`-prefix leading
     `= + - @ \t \r`). Friendly status + `Paid`/`Unpaid` dues column; dates as `YYYY-MM-DD`.
   - `downloadCsv(filename, csv)` — `Blob([csv], {type:'text/csv'})` + object-URL anchor click +
     revoke. (`ponytail:` tiny IO, no lib.)
2. **`use-export-members.ts`** — `{ exportCsv, isExporting }`: fetch the full roster
   (`listRosterMembers` all, pageSize 100), map rows, `membersToCsv` → `downloadCsv`; toast on
   empty / 403 / error. Self-contained (the More page doesn't preload the roster).
3. **More page**: add an "Export members (CSV)" action row (matches the existing tool rows, ≥48px,
   labeled icon). Button, not a link (it's an action).
4. **Tests:** `membersToCsv` (columns, quoting a name with a comma + quote, **injection cell
   `=SUM(...)` → `'=SUM(...)`**, empty → header only, unpaid derivation, date format); the export
   hook (fetches + builds + triggers download; empty → toast, 403 → friendly); E2E — More →
   Export members → a CSV download fires with the expected filename/header.

## Scope locks honored

Engine/specs/SDK untouched. DESIGN.md: ≥48px tap, labeled icon, mobile-first, no new dep, no new
abstraction. Drift guard: anchor to handler `{ data, totalCount }` row shape + typecheck tests.

## Verification (step d)

`bun dev`; More → Export members (CSV) → a CSV downloads with the right header + a row per member;
a name containing a comma stays one column; a name starting with `=` is neutralised; empty org →
friendly toast. Gates: ui+org typecheck, full org unit + e2e, build, lint:no-skips/shallow.
