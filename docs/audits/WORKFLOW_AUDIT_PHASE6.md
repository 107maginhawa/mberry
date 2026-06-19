# Phase 6 — Close the Genuine Workflow Gaps (Execution Reference)

The systematic cleanup (Phases 0–5) is done. Baseline is **A=0, B=41, C=44**.
This file is the ordered worklist for the remaining real coverage: verify the
leaf-referenced routes, then write new live-stack E2E specs for the genuine gaps,
P0 first. The gate prevents regression while this proceeds.

## Ground rules (read once)

- **Verify before writing.** For every leaf-referenced item, READ the candidate
  spec first — a flow is only "covered" if a spec performs its CORE action
  (navigate + assert real data). A dialog that opens but never submits, or a
  read-only smoke, does NOT count. (This rigor caught WF-077 and a P0 bug.)
- **Tag, don't duplicate.** If a real covering spec exists, add a `// WF-NNN —
  <desc>` comment (Matrix B greps the tag). Only write a new spec when none does.
- **Test depth (mandatory).** New specs assert REAL data from the API, not
  headings. Every network call on the success path must succeed. For anything
  promoted to `// @journey-firewall`, satisfy all 4 DoD clauses (see
  `CONTRIBUTING.md` / `journey-dod-matrix.md`): no silent error surface; assert
  goal state not existence; assert every step; independent read of durable state.
- **Per-batch loop:** verify → tag/write → `bun run audit:workflows` →
  `bun scripts/audit/coverage-matrix.ts --gate --update-baseline` → commit → push
  to PR #12. One batch per commit. Never let the gate regress.

## Preflight (the executor must read these first)

- E2E helpers: `apps/memberry/tests/e2e/helpers/` — `test-fixture.ts`
  (`test.use({ authRole: 'treasurer'|'officer'|'member'|'admin' })`), `auth.ts`
  (`signInAsOfficer`/`signInAsMember`/`signInAsAdmin`/`signInAndNavigate`),
  `real-flow.ts` (`captureRouteHydration`, `captureAnyApiSuccess`),
  `independent-read.ts`. Admin specs use `apps/admin/tests/e2e/helpers/`.
- Seed org: `ed8e3a96-8126-4341-be42-e6eb7940c562` (slug `pda-metro-manila`).
- Live stack: API on 7213, memberry on 3004, admin on 3003. DB via `docker compose`.
  Playwright pinned **1.58.2** (1.59 breaks `test.describe`).
- Run one spec: `cd apps/memberry && bunx playwright test <file> --workers=1 --reporter=line`.
- Read the route component before writing its spec — know what data/els render.
- Backend-shaped flows (webhooks) get **backend integration tests** (mirror
  `services/api-ts/src/handlers/email/repos/suppression.repo.integration.test.ts`),
  not e2e — and are exempt from Matrix B (see Batch 8).

---

## Batch 1 — Verify the 27 leaf-referenced routes (cheap; mostly tagging)

Each likely has link-click / dynamic-id navigation the literal-path matcher
misses. Verify each; tag the covered ones, demote genuine gaps into the relevant
write-batch below. Group reads by area for efficiency. Routes:

`/my/schedule` · `/my/calendar` · `/my/surveys/$surveyId` ·
`/my/bookings/host.$personId(.$slotId)` · `/org/$orgSlug/elections/$electionId/` ·
`/org/$orgSlug/events/$eventId` · `/org/$orgSlug/documents/$documentId` ·
`officer/compliance` · `officer/communications/analytics` ·
`officer/finances/funds` · `officer/finances/members(/$memberId)` ·
`officer/finances/invoices/$invoiceId` · `officer/documents/$documentId` ·
`officer/surveys/$surveyId` · `officer/training/$trainingId/attendance` ·
`officer/dues/member.$memberId` · `officer/dues/treasurer` ·
`officer/messages/` · `governance/` · `directory/$personId` ·
`announcements/(+$announcementId)` · `messages/` · `/settings/security` ·
admin `/communications/email`. (Coverage check is a leaf-segment grep — confirm
by reading the spec, not the grep.)

## Batch 2 — P0 money: officer finances + dues (write specs)

Routes (zero-ref + any Batch-1 demotions): `officer/finances/assessments`,
`officer/finances/dues`, `officer/dues/assessments` (+ funds/members/invoices
detail if Batch 1 demotes them). Flows: **WF-129** Create Invoice, **WF-131**
Refund Payment (billing, distinct from dues WF-041), **WF-133** View Invoices.
Auth: `treasurer`. Assert real money figures, statuses, line items — not headings.

## Batch 3 — P0 governance: ballot + bylaw

**WF-077** cast secret ballot (`/org/$orgSlug/elections/$electionId/vote`) —
one-vote-per-position (BR-33). **WF-078** Bylaw Ratification. Needs a per-test
election fixture (the existing tally spec self-skipped on the missing G15
fixture — build/adopt it). Also `officer/elections/$electionId/edit`.

## Batch 4 — P0 admin security

admin `/compliance/`, `/verifications/`, `/communications/email`,
`/communications/moderation`, `/communications/templates`; **WF-125** Manage
Suppressions (admin views/removes suppressed addresses — handler tests exist, no
UI spec); memberry `officer/compliance`. Auth: `admin`. Assert real audit/
compliance/suppression data + the remove action firing.

## Batch 5 — P1 member actions

**WF-008** officer send-invite · **WF-033** category create (submit, not just open
dialog) · **WF-036** member transfer (fire the request) · **WF-067** officer
credit adjust (award/deduct + mandatory reason) · **WF-072** real-token public
verification · **WF-051** re-enable the disabled `test.fixme` create-event in
`actions/events-actions.spec.ts`. Routes: `officer/institutional-memberships/*`
(3), `my-notifications`, `messages/dm/`, `/settings/security`.

## Batch 6 — P1 comms / events / training

**WF-047** message templates · **WF-048** delivery stats · **WF-057** waitlist
auto-promotion · **WF-062** paid training · **WF-063** training analytics. Routes:
`officer/communications/templates/(+new)`, `announcements/(+$id)`.

## Batch 7 — M14 / M18 / M19 + booking (have UI, lower priority)

M14: **WF-084/085/086** national dashboard / drill-down / export (admin
`national-dashboard`). M18 surveys: **WF-102** results, **WF-103** poll;
`officer/surveys/new`. M19 committees: **WF-104–108** (has 1 route + 3 specs —
verify first). M20 booking: **WF-115/116** schedule config (`/my/schedule`),
**WF-120** mark no-show.

## Batch 8 — Backend-shaped flows (NOT e2e)

**WF-124** Handle Bounce · **WF-132** Handle Stripe Webhook · **WF-122/123/126/
127** email queue/template ops. These are server-triggered, no UI flow. Write
**backend integration tests** (real-PG harness pattern) and add these WF ids to a
`DEFERRED_FLOW_MODULES`-style per-flow exempt set in `coverage-matrix.ts` (with a
comment) so Matrix B stops counting them as e2e gaps. Same for M03 platform-admin
flows whose routes don't exist yet (**WF-017/020/021** — no subscription/ticket/
revenue route in admin) → defer until the routes ship.

## Batch 9 — Phase 7: harden gates

Once depth is backfilled: in `.github/workflows/quality-gates.yml` flip the
`lint:e2e-depth` step off `continue-on-error: true`; confirm the matrix ratchet
sits at its floor. Final green.

---

## Done criteria

B and C gate counts reach their true floor (genuine gaps closed or formally
deferred with a documented reason), `bun run audit:workflows` green, e2e-depth
gate hard, baseline ratcheted to the floor.
