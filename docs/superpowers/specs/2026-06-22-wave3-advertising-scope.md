### advertising

## advertising module — Wave-3 (cluster peripheral) TDD slice plan

Floor **40** (peripheral tier; currently `src/handlers/advertising` = `{ line: 5, function: 0 }` in `.coverage-thresholds.json:38` — ratchet toward 40). Effort **S–M**. Method (locked, mirrors Wave-1/Wave-2 ledger): characterize existing code → TDD new behavior; where a MISSING BR is a real bug, red-test then fix the RIGHT layer. DoD priority: (1) real-PG harness on the un-covered repo + migrate the 3 existing suites to `createScratch` → (2) MISSING BRs get real tests → (3) MISSING workflows get real-flow proof → (4) inter-module contracts proven → (5) ratchet floor → (6) fix registry drift.

**Source facts verified (against source + live catalog):**
- 5 tables, all in `repos/advertising.schema.ts`, all live-confirmed (`\d`): **`advertiser`**, **`ad_campaign`** (Drizzle `campaigns`), **`ad_creative`** (Drizzle `creatives`), **`member_ad_opt_out`** (Drizzle `memberAdOptOuts`), **`ad_report`** (Drizzle `adReports`). Live FK chain: `ad_campaign.advertiser_id → advertiser.id ON DELETE CASCADE`; `ad_creative.campaign_id → ad_campaign.id ON DELETE CASCADE`; `ad_report.creative_id → ad_creative.id` (**no ON DELETE — plain RESTRICT**). `organization_id` is `NOT NULL` on all 5 tables (live-confirmed).
- Live enums: `campaign_status` = `{draft, pending_review, active, paused, completed, rejected}`; `creative_status` = `{pending, approved, rejected}` (**no `paused` value** — `pauseCreative` reverts to `pending`, creative.repo.ts:118-122); `ad_slot` = `{feed_banner, sidebar, email_footer, event_sponsor}`. Default on `ad_creative.sponsored_label` = `true`; `ad_campaign.status` default `'draft'`; `ad_campaign.ad_slot` default `'feed_banner'`.
- 4 repos: `advertiser.repo.ts`, `campaign.repo.ts`, `creative.repo.ts`, `optOut.repo.ts`. **`advertiser.repo.ts` has NO integration test** (only `createAdvertiser.test.ts`, a mock-ctx handler unit test). Confirmed gap — needs a NEW real-PG harness slice.
- The 3 existing integration suites (`campaign.repo.integration.test.ts`, `creative.repo.integration.test.ts`, `optOut.repo.integration.test.ts`) are **genuine real-PG** — they create rows, read them back, assert counts/columns. BUT they use `db.transaction(...)` + throw-ROLLBACK on the **shared `public` schema** (not `createScratch`), guarded by `SKIP = !DATABASE_URL` (NOT `if(process.env.CI)return` — they DO run in CI when DATABASE_URL is set). They each carry a fragile `capturePristine()`/`restorePristine()` prototype-restore hack to undo sibling handler-test `mock()`s that are never restored. This is the Wave-2 **B4 hand-pattern drift class (lite)**: shared-public rollback masks isolation and the org-scope filter tests must explicitly re-scope ("other committed rows in the DB may use 'sidebar'", campaign suite:129) — a tell that the suite is reading the live public table, not an isolated one. Fix = migrate to `createScratch` (LIKE public.<t> INCLUDING ALL), which also lets us drop the prototype-restore hack (isolated schema, no cross-file pollution on a per-schema pool).
- **Live-catalog drift on the privacy surface (REAL):** `member_ad_opt_out` has **only `member_ad_opt_out_pkey` (on `id`)** — NO unique constraint on `(organization_id, person_id)`. The `ad_opt_out_org_person_idx` is a **plain (non-unique) btree** (migration `0050_timestamptz-migration.sql:1089`). `optOut()` (optOut.repo.ts:56-65) enforces "one row = opted out" purely in app code via `findOne`-then-`createOne` — a TOCTOU window. `optIn()` (optOut.repo.ts:71-76) deletes only the FIRST found row (`deleteOneById(existing.id)`) — if duplicates ever exist (the race above), opt-in leaves a straggler row and the member silently stays opted-out. This is a consent/privacy data-integrity gap, not just an unproven SQL fragment.
- Handlers (7): `createAdvertiser`, `createCampaign`, `createCreative`, `reviewCreative`, `reportAd`, `setMemberOptOut`, `getAdForPlacement`. All TypeSpec-generated routes under `/association/advertising/*` (routes.ts:367-416), all `authMiddleware({roles:["user"]})`. **No `x-require-officer`/`x-require-position`/x-org middleware on these routes** — `organizationId` is read from `ctx.get('organizationId')` (set upstream by the org-resolution middleware), and `setMemberOptOut`/`getAdForPlacement`/`reportAd` fail-closed when it is absent (setMemberOptOut.ts:25-28, reportAd.ts:49). So a NOT-NULL org_id is always satisfied by these handler paths — no migration needed (unlike B1's 0079).
- Harness pattern to mirror: `src/test-utils/pg-scratch.ts → createScratch([...tables])`. FKs are dropped by `LIKE`, so each suite can seed parents directly without standing up the whole chain. Guard every test `if (!H.dbReachable) return;`, `afterAll(() => H?.teardown())`.

**Cluster note (Wave-3 peripheral):** advertising shares NO DB FKs with marketplace/audit/jobs/onboarding — there is no cross-module shared fixture. Each Wave-3 module owns its own `createScratch` table-set. advertising's harness slice stands up `createScratch(['advertiser','ad_campaign','ad_creative','member_ad_opt_out','ad_report'])` and is self-contained. The repo-level seed helpers (insert advertiser→campaign→creative) are factored into the advertiser suite and reused by the migrated campaign/creative suites.

---

### Slice 1 — Real-PG harness for AdvertiserRepository (the un-covered repo) + adopt `createScratch` — NEW
- **axis:** integ (harness — highest leverage, DoD #1)
- **files to CREATE:** `src/handlers/advertising/repos/advertiser.repo.integration.test.ts`
- **pattern:** `createScratch(['advertiser','ad_campaign','ad_creative','member_ad_opt_out','ad_report'])` from `@/test-utils/pg-scratch`. Export a small local fixture (`seedAdvertiser(H, org, overrides?)`, `seedCampaign(...)`, `seedCreative(...)`) so the migrated campaign/creative suites (Slice 2) import it instead of re-hand-rolling INSERTs. No prototype-restore hack — the isolated schema + per-schema pool removes the cross-file `mock()` pollution the old suites worked around.
- **asserts (real persisted rows / real SQL):**
  - `createOne` persists an advertiser with `organization_id`, `company_name`, `contact_email`; read back via `H.scopedPool.query` and assert `is_active` defaulted to `true` (live default) and `version=1`.
  - `buildWhereConditions` branches against real rows: seed 2 advertisers in orgA (one `is_active=false`) + 1 in orgB → `findMany({organizationId: orgA})` returns exactly 2 and every row `organization_id===orgA` (proves org-scoping isolation on an ISOLATED schema, not the shared public table the old suites must re-scope around); `findMany({organizationId: orgA, isActive: true})` returns exactly 1; `findMany()` (undefined-filter branch) returns all 3.
  - **NOT NULL invariant:** `createOne` without `organizationId` / without `companyName` / without `contactEmail` → Postgres `code === '23502'` on the respective column (proves the live NOT NULL fires; assert the raw SQLSTATE, not a stubbed throw).
  - **FK cascade (characterization):** insert advertiser → campaign → creative via the seed helpers; `DELETE FROM advertiser WHERE id=$1` then assert the child `ad_campaign` and `ad_creative` rows are gone (live `ON DELETE CASCADE`). Documents the cascade the schema declares.
- **est commits:** 2 (1 harness fixture + advertiser CRUD/filter/NOT-NULL; 1 the FK-cascade characterization)
- **classification:** test-fragility (integGap — repo had zero real-PG). The cascade/NOT-NULL asserts are characterization.

### Slice 2 — Migrate the 3 existing integration suites off shared-public-rollback onto `createScratch` — REFACTOR
- **axis:** integ (harness faithfulness — DoD #1; converts "real-but-shared-public + brittle prototype hack" → "real + isolated")
- **files to EDIT (in place):** `repos/campaign.repo.integration.test.ts`, `repos/creative.repo.integration.test.ts`, `repos/optOut.repo.integration.test.ts`
- **change:** replace `createDatabase` + `db.transaction`/throw-ROLLBACK + `capturePristine`/`restorePristine` with `createScratch([...])` (campaign: `['advertiser','ad_campaign']`; creative: `['advertiser','ad_campaign','ad_creative','ad_report']`; optOut: `['member_ad_opt_out']`). Guard `if (!H.dbReachable) return`. Seed parents directly via the Slice-1 fixture (FKs dropped by LIKE). Drop the per-test org-rescoping work-arounds (campaign suite:129) since the scratch schema starts empty.
- **asserts (must remain green, now isolated):**
  - campaign: filter branches (org/advertiser/status/adSlot) now return EXACT counts on an empty-start schema (no "live rows may use sidebar" caveat); `pauseCampaign` → `status='paused'` + `updatedBy` set; `findByIds([])`→`[]`, org-scoped excludes cross-org (`cB` from orgB never leaks), unscoped returns both.
  - creative: org/campaign/status filters; `approveCreative`/`rejectCreative`/`pauseCreative` transitions (assert `pauseCreative` lands `status='pending'` — the no-`paused`-enum behavior); `createReport` persists; `countReports`=2 and `countReportsWithinDays(7)`=1 after backdating one report 10 days (the rolling-window cutoff).
  - optOut: `optOut` idempotent (second call no-op → still 1 row), `isOptedOut` reflects state, `optIn` deletes-if-present / no-op-when-absent, org-scoping (orgB row for same person never leaks).
- **est commits:** 1 (mechanical migration of all three; verify the CI DB lane stays green)
- **classification:** test-fragility (hand-pattern-drift — shared-public rollback + prototype-restore hack; fix = `createScratch`, not source).

### Slice 3 — REAL BUG: opt-out has no DB uniqueness on (org, person) — red-test the TOCTOU dup + optIn straggler, then fix
- **axis:** integ + BR (privacy/consent data-integrity)
- **files to CREATE/EXTEND:** extend `repos/optOut.repo.integration.test.ts` (Slice-2 scratch suite)
- **the bug (evidence):** live `member_ad_opt_out` has NO unique index on `(organization_id, person_id)` — only `member_ad_opt_out_pkey` on `id` and the plain btree `ad_opt_out_org_person_idx` (`\d member_ad_opt_out`; migration 0050:1089 is non-unique). `optOut()` (optOut.repo.ts:56-65) is `findOne`-then-`createOne` with no DB backstop → concurrent calls both pass the `findOne` guard and insert TWO rows for the same (org, person). `optIn()` (optOut.repo.ts:71-76) then deletes only `existing.id` (the first found) → a duplicate remains and `isOptedOut` keeps returning `true`, so the member who clicked "show me ads again" silently stays opted OUT. On a consent surface this is a real data-integrity defect, not an unproven fragment.
- **asserts (RED first):**
  - **Concurrent opt-out dup:** `Promise.allSettled([repo.optOut(org, p), repo.optOut(org, p)])` on the same (org, person) → assert exactly ONE row exists for (org, person). Currently FAILS (two rows). Then ADD a **partial/unique index migration** `unique(organization_id, person_id)` (the consent invariant) so the loser raises `23505` (caught/ignored as idempotent), and `optOut()` is changed to an idempotent upsert (`ON CONFLICT (organization_id, person_id) DO NOTHING`) — GREEN.
  - **optIn straggler:** seed two rows for the same (org, person) directly (simulating the pre-fix race) → `optIn(org, p)` → assert ZERO rows remain (fix `optIn` to delete ALL matching rows, not just `existing.id`). RED then GREEN.
  - **migration safety check (must verify before recommending):** the new unique index requires no live duplicates — Slice author runs `SELECT organization_id, person_id, count(*) FROM member_ad_opt_out GROUP BY 1,2 HAVING count(*)>1` against the live DB; if any exist, the migration must de-dup first (keep `min(opted_out_at)` row). No org-middleware concern (opt-out route is user-scoped, org always present — verified routes.ts:405 + setMemberOptOut.ts:25).
  - Positive characterization: single `optOut` then `optIn` → 0 rows, `isOptedOut` false (unchanged behavior preserved).
- **est commits:** 2 (1 RED dup + straggler tests; 1 migration `unique(org_id, person_id)` + `optOut` ON CONFLICT + `optIn` delete-all → GREEN)
- **classification:** **real-bug** (missing prod control — a `.notNull()`-class drift inverse: a uniqueness invariant the app assumes but the live DB does not enforce, on a consent surface; concurrent dup + optIn straggler are demonstrable wrong behavior).

### Slice 4 — BR: creative approval gate + sponsored-label enforcement (reviewCreative workflow) — characterize MISSING/SHALLOW
- **axis:** BR
- **files to CREATE/EXTEND:** `src/handlers/advertising/reviewCreative.test.ts` exists (mock-ctx) — spot-check then fill gaps; add the real-PG approval-state assertions to the creative integration suite.
- **asserts:**
  - reviewCreative: `approved:true` on a `pending` creative → repo `approveCreative` sets `status='approved'`, `reviewed_by`, `reviewed_at` (assert via repo read-back on the scratch schema, not just response). `approved:false` without `rejectionReason.trim()` → `ValidationError` (reviewCreative.ts:34). `approved:false` with reason → `status='rejected'`, `rejection_reason` persisted.
  - **state-machine guard:** reviewing a creative whose `status !== 'pending'` (already `approved` or `rejected`) → `BusinessLogicError('Only pending creatives can be reviewed')` (reviewCreative.ts:42). Assert no DB write happened (status unchanged on read-back).
  - **BR-47 sponsored label:** `getAdForPlacement` always returns `sponsoredLabel: true` even if the stored creative row had it flipped — seed a creative with `sponsored_label=false`, assert the served ad still carries `sponsoredLabel:true` (getAdForPlacement.ts:88; the always-enforce override). This is the load-bearing M16-R3/AC-M16-003 guarantee.
- **est commits:** 1
- **classification:** characterization (SQL/handler logic is correct; just unproven against persisted rows + the state guard).

### Slice 5 — Workflow: getAdForPlacement serving gate (approval + campaign status/schedule + opt-out) against real PG — characterize the serve path
- **axis:** workflow
- **files to CREATE:** `src/handlers/advertising/getAdForPlacement.integration.test.ts` (real-PG, drives the REAL repos via `createScratch`, not stubRepo)
- **asserts (real persisted rows; the serve path is the revenue/leak surface):**
  - **opt-out wins (server-side, AC-M16-004):** seed an `approved` creative on an `active` in-window campaign + a `member_ad_opt_out` row for the user → response `{ad:null, generic:true, reason:'member_opted_out'}` (getAdForPlacement.ts:39-45) regardless of any client `optedOut` query flag.
  - **approval gate (AC-M16-001):** seed only `pending`/`rejected` creatives → `{ad:null, reason:'no_approved_ads'}`. Add an `approved` one → it serves.
  - **campaign status/schedule gate (M16-R6/FIX-010):** approved creative whose parent campaign is `paused` → not served; `active` but `starts_at` in the future → not served; `active` but `ends_at` in the past → not served (getAdForPlacement.ts:66-72). Only the `active` + in-window campaign's creative serves.
  - **cross-org leak guard:** an `approved` creative in orgB with an `active` campaign must NEVER serve to a user scoped to orgA (the `findMany({organizationId})` + `findByIds(ids, organizationId)` org filters, getAdForPlacement.ts:50/62). Assert null/no-leak.
- **est commits:** 2 (1 opt-out + approval gate; 1 campaign status/schedule + cross-org leak)
- **classification:** characterization (the gating logic is correct in source; never proven end-to-end against persisted campaign/creative/opt-out rows — high-confidentiality serve path).

### Slice 6 — Inter-module: reportAd → ad_report persistence + 3-in-7-day auto-pause → admin notification fan-out — characterize
- **axis:** inter-module
- **files to CREATE:** `src/handlers/advertising/reportAd.integration.test.ts` (real-PG; mirror notifs fan-out pattern — `createScratch(['advertiser','ad_campaign','ad_creative','ad_report','notification','person'])`, drive the REAL `CreativeRepository` + `NotificationRepository`, poll the `notification` table).
- **asserts (real rows + correct columns):**
  - report persistence: each `reportAd` inserts an `ad_report` row (`creative_id`, `reporter_person_id`, `reason`, `organization_id`); `countReportsWithinDays(7)` reflects it.
  - **org isolation (404-not-403):** reporting a creative whose `organization_id !== ctx org` → `NotFoundError` and NO `ad_report` row written (reportAd.ts:49-51 — avoids leaking other orgs' creative existence).
  - **auto-pause threshold (M16-R5):** on an `approved` creative, the 3rd report within 7 days (`REPORT_THRESHOLD=3`, reportAd.ts:25) → `pauseCreative` reverts `status` to `pending` (assert read-back) AND `autoPaused:true` in response; the 2nd report does NOT pause. A creative already `pending`/`rejected` is NOT re-paused but the report is still recorded (reportAd.ts:70).
  - **notification fan-out:** after auto-pause, exactly one `notification` row for `creative.created_by` with `type='system'`, `related_entity_type='ad_creative'`, `related_entity=creativeId` (reportAd.ts:88-97). And: notification failure is non-fatal — the report response still returns the count/autoPaused (the try/catch at reportAd.ts:98-100).
- **est commits:** 2
- **classification:** characterization (logic correct; report persistence + rolling-window + fan-out unproven against real rows / real notification bus).

### Slice 7 — Per-module ratchet + registry/coverage-threshold drift (FOLD into the single Wave-3 finalize)
- **axis:** integ/BR (housekeeping — DoD #5/#6)
- **edit:** `services/api-ts/.coverage-thresholds.json` — raise `src/handlers/advertising` `line` from **5** toward **40** (set to the real measured number after slices 1–6 land; with the advertiser repo now covered + the 3 suites isolated + the serve/report integration paths, module-min line should clear 40 comfortably — do not number-chase, measure). Update the BR registry / coverage-matrix entries for advertising BRs now backed by real tests (opt-out idempotency invariant, creative approval gate, sponsored-label enforcement, campaign status/schedule serve gate, report auto-pause + fan-out, the migrated repo suites).
- **asserts:** `bun test` (api) green incl. the now-isolated integration suites + the new opt-out unique migration; coverage gate passes at the new floor; registry has no stale "MISSING/SHALLOW" rows for the items this plan made REAL.
- **NOTE:** this slice is to be FOLDED into the single Wave-3 finalize commit alongside marketplace/audit/jobs/onboarding ratchets — do NOT ship a standalone advertising-only ratchet commit.
- **est commits:** 1 (folded)
- **classification:** housekeeping.

---

**Totals:** 7 slices, ~10 commits (1 folded). **Harness-first** (slices 1–2): Slice 1 brings the only un-covered repo (`advertiser`) onto real PG and stands up the shared advertising fixture; Slice 2 migrates the 3 genuine-but-shared-public suites onto `createScratch` and deletes the brittle prototype-restore hack. **One RED-then-fix real bug** (Slice 3): the missing `unique(organization_id, person_id)` on `member_ad_opt_out` — a consent-surface uniqueness invariant the app assumes but the live DB never enforces (TOCTOU dup + `optIn` straggler) — red-tested then fixed with a unique-index migration + `ON CONFLICT DO NOTHING` upsert + delete-all opt-in. Slices 4–6 are characterization of the approval gate, serve gating (confidentiality/leak surface), and report→auto-pause→notification fan-out. Floor 5 → 40.
