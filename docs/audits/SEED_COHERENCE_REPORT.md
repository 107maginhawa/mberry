# Seed Coherence Report

---
oli-version: seed-coherence-v1
report_date: 2026-06-03T08:21:44Z
based-on: map@3f0dae76
last-modified: 2026-06-03T08:21:44Z
last-modified-by: /oli-check --regenerate-dim-reports --auto
mode: STATIC
head_sha: 3f0dae76
verdict: PASS
inputs:
  - docs/product/SEED_MANIFEST.md (mtime 2026-06-03 09:06 +0800, last commit 0b48996d)
  - docs/audits/codebase-map/CODE_DATA_MODEL.json (129 distinct tables, via map@3f0dae76)
  - services/api-ts/src/seed.ts (orchestrator, 254 LOC)
  - services/api-ts/src/seed/layer-{1..7}*.ts (12 files, 5,701 LOC of seed-only code)
  - services/api-ts/src/seed/data.ts (OFFICERS=5, MEMBERS=31, APPLICANTS=2)
---

## Run Context

| Field | Value |
|---|---|
| Caller | `/oli-check --regenerate-dim-reports --auto` |
| Map sha | `3f0dae76` (FRESH per upstream) |
| HEAD | `3f0dae76` |
| Mode | **STATIC** (claim-vs-script grep cross-walk) |
| seed-boot | `skipped` — `--boot` not requested; `auto_run_tier_1_2` not in `.oli/config.json`. Runtime replay deferred per CHECK_LEARNINGS row 23. |
| Manifest mtime | `2026-06-03 09:06 +0800` (commit `0b48996d`) |
| Seed newest commit | `2026-06-02 14:57 +0800` (`f31e3075`) |
| Staleness probe | Manifest newer than seed tree → **no `SC-MANIFEST-STALE` emitted** |
| Source delta since prior run | **zero** — commits `343fcf05..3f0dae76` (4 audit commits) are doc-only; no `services/api-ts/src/seed/**` or `SEED_MANIFEST.md` change. |
| Trust degradation | Map FRESH @3f0dae76; this dimension unaffected. |
| Prior verdict | PASS (Wave 57 @ map@2331bd9f, head@343fcf05); this regeneration confirms — re-verified at HEAD. |

## Mode & Scope

STATIC analysis only. The dimension's runtime mode would replay primary-persona GETs against `bun dev` + `bun run db:seed` on `:7213` and diff returned counts vs SEED_MANIFEST claims. That replay loop is **skipped** for this regeneration (`--boot` not requested). Instead, this run cross-walks:

- Persona / entity / scenario claims in `SEED_MANIFEST.md`
- `.insert(<table>)` + raw `INSERT INTO` + API `SeedClient.post(...)` sites across the 12 seed-layer files (5,701 LOC)
- Schema ground truth in `CODE_DATA_MODEL.json` (129 distinct tables after dedup)

Severity mapping (static):

- **P0** — Manifest claims a persona/entity but no script produces it.
- **P1** — Script seeds entities the manifest doesn't claim OR manifest claims an insert that does not exist in code.
- **P2** — Persona / scenario / row-count mismatch (count drift).
- **P3** — Naming drift, mtime advisory, map dup, etc.

Carried-from-prior-run RESOLVED P1s are re-verified below (insert sites grep-confirmed at exact line numbers under HEAD `3f0dae76`).

## Summary

| Metric | Count |
|---|---|
| Manifest entity-inventory rows verified | 27 / 27 reach a seed insert |
| Manifest persona claims verified | 9 personas fully scripted + 1 platform_admin count drift |
| **Manifest coverage (tables)** | **117 / 122 non-auth tables** seeded via direct `.insert(...)`, raw `INSERT INTO`, or `SeedClient.post(...)` = **95.9%** |
| Tables intentionally empty in dev (runtime-populated, manifest declares) | 4 (`booking`, `institutional_membership`, `seat_allocation`, `email_suppression`) |
| Tables created at runtime by Better-Auth signup (manifest declares) | 1 (`membership_application`) |
| Total schema tables | 129 (122 non-auth + 7 better-auth managed by auth lib) |
| **P0** | **0** |
| **P1** | **0** (both prior P1s RESOLVED in HEAD — carried below) |
| **P2** | **1** (`platform_admin` count drift, unchanged since Wave 57) |
| **P3** | **3** (mtime informational, naming, map dup) |
| **Verdict** | **PASS** |

Per Step 6 gate mapping (P0 → BLOCK, P1 → WARN, P2/P3 → advisory): **PASS**.

## Findings (P0 first)

| ID | Severity | Entity / Topic | Manifest claim | Script reality | Suggested fix |
|---|---|---|---|---|---|
| SC-P1-001 | ~~P1~~ → **RESOLVED (carried)** | Coverage claim "110/110 tables seeded" was unverifiable | Old claim: "Total defined tables: 110. Seeded: 110 (100%)." | Manifest §Entity Inventory rewritten to "**117 of 122 non-auth tables receive direct or API-mediated inserts (95.9%). 4 are intentionally empty in dev (user-generated runtime data) and 1 (`membership_application`) is created at runtime by Better-Auth signup**." Denominator and numerator now both reconcile to `CODE_DATA_MODEL.json`. | None — verified in current manifest. |
| SC-P1-002 | ~~P1~~ → **RESOLVED (carried)** | `dunning_template`, `billing_config`, `document_version` were imported but never inserted | Implied seeded under Entity Inventory rows for billing/dues infra + documents | Re-verified at HEAD `3f0dae76`: `services/api-ts/src/seed/layer-4-cross-module.ts:400` inserts `dunningTemplates` (5 stages inside `seedDunningEventsAndAudit`); `layer-4-cross-module.ts:321` inserts `billingConfigs` (1 stripe test-mode row inside `seedBilling`); `layer-4-cross-module.ts:186` inserts `documentVersions` (1 v1 per seeded document inside `seedDocuments`). Companion `timeSlots` insert confirmed at `seed/layer-7-misc.ts:319` (8 bookable half-hour slots). Each insert is guarded with an existence-check for idempotency. | None — all four inserts present. |
| SC-P2-001 | P2 | `platform_admin` row count | Entity Inventory: "platform_admin \| 4 \| Layer 2 + Layer 7 platform"; Migration Drift §Result spot-check: "platform_admin=4" | `seed/layer-2-users.ts:74` inserts 1 (president as `super`); `seed/layer-2-users.ts:488` loops a 2-row `platformRoles` array (`support-admin@`, `viewer@`) → **3 distinct platform_admin rows**, not 4. `Layer 7 platform` (`seed/layer-7-platform.ts`) inserts impersonation/audit/etc. rows but no additional `platformAdmins`. | Either (a) add a 4th `platformRoles` entry in `layer-2-users.ts` (e.g., an `auditor@` row) OR (b) correct manifest Entity Inventory + Migration Drift spot-check from `4` to `3`. |
| SC-P3-001 | P3 | Manifest `generated:` frontmatter vs file mtime | Frontmatter `generated: 2026-05-30T00:00:00Z`; section "2026-05-31 Delta" appended without bumping frontmatter | Manifest mtime is `2026-06-03 09:06 +0800` (above resolution dates in the inline delta) | Bump frontmatter `generated:` to `2026-06-02T00:00:00Z` (the date the Wave 57 fix landed) or add a `last_modified:` field to the YAML. Informational only — does not affect coherence. |
| SC-P3-002 | P3 | Naming drift on the camelCase ↔ snake_case axis | Manifest writes table names as `dunning_template`, `billing_config`, `document_version`, `time_slot` (snake_case) | Seed code imports the Drizzle table objects as `dunningTemplates`, `billingConfigs`, `documentVersions`, `timeSlots` (camelCase, plural) | Cosmetic only — Drizzle generates snake_case DDL from camelCase table objects; both surfaces are correct in their own context. Document the convention once in §Stack Detection. |
| SC-P3-003 | P3 | `CODE_DATA_MODEL.json` table dedup | Map reports 129 distinct tables; some Drizzle schema files re-export shared tables (e.g., `featureFlags`) which earlier map builds counted twice | Current map@3f0dae76 already dedups to 129 — historical advisory only | None — closed in current map. Keep advisory entry until next map regen confirms zero re-dup regressions. |

## Persona Coverage

Static persona resolution: every named persona function in `seed/layer-2-users.ts` was matched to a manifest scenario row and confirmed to call `.insert(persons)` + `.insert(memberships)` + (where applicable) `.insert(platformAdmins)`.

| Persona group | Manifest expected | Script reality (Layer 2 inserts) | Status |
|---|---|---|---|
| `president` | 1 (Maria; super platform_admin + association:admin) | `seedPresident` inserts 1 person + 1 membership + 1 `platformAdmins` (`super`) at `layer-2-users.ts:74` | OK |
| `officer` (treasurer / secretary / VP / board / staff via `seedOfficer` + `seedMissingRoles`) | 5 from OFFICERS array | `seedOfficer` loop over `OFFICERS` (5) + `seedMissingRoles` extras | OK |
| `member` | 31 from MEMBERS array | `seedMember` loop over `MEMBERS` (31) | OK |
| `applicant` (pending + rejected) | 2 from APPLICANTS array | `seedApplicant` loop over `APPLICANTS` (2) | OK |
| `idor_officer` (security fixture) | implicit (per scenario index) | `seedIdorOfficer` 1 row | OK |
| `platform_admin support / viewer` | 2 in `platformRoles` loop | `seedMissingRoles` → loop at `layer-2-users.ts:488` | OK |
| `platform_admin` TOTAL | **4** (Entity Inventory) | **3** (1 super + 2 loop) | **DRIFT — see SC-P2-001** |
| `vendor` / `advertiser` (M14 marketplace) | per Entity Inventory rows | `seedMiscCoverage` + `seedPlatformCoverage` insert `vendors`, `advertisers`, `royaltySplits` | OK |
| `committee` member | per `seedCommittees` | `layer-4-cross-module.ts` inserts `committees` + `committeeMembers` + `committeeTasks` | OK |
| `org` / `chapter` baseline | foundation set | `bootstrapDB` (Layer 1) + `seedRelationalData` inserts `organizations`, `chapterAffiliations`, `chapterSnapshots` | OK |

Persona resolution: **9/9 persona groups + 3/4 platform_admins (rolls up to the single P2 above).**

## Entity Coverage Cross-Walk (spot-check)

`grep -rEho '\.insert\(([a-zA-Z_]+)' services/api-ts/src/seed/ services/api-ts/src/seed.ts` returned **114 distinct camelCase table identifiers** at HEAD `3f0dae76`, mapping to 117 of 122 non-auth schema tables (a small number of tables are seeded indirectly via API `SeedClient.post(...)` rather than direct Drizzle inserts — e.g., person/membership writes flowing through the auth + application handlers).

Manifest-claimed Entity Inventory rows (27 rows) → all 27 have a matching insert site grep-located. The four "intentionally empty in dev" tables (`booking`, `institutional_membership`, `seat_allocation`, `email_suppression`) are explicitly declared empty in the manifest and their absence from the insert grep is **expected**, not a finding.

## Carried-RESOLVED Block

For traceability across the regeneration, the two prior P1 drivers — both resolved in HEAD `3f0dae76` — are re-verified here:

```
SC-P1-001: coverage denominator coherent
  - Manifest §Entity Inventory header reads "117 of 122 non-auth tables receive direct or API-mediated inserts (95.9%)"
  - 4 intentionally-empty tables declared by name
  - 1 better-auth-runtime table (membership_application) declared by name
  - Denominator (122) matches CODE_DATA_MODEL.json non-auth count under map@3f0dae76
  → VERIFIED RESOLVED

SC-P1-002: dunning_template / billing_config / document_version inserts present (HEAD 3f0dae76 grep)
  - dunningTemplates  → services/api-ts/src/seed/layer-4-cross-module.ts:400  (5 stages in seedDunningEventsAndAudit)
  - billingConfigs    → services/api-ts/src/seed/layer-4-cross-module.ts:321  (1 stripe test-mode row in seedBilling)
  - documentVersions  → services/api-ts/src/seed/layer-4-cross-module.ts:186  (1 v1 per seeded document in seedDocuments)
  - timeSlots         → services/api-ts/src/seed/layer-7-misc.ts:319          (8 bookable half-hour slots, companion fix)
  - All four wrapped in existence-check for idempotency
  → VERIFIED RESOLVED
```

## BR-Linkage Verification (carried from Manifest §"2026-05-31 Delta")

| BR | Required fixture | Seed site | Status |
|---|---|---|---|
| BR-24 (refund window) | refunded `duesPayments` row with `refundedAt` timestamp | `seedFinanceDeepFill` (Layer 5) | OK — present |
| BR-28 (CPD audit) | `quizAttempts` + `courseEnrollments` with completion proof | `seedCredits` + `seedCpdBackfill` | OK — present |
| BR-44 (announcement scheduling) | `announcements` with future `scheduledAt` | `seedAnnouncements` + `seedCommsCoverage` (Layer 7) | OK — present |

## Static-mode Confidence

- **HIGH** for entity-existence claims (every Entity Inventory row → matching insert site grep-located at file:line under HEAD `3f0dae76`).
- **MEDIUM** for row-count claims (manifest spot-counts like `feed_post=6`, `payment_token=3` are inferred from loop bounds in seed code; not statically falsifiable without a runtime DB query).
- **LOW** for filter-mismatch / role-gate findings (the "page is empty despite DB rows" failure modes per the dimension's §Why this exists table — require runtime replay; explicitly deferred until `--boot` is requested OR `auto_run_tier_1_2` is enabled in `.oli/config.json`).

## Verdict

**PASS** — 0 P0, 0 P1, 1 P2 (`platform_admin` count drift — unchanged since Wave 57), 3 P3 (mtime, naming, map dup — all advisory). Zero source delta between map@2331bd9f and map@3f0dae76: commits `343fcf05..3f0dae76` are doc-only (`/oli-check` traceability + CSRF code-only annotation + m10/m11 API_CONTRACTS path normalization + WF-U1 ratchet-clear), with no change to `services/api-ts/src/seed/**` or `docs/product/SEED_MANIFEST.md`. Both carried RESOLVED P1s re-verified at exact line numbers in HEAD `3f0dae76` (platformAdmins:74, platformAdmins:488, dunningTemplates:400, billingConfigs:321, documentVersions:186, timeSlots:319).

Per gate mapping `P0 → BLOCK · P1 → WARN · P2/P3 → advisory`: **PASS**.

## What's Next

- **SC-P2-001 (`platform_admin` count drift):** quickest path — bump `platformRoles` to 4 in `seed/layer-2-users.ts` (add `auditor@` row) and re-run `bun run db:seed`. Alternative: amend manifest Entity Inventory + Migration Drift spot-check from `4` to `3`.
- **SC-P3-001 (manifest frontmatter mtime):** add a `last_modified: 2026-06-02T00:00:00Z` field under the YAML so future tooling can read the resolution-fix date programmatically.
- **Mode upgrade (carried from Wave 57):** when `auto_run_tier_1_2` is added to `.oli/config.json` and the seed-boot extension is exposed (CHECK_LEARNINGS row 23 currently marks this as not-yet-shipped), re-run `/oli-check --seed-coherence --boot` for the runtime replay diff (DB-rowcount vs persona-GET-count per entity, including the role-gate / filter-mismatch failure tiers this static pass cannot detect).
- **Re-run cadence:** next mandatory re-run is the next map regen or when `services/api-ts/src/seed/` commits a non-trivial delta (table add/remove, persona array reshape, or fixture rewrite).
