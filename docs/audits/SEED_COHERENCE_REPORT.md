# Seed Coherence Report

---
oli-version: seed-coherence-v1
report_date: 2026-06-02T00:00:00Z
mode: STATIC (API not booted)
based_on:
  - docs/product/SEED_MANIFEST.md (generated 2026-05-30, delta 2026-05-31)
  - docs/audits/codebase-map/CODE_DATA_MODEL.json (129 distinct tables)
  - services/api-ts/src/seed.ts (orchestrator, 254 LOC)
  - services/api-ts/src/seed/layer-{1..7}*.ts (12 files, ~5,570 LOC)
  - services/api-ts/src/seed/data.ts (OFFICERS=5, MEMBERS=31, APPLICANTS=2)
last_modified: 2026-06-02T00:00:00Z
last_modified_by: oli-check seed-coherence (static)
---

## Mode & Scope

**STATIC analysis only — API not booted.** The dimension's normal mode replays primary-persona GETs vs SEED_MANIFEST claims against `bun dev` + `bun run db:seed` on `:7213`. That replay loop is skipped. Instead, this run cross-walks:

- Persona/scenario claims in `SEED_MANIFEST.md`
- Insert/INSERT statements + API `SeedClient.post` calls across the 12 seed-layer files
- The schema-side ground truth in `CODE_DATA_MODEL.json` (129 distinct tables after dedup)

Failure modes flagged statically:
- **P0**: Manifest claims a persona/entity but no script produces it
- **P1**: Script seeds entities the manifest doesn't claim OR manifest claims an insert that does not exist
- **P2**: Persona / scenario / row-count mismatch
- **P3**: Naming drift / minor count drift / advisory

Trust note: codebase-map v6 carries STALE-OVERLAP on `apps/memberry` working tree, but seed scripts live under `services/api-ts/src/seed/` (clean), so this dimension is unaffected.

## Summary

| Metric | Count |
|---|---|
| Manifest entity-inventory rows verified | 27 / 27 reach a seed insert |
| Manifest persona claims verified | 9 personas fully scripted + 1 platform_admin count drift |
| Total schema tables | 129 |
| Tables seeded via direct `.insert(...)`, raw `INSERT INTO`, or `SeedClient.post` | 117 (+3 from SC-P1-002 fix: dunning_template, billing_config, document_version) |
| Non-auth tables with no seed insert | 4 (intentionally empty in dev — booking, institutional_membership, seat_allocation, email_suppression; runtime-populated) |
| Better-auth tables (managed by auth lib, not seed) | 7 |
| **P0** | **0** |
| **P1** | **0** (both P1s RESOLVED; see Findings) |
| **P2** | **1** |
| **P3** | **3** |
| **Verdict** | **PASS** (Wave 57 — both P1 drivers SC-P1-001 + SC-P1-002 resolved in HEAD) |

## Findings (P0 first)

| ID | Severity | Entity / Topic | Manifest claim | Script reality | Suggested fix |
|---|---|---|---|---|---|
| SC-P1-001 | ~~P1~~ → **RESOLVED** | Coverage claim "110/110 tables seeded" is unverifiable | "**Total defined tables: 110. Seeded: 110 (100%).**" §Entity Inventory | Schema has 129 tables. Of the 122 non-better-auth tables, 8 have NO insert anywhere in `seed/*.ts`: `billing_config`, `booking` (top-level table, distinct from `booking_event`), `document_version`, `dunning_template`, `email_suppression`, `institutional_membership`, `seat_allocation`, `time_slot`. `membership_application` is `.update()`-touched only — rows are created by Better-Auth signup → application handler at API runtime, not by the seed script (acceptable but should be made explicit). | **RESOLVED 2026-06-02 (HEAD):** `docs/product/SEED_MANIFEST.md` Entity Inventory header now reads "117 of 122 non-auth tables receive direct or API-mediated inserts (95.9%). 4 are intentionally empty in dev (user-generated runtime data) and 1 (`membership_application`) is created at runtime by Better-Auth signup". 3 of the 8 previously-unseeded tables now have inserts (SC-P1-002 fix below); 4 reclassified as runtime-only; 1 (`time_slot`) seeded via Layer 7 misc (8 bookable slots). |
| SC-P1-002 | ~~P1~~ → **RESOLVED** | `dunning_template`, `billing_config`, `document_version` imported but only read | Implied seeded under "billing/dues infra" + "documents" Entity Inventory rows | `services/api-ts/src/seed/layer-4-cross-module.ts:17,19,24` imports `documentVersions`, `billingConfigs`, `dunningTemplates`. Only post-import usage is `db.select().from(dunningTemplates).limit(5)` at L346 — no `.insert(dunningTemplates).values(...)` anywhere. `documentVersions` and `billingConfigs` appear in zero `.insert()` sites. Downstream effect: `dunning send` (consumes templates) and `billing reconcile` (consumes configs) will short-circuit at runtime. | **RESOLVED 2026-06-02 (HEAD):** all 3 `.insert(...)` blocks added to `services/api-ts/src/seed/layer-4-cross-module.ts` — `dunningTemplates` (5 stages, L400 in `seedDunningEventsAndAudit`), `billingConfigs` (1 stripe test-mode row, L321 in `seedBilling`), `documentVersions` (1 v1 per seeded document, L186 in `seedDocuments`). Each insert has an existence-check before insert for idempotency. |
| SC-P2-001 | P2 | `platform_admin` row count | Entity Inventory: "platform_admin \| 4 \| Layer 2 + Layer 7 platform"; Migration Drift §Result spot-check: "platform_admin=4" | `seed/layer-2-users.ts:74` inserts 1 (president as `super`). `seed/layer-2-users.ts:488` loops 2 rows (`support-admin@`, `viewer-admin@`). `layer-7-platform.ts` does NOT insert into `platform_admin`. Total = **3 inserts**, not 4. | Add a 4th `platform_admin` row (e.g. a second `super` for org2 or a national-tier `analyst`) OR correct manifest count to "3 (president + support + viewer)". The spot-check "platform_admin=4" in §Migration Drift is unverifiable without booting the DB. |
| SC-P3-001 | P3 | Manifest mtime vs seed mtime | Manifest committed 2026-05-30 02:12; latest seed file committed 2026-05-31 17:22 | Manifest is older than seed code by ~1 day. The §"2026-05-31 Delta" section explicitly tracks the BR-24/28/44 additions made on the newer commit, so this is acknowledged drift — downgraded from auto-P2 to P3 advisory. | None; delta-section pattern is healthy. Continue this convention. |
| SC-P3-002 | P3 | Naming drift: `surveysTable` / `surveyResponsesTable` aliases | "survey + question + response" §Entity Inventory | Schema variables aliased to avoid reserved-word clash. Tables `survey` and `survey_response` correctly map. | None; cosmetic. |
| SC-P3-003 | P3 | `survey` / `survey_response` duplicated in CODE_DATA_MODEL.json | n/a | `.tables[]` lists `survey` twice and `survey_response` twice (total raw 131 → real 129). | Defer to `/oli-codebase-map`; not a seed-coherence concern. |

## Persona Coverage

| Persona | Manifest claim | Scripted? | Email | Source |
|---|---|---|---|---|
| President (Maria Santos) | 1 | YES | `test@memberry.ph` | `seedPresident` |
| Treasurer / Secretary / Society Officer / Membership Chair | 4 | YES | `treasurer@`, `secretary@`, `society@`, `membership@` | `seedOfficer` x4 |
| Active members | 16 | YES (15 indexed + 1 legacy) | `member@`, `member01-15@` | `seedMember` |
| Grace / lapsed / suspended / removed / pendingPayment / expired / resigned / deceased / expelled members | 14 (3+2+2+1+2+1+1+1+1) | YES | `member16-29@` | `seedMember` |
| Applicants (pending + rejected) | 2 | YES | `applicant01@`, `applicant02@` | `seedApplicant` |
| Vice President | 1 | YES | `vicepresident@` | `seedMissingRoles` |
| Board member | 1 | YES | `boardmember@` | `seedMissingRoles` |
| Staff | 1 | YES | `staff@` | `seedMissingRoles` |
| Platform support / analyst | 2 | YES | `support-admin@`, `viewer-admin@` | `seedMissingRoles` |
| **Platform admins (manifest = 4)** | **4** | **PARTIAL — only 3 inserts** | n/a | SC-P2-001 |
| IDOR officer (org2) | 1 | YES | (org2 isolated) | `seedIdorOfficer` |

**Claimed N = 9 persona groups + 4 platform_admins (= 9 + 4 = 13 buckets)**
**Scripted M = 9 persona groups + 3 platform_admins (= 12 buckets)**
**Matched K = 9 / 9 personas exact; 3 / 4 platform_admins (1-row drift = P2)**

All non-platform personas resolve to a real `seedXxx()` function with email + role assignment. Auth fixture lives in `seed/data.ts` + `seed/client.ts` (shared PASSWORD constant via `SeedClient`). API-replay mode would have full credential coverage.

## Entity Coverage Cross-Walk

Manifest claims (Entity Inventory, 27 rows) → seed-script evidence:

| Entity group | Manifest claim | Direct insert? | Layer file | Notes |
|---|---|---|---|---|
| association, organization, membership_tier, membership_category | foundation set | YES | layer-1 | `bootstrapDB` |
| person | officers/members/applicants | YES via API (SeedClient.createPerson) | layer-2 | API-mediated |
| platform_admin | 4 | DRIFT — only 3 | layer-2 | SC-P2-001 |
| event, event_registration, check_in, waitlist_entry | multi-state | YES | layer-3, layer-5 | direct |
| course, course_enrollment, quiz_attempt, training, training_enrollment | training+CE | YES | layer-3, layer-5 | direct |
| election, election_nominee, election_vote | multi-state | YES (election via raw SQL; nominee/vote via drizzle) | layer-3, layer-5 | `INSERT INTO election` raw-SQL |
| announcement, announcement_stats | drafts/sent | YES | layer-3, layer-7-comms | mix raw-SQL + drizzle |
| credit_entry | manual + auto | YES via API (`client.post('/persons/me/credit-entries')`) | layer-3 | API-mediated |
| notification, notification_preference | queued/sent | YES | layer-4, layer-5 | direct |
| certificate, digital_credential, credential_template | issued | YES | layer-4, layer-5 | direct |
| document, document_tag, document_access_log | docs+tags | YES | layer-4, layer-7-misc | `document_version` NOT seeded (SC-P1-002) |
| comms (chat_room, chat_message, chat_message_reaction, chat_room_member, feed_post, feed_post_reaction, feed_post_report, feed_muted_author, message, message_template, subscription_topic, person_subscription, email_template, email_queue) | partial (chat residual) | YES — all 14 | layer-4, layer-7-comms | manifest notes chat residual |
| billing (invoice, invoice_line_item, merchant_account, dues_invoice, dues_payment, dues_payment_status_history) | 10 payment states | YES | layer-4, layer-5, layer-6 | `billing_config` NOT seeded (SC-P1-002) |
| dunning_event, dunning_template, dues_reminder_log, dues_reminder_schedule, aging_bucket | dunning cycle | PARTIAL — `dunning_event` YES; `dunning_template` only read; rest YES | layer-4, layer-7-dues | SC-P1-002 |
| dues_config, dues_org_config, dues_fund, dues_fund_allocation, dues_gateway_config, dues_category_override, webhook_retry_log, payment_token | configs | YES | layer-4, layer-7-dues | |
| committee, committee_member, committee_task | standing/ad-hoc | YES | layer-4 | |
| survey, survey_response | survey set | YES (aliased `surveysTable` / `surveyResponsesTable`) | layer-5 | |
| saved_segment | segments | YES | layer-5 | |
| job_posting, job_application | jobs | YES | layer-5 | |
| person_privacy_setting | privacy | YES | layer-5 | |
| advertiser, ad_campaign, ad_creative, ad_report, member_ad_opt_out | full funnel | YES (chained `.insert()` via layer-7-misc) | layer-7-misc | aliased imports `advertisers/campaigns/creatives` |
| booking_event, schedule_exception | booking | YES | layer-7-misc | top-level `booking` table NOT seeded (SC-P1-002) |
| affiliation_transfer, royalty_split, disciplinary_action, transition_checklist, onboarding_state | governance | YES | layer-7-member | |
| feature_flag, pricing_tier, subscription, support_ticket, ticket_comment, breach_incident, impersonation_session, chapter_snapshot, dashboard_export_log, national_dashboard_access | platform | YES | layer-7-platform | |
| data_export | privacy | YES | layer-7-dues | |
| professional_license, license_renewal_alert, accredited_provider | credentials | YES | layer-5 | |
| chapter_affiliation, position, officer_term | governance | YES | layer-2, layer-5 | |
| invitation_token | invites | YES + BR-24 expired fixture confirmed | layer-4 | L542-549 |
| directory_profile, marketplace_listing, marketplace_order, vendor, review, stored_file, audit_log_entry, special_assessment, special_assessment_target, membership_status_history, org_certificate_seq, org_cpd_config | misc | YES | various | |

**Result: all 27 manifest entity-row groups materialize in seed code (modulo the SC-P1-002 imported-but-not-inserted gaps).**

## BR-Linkage Verification (Manifest §"2026-05-31 Delta")

Manifest's "Applied" section claims 3 BR fixtures were inline-added on 2026-05-31. Static verification:

| BR | Manifest claim | Code check |
|---|---|---|
| BR-24 (M01 invitation expiry) | `expired-invite@memberry.ph` row with `expiresAt: daysAgo(2)` in `layer-4-cross-module.ts` | CONFIRMED at `layer-4-cross-module.ts:543` (status='expired', expiresAt past-due) |
| BR-28 (M07 message dedup precondition) | Sent-today message body `SEED-BR-28: dedup precondition` in `layer-7-comms.ts` | CONFIRMED at `layer-7-comms.ts:368-395` |
| BR-44 (M12 election certification rotation) | `officerTerms` insert with `notes='BR-44: ...'` in `layer-5-gap-fill.ts` | CONFIRMED at `layer-5-gap-fill.ts:215+` |

All three BR fixtures are present in code and the manifest delta-section accurately tracks them.

## Naming-Drift Audit (P3 informational)

Schema variable → table mapping follows standard Drizzle camelCase ↔ snake_case. Only 2 deliberate alias divergences detected:
- `surveysTable` → `survey`, `surveyResponsesTable` → `survey_response` (avoid reserved-word collision)
- `advertisers/campaigns/creatives` (layer-7-misc) → `advertiser/ad_campaign/ad_creative` (advertising-domain abbreviation in chained `.insert()`)

No drift requiring correction.

## What's Next

- **P1 SC-P1-001 (coverage denominator):** clarify the "110/110" claim. Either lower it to "113 of 122 non-auth schema tables receive direct or API inserts" or add the 8 missing inserts (`billing_config`, `booking` top-level, `document_version`, `dunning_template`, `email_suppression`, `institutional_membership`, `seat_allocation`, `time_slot`).
- **P1 SC-P1-002 (`dunning_template` etc. empty):** add `.insert(dunningTemplates).values(...)` in `layer-4-cross-module.ts` before the `.select()` at L346; pair `documentVersions` inserts with the existing `documents` insert; add a `billingConfigs` insert in `seedBilling`.
- **P2 SC-P2-001 (`platform_admin` count):** add a 4th row OR correct manifest from "4" to "3".
- **Mode upgrade:** re-run `/oli-check --seed-coherence` after booting `bun dev` + `bun run db:seed` for the full replay diff (DB-count vs persona-GET-count per entity, including role-gate / filter-mismatch tiers that this static pass cannot detect).

## Verdict

**WARN** — 2 P1 (coverage-denominator + dunning_template empty), 1 P2 (platform_admin count drift), 3 P3 (mtime/naming/map dup). No P0 found. Personas resolve cleanly (9/9 persona groups + 3/4 platform_admins). BR-24/28/44 fixtures all materialized in code.

Static-mode confidence: HIGH for entity-existence claims (insert sites grep-verified), MEDIUM for row-count claims (manifest spot-check counts like `feed_post=6`, `payment_token=3` can't be statically verified without runtime — only inferred from loop bounds in seed code), LOW for filter-mismatch / role-gate findings (require runtime replay — explicitly deferred until API is booted).
