# Test-gap ledger — P0 inventory (2026-06-21)

Read-only inventory of every module's business rules, user workflows, and inter-module
contracts vs their actual test status. Produced by a 26-agent workflow (run `wf_3759d6b4-8a2`,
25 module readers + 1 inter-module reader), each verifying against **source + actual test
files** — the BR registry, coverage-matrix, and `.coverage-thresholds.json` were treated as
SUSPECT and cross-checked (159 drift entries found). No tests were written.

**Classification:** REAL = asserts real data/behavior/business outcome. SHALLOW =
heading/selector/200-status/smoke only. MISSING = no test. Effort S/M/L = work to reach
the tier floor + cover the gaps.

Target floors (risk tiers): **critical 70 · mid 50 · peripheral 40**.

---

## Global picture

| Axis | REAL | SHALLOW | MISSING | total |
|---|---|---|---|---|
| Business rules | 350 | 117 | 51 | 518 |
| User workflows (e2e) | 47 | 79 | 81 | 207 |
| Integration gaps (no real-PG) | — | — | **135** | — |
| Shallow tests flagged | — | **160** | — | — |
| Registry drift (stale/wrong entries) | — | **159** | — | — |
| Inter-module contracts | 8 | 3 | 2 | 13 |

**The three systemic findings:**

1. **Workflows are the weak axis, not unit BRs.** BRs are 68% real; user workflows are only
   23% real (47/207). E2E mostly asserts the page mounted / a heading is visible, not that the
   real flow produces the real outcome. 81 workflows have **no** e2e at all.
2. **The "integration test" illusion.** Much of the 135 integration-gap count is files that
   carry the `*.integration.test.ts` suffix but run on a **hand-rolled mock / fake-db**
   (`makeCtx`/`stubRepo`), never touching real Postgres. dues and billing have **zero** real-PG
   tests; every `association:member` repo has only a `*.coverage.test.ts` fake-db mock. These
   pass green and read as "covered" while proving nothing about the SQL.
3. **Inter-module side-effects are largely unproven.** 2 contracts MISSING + 3 SHALLOW — the
   ones that move money/governance: event-registration Stripe settlement, election→officer-term
   cascade, credits→compliance matview refresh, invite→membership events, notification fan-out.

---

## Ranked module table

`BR R/S/M` = real/shallow/missing business rules · `WF R/S/M` = workflow e2e · `integ` = real-PG
gaps · `shlw` = shallow tests · `drift` = registry drift.

| Tier | Module | floor | hdlrs | BR R/S/M | WF R/S/M | integ | shlw | drift | effort |
|---|---|---|---|---|---|---|---|---|---|
| C | person | 70 | 27 | 14/11/3 | 5/4/2 | 6 | 11 | 5 | M |
| C | communication | 70 | 43 | 16/4/4 | 2/4/5 | 5 | 8 | 10 | L |
| C | association:member | 70 | 223 | 23/6/1 | 7/8/4 | 13 | 9 | 8 | L |
| C | billing | 70 | 16 | 14/5/0 | 1/1/5 | 7 | 7 | 7 | L |
| C | membership | 70 | 4 | 5/7/1 | 1/3/0 | 5 | 8 | 5 | M |
| C | member | 70 | 198 | 34/4/3 | 6/11/1 | 12 | 6 | 8 | L |
| C | dues | 70 | 57 | 17/4/1 | 3/6/2 | 5 | 8 | 7 | L |
| C | invite | 70 | 4 | 15/1/3 | 1/1/1 | 4 | 4 | 6 | M |
| M | notifs | 50 | 5 | 9/10/2 | 0/4/2 | 4 | 6 | 5 | M |
| M | platformadmin | 50 | 47 | 19/5/4 | 2/5/5 | 8 | 10 | 8 | M |
| M | booking | 50 | 19 | 8/9/2 | 1/4/2 | 7 | 6 | 7 | M |
| M | events | 50 | 11 | 5/4/4 | 1/3/4 | 4 | 9 | 7 | M |
| M | storage | 50 | 6 | 14/4/3 | 0/0/5 | 3 | 5 | 5 | S |
| M | documents | 50 | 16 | 14/3/4 | 2/4/3 | 4 | 6 | 6 | M |
| M | association:operations | 50 | 71 | 16/5/0 | 6/2/4 | 6 | 7 | 7 | M |
| M | reviews | 50 | 4 | 7/2/5 | 0/1/2 | 3 | 5 | 5 | M |
| M | email | 50 | 14 | 16/3/0 | 0/1/6 | 3 | 5 | 6 | M |
| M | comms | 50 | 13 | 30/4/1 | 0/2/4 | 4 | 4 | 4 | S |
| M | surveys | 50 | 16 | 17/5/0 | 4/3/3 | 5 | 6 | 7 | M |
| M | elections | 50 | 4 | 9/5/1 | 1/4/1 | 4 | 8 | 8 | M |
| P | jobs | 40 | 7 | 11/4/2 | 0/0/7 | 4 | 5 | 7 | S |
| P | marketplace | 40 | 13 | 10/3/1 | 0/0/7 | 6 | 4 | 5 | M |
| P | onboarding | 40 | 2 | 9/3/2 | 0/1/3 | 3 | 3 | 6 | S |
| P | advertising | 40 | 7 | 11/2/3 | 0/5/2 | 5 | 4 | 5 | S |
| P | audit | 40 | 1 | 7/4/1 | 4/2/1 | 5 | 6 | 5 | S |

Per tier: **critical** — 16 BR missing, 42 shallow, 20 WF missing, 57 integ gaps (5×L, 3×M).
**mid** — 26/59/41/55 (10×M, 2×S). **peripheral** — 9/16/20/23 (4×S, 1×M).

---

## Inter-module contracts (13) — the cross-module side-effects

Non-REAL ones (these are the priority — they move money/governance):

- **MISSING — event-registration Stripe settlement** (`member/duesspecialassessments processStripePayment` → `association:operations EventRegistrationRepository`). The webhook branch that stamps `paid_at` on `event_registration` (processStripePayment.ts:54-70) has **no test** — only the org/person dues case is covered. A paid event registration is never proven to settle.
- **MISSING — election certification → officer-term transition** (`member/governance certifyElection` → `domain-event-consumers election.published` → `OfficerTermRepository`/checklists). certifyElection emits `election.published`; the consumer ends outgoing terms, mints winner terms, writes checklists, re-emits `officer.transitioned/assigned`. **Neither side tested** — certifyElection.test.ts asserts only the 403 gate.
- **SHALLOW — credits → compliance matview** (`member/credits` award/verify/reject/adjust/void → `compliance.recompute` event → `REFRESH MATERIALIZED VIEW compliance_standings`). Emitter side REAL; **consumer side untested** — no test proves the matview actually refreshes.
- **SHALLOW — invite claim → membership + events** (`invite claimInvite` → `membership.addMember`). Membership-creation contract is well-tested (tx rollback, dup 409), but the `invite.claimed` / `membership.created` **events are not asserted to fire**.
- **SHALLOW — notification fan-out** (`domain-event-consumers` → `notifs`). ~20 event→notification consumers (officer.assigned/removed, member.suspended, credit.awarded, event.published, training.completed, …); only a **subset** is tested. Most cross-module notification inserts are unproven.

REAL (8): dues settlement→duesExpiry, online-dues webhook settlement, officer-term auth gate, membership.created→first invoice+welcome, person.deleted→19-step PII cascade, survey/NPS membership scoping, membership→comms channel auto-join, billing Stripe-Connect webhook.

---

## Waves (fill order — gate each before the next)

- **Wave 1 — critical tier (8 modules):** person, membership, dues, billing, invite, member, association:member, communication. + the 2 MISSING / 3 SHALLOW inter-module contracts (money + governance).
- **Wave 2 — mid tier (12):** events, booking, association:operations, documents, surveys, reviews, notifs, email, storage, comms, platformadmin, elections.
- **Wave 3 — peripheral (5):** marketplace, advertising, audit, jobs, onboarding.

Method (locked): **characterize existing code, TDD new behavior.** Where a "MISSING" BR turns out to be a real bug (e.g. the deletion guards below), red-test it then fix.

---

## Wave 1 detail (what gets written)

### person (M) — floor 70
- **MISSING BR:** `DELETE-PENDING-PAYMENTS` (422 block when pending dues payment exists), `DELETE-SOLE-OFFICER` (422 block when sole active officer), `EXPORT-DOWNLOAD-OWNERSHIP` (404 cross-person, TTL, not-ready). The two deletion **blocks are entirely untested** — unit tests stub the guard to `[]`, contract tests sign up fresh users to dodge them. These are safety guards; verify they actually fire.
- **MISSING workflows:** deletion-blocked-by-pending/sole-officer (negative), scheduled anonymization cron + financial retention.
- **SHALLOW (11):** 30-day-grace arithmetic, audit-no-PII (negative untested), financial-retention (mock can't prove payment rows survive), export envelope shape/no-drift, notif-pref category upsert, getPerson owner-only, etc.
- **integ gaps:** no `*.integration.test.ts` for person at all — deletionProcessor, build-data-export, privacy upsert, deletion guards all run on mock db.

### membership (M) — floor 70
- **MISSING BR:** `getMemberById` + `findActiveMembershipByPersonAndOrg` port (zero tests).
- **SHALLOW workflows:** officer roster (legacy surface), org-profile edit, pending-applications summary.
- **integ gaps:** the most complex SQL in the module (two correlated subqueries, BR-01 status expr, anti-wildcard search escaping) is mock-only or untested.

### dues (L) — floor 70
- **MISSING BR:** `BR-48` bulk-payment batch-size cap (flagged uncloseable before — confirm handler exists or build it).
- **MISSING workflows:** special-assessment create+apply, payment-proof submit→officer confirm/reject.
- **SHALLOW workflows:** WF-037/038/040/042/043 (dues lifecycle, pay-online, config, dunning, financial dashboard), Stripe webhook settlement.
- **integ gaps:** dues / special-assessments / dunning / dues-payments repos — **no real-PG**; `member/duesspecialassessments/*.integration.test.ts` is mock-based despite the suffix.

### billing (L) — floor 70
- **MISSING workflows:** WF-129 create invoice, WF-130 pay (Hold&Decide intent), WF-131 refund/void, WF-132 Stripe webhook (idempotent), merchant dashboard.
- **SHALLOW BR:** invoice line-item replace, invoice-number generation, durable webhook idempotency.
- **integ gaps:** **zero real-PG** for billing — JSONB payment-intent lookups, atomic line-item replace, sequential invoice numbering, 23505 dedupe ledger, merchant-account unique constraints, AES-256-GCM credential encryption all mock-only.

### invite (M) — floor 70
- **MISSING BR:** 2FA-privileged gate on createInvite (prod), claim emits `invite.claimed`+`membership.created`, claim slug best-effort (lookup failure non-fatal).
- **MISSING workflow:** officer bulk CSV roster import (preview→import→claim tokens).
- **integ gap:** claim tx cross-repo rollback + downstream membership write only unit-tested against mock; domain events unasserted.

### member (L) — floor 70 *(decomposed entrypoints)*
- **MISSING BR:** `BR-39` committee dissolution, `BR-48` bulk-payment cap, `BR-PUBLIC-PAYMENT-LINK` (HMAC token, 30-day, public validate).
- **MISSING/SHALLOW workflows (11):** special assessment, CSV roster import, roster search, dues config/payments dashboard, pay-online, CPD summary + cross-org aggregate, officer verify/reject CPD, certificate view/QR-verify, ID-card/license, directory publish/search, chapter transfer (dual approval), officer role/term transitions.
- **integ gaps:** every `association:member` repo (dues, dues-payments, dunning, special-assessments, credits, compliance, credentials, governance, directory) is fake-db mock; `payment-token` HMAC core has **no test**; org CPD config handlers zero tests.

### association:member (L) — floor 70 *(shared repos/schemas)*
- **MISSING BR:** `BR-39` committee dissolution cascade.
- **SHALLOW:** roster import, chapter transfer, institutional seat, online dues, BR-14/44.
- **integ gaps:** same fake-db-mock repos as `member` — this is where the real-PG integration suite must land (one shared harness covers both `member` and `association:member`).

### communication (L) — floor 70
- **MISSING BR:** feed-list-excludes-removed + total count, single-pin invariant, poll-vote guards (non-poll/inactive/past-deadline/duplicate), survey-results officer-only + per-type aggregation.
- **MISSING workflows:** scheduled-announcement cron delivery, feed browse, feed post create+moderate (report→auto-flag at 3→remove), mute author, quick-poll vote+instant-results.
- **integ gaps:** FeedPostRepository, SurveyRepository (this module's), savedSegments all mock-only; the one real-PG comms test is CI-gated off.

### Inter-module (Wave 1 cross-cut)
Write integration/e2e for the 2 MISSING + 3 SHALLOW contracts above (event-reg settlement, election→officer-term, credits→compliance consumer, invite events, notification fan-out).

---

## Recommended Wave 1 Definition of Done

1. Stand up a **real-PG integration harness** for the membership domain (`member` /
   `association:member` repos) — the single highest-leverage fix; it closes ~30 of the 57
   critical integ gaps and converts the fake-`.integration` files to real ones.
2. Every **MISSING critical BR** gets a real test; if it exposes a bug (deletion guards,
   public-payment-link, poll-vote guards), red-test → fix.
3. Every **MISSING critical workflow** gets a real-flow e2e (real data assertion, not heading).
4. The **2 MISSING + 3 SHALLOW inter-module contracts** get an integration/e2e proving the
   cross-module effect actually happens.
5. Ratchet the 8 critical floors toward 70 only as real coverage lands (no number-chasing).
6. Fix the **registry drift** for touched modules as we go (the registry is the spec; keep it true).

Raw per-rule data (every BR statement + evidence string, all 25 modules): workflow run
`wf_3759d6b4-8a2` transcript. This ledger is the decision surface.
