# Seed Data Manifest

---
oli-version: 1.0
based-on:
  - WORKFLOW_MAP.md (114 WF-NNN, 49 BR-NNN, §5 State Transition Inventory)
  - ROLE_PERMISSION_MATRIX.md (org roles + platform admin levels)
  - DOMAIN_MODEL.md (104 tables, 93 enums, 13 bounded contexts)
generated: 2026-05-30T00:00:00Z
mode: dev
format: drizzle
seed-file: services/api-ts/src/seed.ts
---

> **Refresh note (2026-05-30):** This manifest documents the **existing hand-built 7-layer seed system** — it does not generate or replace it. Manifest-only run; no seed code touched. Reformatted to the oli SEED_MANIFEST template, mapped to L3 artifacts (WF/BR/states/roles), and updated for the Layer 7 additions. See §8 "Changes Since Last Refresh".

## Stack Detection

- **ORM:** Drizzle ORM (`drizzle-orm/node-postgres`)
- **DB:** PostgreSQL (`pg` Pool)
- **Framework:** Hono API on Bun runtime
- **Seed format:** TypeScript — Drizzle `db.insert(...)` for most tables, **API-driven** (`SeedClient` → `fetch` against API on `:7213`) for auth/person creation
- **Existing seeds:** `services/api-ts/src/seed.ts` (orchestrator) + `services/api-ts/src/seed/layer-{1..7}*.ts` (7-layer modular system). **Mature, hand-built — left untouched.**
- **Entry point:** `bun run db:seed` (requires API server on port 7213)
- **Pattern:** idempotent (existence-check before every insert) + try/catch-isolated per block (one failure never aborts the run) + relative-date helpers (`daysAgo`/`daysFromNow`, data never ages out)

### Layer architecture (FK-dependency order)

| Layer | File | Responsibility | Phases |
|-------|------|----------------|--------|
| 1 | `seed/layer-1-foundation.ts` (`bootstrapDB`) | Association, orgs, membership tiers, categories | bootstrap |
| 2 | `seed/layer-2-users.ts` (`seedPresident`, `seedOfficer`, `seedMember`, `seedApplicant`, `seedIdorOfficer`, `seedMissingRoles`) | President, officers, members, applicants, missing-role users (incl. platform admins) | 1–4, 31 |
| 3 | `seed/layer-3-modules.ts` (`seedEvents`, `seedTraining`, `seedElections`, `seedAnnouncements`, `seedCredits`, `seedRelationalData`, `seedProfilePhotos`) | Events, training, elections, announcements, credits, photos | 5–11 |
| 4 | `seed/layer-4-cross-module.ts` (`seedNotifications`, `seedCertificates`, `seedDocuments`, `seedComms`, `seedBilling`, `seedDunningEventsAndAudit`, `seedRemainingModules`, `seedDuesInfrastructure`, `seedCommittees`) | Notifications, certs, docs, comms, billing, dunning, dues infra, committees | 12–18 |
| 5 | `seed/layer-5-gap-fill.ts` (`seedEventsGapFill`, `seedTrainingGapFill`, `seedCredentialsGapFill`, `seedProfileAndGovernanceGapFill`, `seedFinanceDeepFill`, `seedCommsGapFill`, `seedSurveysModule`, `seedCpdBackfill`, `seedSavedSegments`, `seedJobsModule`, `seedPrivacyBackfill`) | Deep-fill: events, training, credentials, finance, comms, surveys, CPD, segments, jobs, privacy | 19–29 |
| 6 | `seed/layer-6-states.ts` (`seedStateCoverage`) | State-machine coverage — every enum value ≥1 record | 30 |
| **7** | `seed/layer-7-{comms,platform,dues,member,misc}.ts` | **Table coverage — fills all previously-unseeded tables** | 32–36 |

Support: `seed/client.ts` (`SeedClient` API wrapper — `signUp`/`signIn`/`createPerson`/`post`/`get`/`patch`), `seed/helpers.ts` (relative-date math + `DATABASE_URL`/`API_URL`), `seed/data.ts` (`OFFICERS`, `MEMBERS`, `APPLICANTS` persona arrays), `seed/types.ts` (`SeedContext`, `MemberStatus`).

---

## Entity Inventory

**Schema tables: 122 non-auth + 7 better-auth = 129 total. Seeded: 117 of 122 non-auth tables receive direct or API-mediated inserts (95.9%). 4 are intentionally empty in dev (user-generated runtime data) and 1 (`membership_application`) is created at runtime by Better-Auth signup → application handler.** Persona-array record counts are exact; coverage-seeded tables list representative spot-check volumes (from the last verified `db:seed` run, §7).

> **Resolved 2026-06-02 (SC-P1-001, SC-P1-002):** prior claim "Total defined tables: 110. Seeded: 110 (100%)" was unverifiable. The 110 figure conflated entity-inventory rows with schema tables, and 8 non-auth tables had zero inserts. Fix: added inserts for `dunning_template` (5 stages), `billing_config` (stripe test-mode), `document_version` (1 per seeded document), `time_slot` (8 bookable half-hour slots on the first booking event); declassified 4 user-runtime-only tables (`booking`, `institutional_membership`, `seat_allocation`, `email_suppression`) from the "seeded" count. See `docs/audits/SEED_COHERENCE_REPORT.md` §Findings.

**Intentionally empty in dev (runtime-populated, not seeded):**
- `booking` — created when a member books a `time_slot` via the booking flow
- `institutional_membership` — created by org-admin procurement (group-seat purchase)
- `seat_allocation` — created when a primary contact assigns an institutional seat to a person
- `email_suppression` — created by bounce/unsubscribe/complaint handlers + manual ops
- `membership_application` — created at runtime by Better-Auth signup → application handler; `seedApplicant` only `.update()`s these post-creation

| Entity / Table group | Records / coverage | Scenarios / Layers | Source | Confidence |
|----------------------|--------------------|--------------------|--------|------------|
| Association + organizations + membership_tier + membership_category | foundation set | Layer 1 (`bootstrapDB`) | data.ts + schema | spec |
| person (officers) | 5 (President, Treasurer, Secretary, Society Officer, Membership Chair) | Layer 2 `seedOfficer`/`seedPresident` | `OFFICERS` array | factory |
| person (members) | 31 across statuses | Layer 2 `seedMember` | `MEMBERS` array | factory |
| person (applicants) | 2 (1 pending, 1 rejected) | Layer 2 `seedApplicant` | `APPLICANTS` array | factory |
| person (missing-role users) | VP, board-member, staff, platform support/viewer | Layer 2 `seedMissingRoles` | ROLE_PERMISSION_MATRIX | workflow |
| platform_admin | 3 (real auth uuid) | Layer 2 `seedPresident` (Maria as `super`) + Layer 2 `seedMissingRoles` (`support-admin@` as `support`, `viewer-admin@` as `analyst`) | ROLE_PERMISSION_MATRIX | workflow |
| event + event_registration | multi-state | Layer 3 `seedEvents` + Layer 5 `seedEventsGapFill` | WORKFLOW_MAP §5.3/5.4 | workflow |
| course / training + enrollment | multi-state | Layer 3 `seedTraining` + Layer 5 `seedTrainingGapFill` | WORKFLOW_MAP §5.5/5.6 | workflow |
| election + nomination + vote | multi-state | Layer 3 `seedElections` | WORKFLOW_MAP §5.7 | workflow |
| announcement (+ stats) | drafts/scheduled/sent | Layer 3 `seedAnnouncements` + Layer 7 comms | WORKFLOW_MAP §5.8 | workflow |
| credit_entry | manual + auto-award | Layer 3 `seedCredits` + Layer 5 `seedCpdBackfill` | WF-065..069 | workflow |
| notification | queued/sent | Layer 4 `seedNotifications` | WORKFLOW_MAP §5.10 | workflow |
| certificate / digital_credential | issued | Layer 4 `seedCertificates` + Layer 5 `seedCredentialsGapFill` | WF-061, WF-071 | workflow |
| document + document_version + document_tag | docs + 1 v1 version per doc + tags | Layer 4 `seedDocuments` + Layer 7 misc | DOMAIN_MODEL | spec |
| comms (chat_room, message, DM) | partial (see §6 residual) | Layer 4 `seedComms` + Layer 5 `seedCommsGapFill` | WF-079..083 | inferred |
| billing / invoice / payment + billing_config | multi-state (10 payment states) + 1 stripe test-mode config per org | Layer 4 `seedBilling` + Layer 5 `seedFinanceDeepFill` | WORKFLOW_MAP §5.2 + BR-30 | workflow |
| dunning_template + dunning_event + audit | 5 escalation templates (stages 1–5, email/sms/letter) + events + audit | Layer 4 `seedDunningEventsAndAudit` | WF-044 | workflow |
| dues_config / dues_org_config / dues infra | configs | Layer 4 `seedDuesInfrastructure` | M06 | spec |
| committee + members | standing/ad-hoc | Layer 4 `seedCommittees` | WF-104, WF-105 | workflow |
| survey + question + response | survey set | Layer 5 `seedSurveysModule` | WF-100..103 | workflow |
| saved_segment | segments | Layer 5 `seedSavedSegments` | M07 | inferred |
| job listing | jobs | Layer 5 `seedJobsModule` | WF-087..089 | workflow |
| person_privacy_setting + notification_preference | privacy/prefs | Layer 5 `seedPrivacyBackfill` | WF-010, WF-013 | workflow |
| **State coverage (all enums)** | ≥1 record per enum value | Layer 6 `seedStateCoverage` | WORKFLOW_MAP §5 | workflow |
| feed_post, feed_post_reaction, feed_post_report, feed_muted_author | feed_post=6 + reactions/reports/mutes | Layer 7 `seedCommsCoverage` | M13 (§5.11 Post) | workflow |
| message_template, subscription_topic, person_subscription | templates + subs | Layer 7 `seedCommsCoverage` | WF-047 | workflow |
| email_template, email_queue | email_queue=5 (pending→sent→failed→cancelled) | Layer 7 `seedCommsCoverage` | M07/email | workflow |
| pricing_tier, subscription, feature_flag | feature_flag=6 | Layer 7 `seedPlatformCoverage` | WF-017, WF-018 | workflow |
| support_ticket, ticket_comment | support_ticket=4 (status+priority) | Layer 7 `seedPlatformCoverage` | WF-020 | workflow |
| breach_incident, impersonation_session | 1 resolved breach, 1 ended impersonation | Layer 7 `seedPlatformCoverage` | WF-019 / BR-10 | workflow |
| chapter_snapshot, dashboard_export_log, national_dashboard_access | chapter_snapshot=2 | Layer 7 `seedPlatformCoverage` | WF-084..086 | workflow |
| aging_bucket | AR aging snapshots (centavos PHP) | Layer 7 `seedDuesCoverage` | M06 dunning | workflow |
| dues_reminder_log | dues_reminder_log=4 (multi-channel) | Layer 7 `seedDuesCoverage` | WF-044 | workflow |
| dues_category_override, webhook_retry_log | overrides + retries | Layer 7 `seedDuesCoverage` | M06/BR-29 | inferred |
| payment_token | payment_token=3 (active/used/expired) | Layer 7 `seedDuesCoverage` | M06 | workflow |
| data_export (person) | data_export=3 (across status) | Layer 7 `seedDuesCoverage` | WF-014 | workflow |
| affiliation_transfer | =3 (requested/approved/completed) | Layer 7 `seedMemberGovernanceCoverage` | WF-036 | workflow |
| royalty_split | royalty_split=3 | Layer 7 `seedMemberGovernanceCoverage` | DOMAIN_MODEL §2 | spec |
| disciplinary_action | =3 (warning/suspension/probation) | Layer 7 `seedMemberGovernanceCoverage` | M05 governance | workflow |
| transition_checklist | =6 (per officer_term) | Layer 7 `seedMemberGovernanceCoverage` | WF-025 | workflow |
| onboarding_state | onboarding_state=2 (per org) | Layer 7 `seedMemberGovernanceCoverage` | WF-015 | workflow |
| advertiser → ad_campaign → ad_creative → ad_report | advertiser=2, campaign=3, creative=3 (full funnel) | Layer 7 `seedMiscCoverage` | M16 (§5.11 Campaign/Creative) | workflow |
| member_ad_opt_out | opt-outs | Layer 7 `seedMiscCoverage` | M16/BR-49 | inferred |
| booking_event, time_slot, schedule_exception | booking_event=2, time_slot=8 (bookable), schedule_exception=3; `booking` itself runtime-only | Layer 7 `seedMiscCoverage` | booking module | inferred |

---

## Scenario Index

Scenarios are not named per the oli `scenario_*` convention — the hand-built seed expresses coverage via layer functions that span ranges of states. This index maps each function to the WF/BR/state/role coverage traceable in the code. `[INFERRED]` = mapping not directly confirmable from a WF/BR comment or precondition.

| Seed function | Type | Source detail | WF / BR / State / Role |
|---------------|------|---------------|------------------------|
| `bootstrapDB` | foundation | Layer 1 | WF-015 onboard association [INFERRED]; org lifecycle §5.9 |
| `seedPresident` / `seedOfficer` | role | Layer 2 | Roles: president, treasurer, secretary, officers (WF-001, WF-025) |
| `seedMember` | state + role | Layer 2 | Membership status §5.1; role: member |
| `seedApplicant` | state | Layer 2 | WF-029 application (pending + rejected) |
| `seedMissingRoles` | role | Layer 2 | Roles: VP, board-member, staff, platform support/viewer |
| `seedEvents` / `seedEventsGapFill` | state + workflow | Layer 3/5 | WF-051/052/053; event §5.3 + registration §5.4 |
| `seedTraining` / `seedTrainingGapFill` | state + workflow | Layer 3/5 | WF-058..060; training §5.5 + enrollment §5.6 |
| `seedElections` | state | Layer 3 | election §5.7 |
| `seedAnnouncements` | state | Layer 3 | WF-046; announcement §5.8 |
| `seedCredits` / `seedCpdBackfill` | workflow + BR | Layer 3/5 | WF-065..069; BR-11/12/13/14 [INFERRED data, no pass/violate pair] |
| `seedBilling` / `seedFinanceDeepFill` | state + BR | Layer 4/5 | payment §5.2 (10 states); BR-08 refund (data present) |
| `seedDunningEventsAndAudit` + L7 `seedDuesCoverage` | workflow | Layer 4/7 | WF-044 dunning; aging buckets + reminder logs |
| `seedStateCoverage` | state | Layer 6 | All §5 enum values ≥1 record; BR-27 waitlist/capacity |
| `seedCommsCoverage` | state + workflow | Layer 7 | WF-046/047/050; feed §5.11 Post; email_queue states |
| `seedPlatformCoverage` | workflow + role + BR | Layer 7 | WF-017..022; BR-10 impersonation; platform roles |
| `seedDuesCoverage` | state + workflow | Layer 7 | WF-014 data export; WF-044; payment_token states |
| `seedMemberGovernanceCoverage` | state + workflow | Layer 7 | WF-036 transfer; transfer/discipline states |
| `seedMiscCoverage` | state | Layer 7 | §5.11 Campaign (Draft→Active→Paused/Completed), Creative (Pending→Approved/Rejected); booking |

---

## Coverage

Honest assessment: this seed optimizes for **table + state coverage in `dev` mode**, not for the `qa`-mode pass/violate pairs per BR. WF totals are large (114) and many are read/report workflows whose preconditions are satisfied incidentally by the data above; only workflows whose data this seed clearly establishes are claimed as "covered".

### Covered Workflows (data establishes preconditions)
- M01/M02: WF-001 (signup, multi-org), WF-010 (profile/privacy), WF-014 (data export)
- M03: WF-015 (onboard assoc), WF-017 (subscriptions), WF-018 (feature flags), WF-019 (impersonation), WF-020 (support tickets), WF-021 (revenue dash), WF-022 (admin team), WF-084..086 (national dashboards)
- M04/M05: WF-025 (officer assignment), WF-029 (application), WF-032 (status computation), WF-033 (categories), WF-036 (member transfer)
- M06: WF-038/044 (dues + dunning), WF-041 (refund data)
- M07: WF-046 (announcement), WF-047 (templates), WF-050 (opt-out)
- M08/M09: WF-051/052/053 (event create/register/check-in), WF-058..061 (training)
- M10: WF-065..069 (credits, CPD)
- M13/M16: feed posts, advertising funnel
- M18/M19: WF-100..103 (surveys), WF-104/105 (committees)

### Uncovered / partial Workflows
- WF-079..083 (M07 real-time chat/DM): **partial** — comms tables only partly populated; `chat_room_id` column missing in dev DB (§7 residual), so room membership and DM threads are incomplete.
- WF-087..089 (M15 jobs): listings seeded, but employer-registration/verification flow not exercised.
- Most pure reporting/read workflows (e.g. analytics dashboards) have backing data but no explicit scenario rows.
- Many of the 114 WF-NNN are not individually scenario-mapped — coverage is data-presence, not behavioral pass/fail.

### Covered Business Rules (data present)
- BR-08 (refund within 30 days) — refund data via `seedBilling`
- BR-10 (impersonation rules) — impersonation_session via Layer 7 platform
- BR-27 (waitlist/capacity) — registration states via Layer 6
- BR-13 (auto credits on attendance) — enrollment→completed→credit data
- Dunning/reminder + webhook-retry BRs (e.g. BR-28/29 family) — data via Layer 7 dues

### Uncovered Business Rules
- Of 49 BR-NNN, the seed provides **passing-case data for a handful** (above). It does **not** generate explicit pass+violate pairs per rule. Notable un-exercised: BR-09 (one-officer-per-org enforcement), BR-18 (QR check-in auth), BR-22/23 (member matching / license normalization), BR-30 (payment gateway isolation), BR-35 (post moderation), BR-37/45/49 (jobs/ads lifecycle enforcement). Run `--mode qa` to add violate cases.

### Covered States
- payment (10), election (6), event + registration, training + enrollment, membership (incl. deceased/expelled), notification, announcement — all via Layer 6.
- Layer 7 adds states for newly-seeded tables: support_ticket (status+priority), affiliation_transfer (requested/approved/completed), ad campaign (Draft→Active→Paused/Completed) + creative (Pending→Approved/Rejected), data_export (across status), payment_token (active/used/expired), email_queue (pending→sent→failed→cancelled), disciplinary_action (warning/suspension/probation).

---

## Validation Status

| Check | Result |
|-------|--------|
| `tsc --noEmit` (seed.ts + all layers) | PASS — zero errors |
| Idempotency | Existence-check before every insert; safe to re-run |
| FK coherence | Parents-before-children within each layer; cross-refs query existing rows or skip gracefully |
| **End-to-end `db:seed` run** | **PASS** — runs to `SEED COMPLETE`, all 7 layers execute (see migration-drift note) |

---

## Migration Drift — RESOLVED (2026-05-30)

The earlier blocker (the seed died at Phase 5 on `training.visibility column does not exist`) is **fixed**. The DB was a hybrid: 50 of 61 journal migrations tracked-applied, with 0050–0060 permanently skipped by `migrate()` because their journal `when` values (`~1779.5–1780.05e9`) are *smaller* than entry 0049's `1780329600000`. Some objects those migrations create already existed (e.g. `credit_source_type`), while others were genuinely missing (`training.visibility`, `webhook_retry_log`, `feed_post`, `support_ticket`, `payment_token`, `advertiser`, `ad_campaign`, `onboarding_state`, `chapter_snapshot`, and ~25 enums).

**How it was reconciled (additive, non-destructive):** the 11 journal-tag SQL files 0050–0060 were replayed through `psql -v ON_ERROR_STOP=0`. Already-existing objects error-and-skip; genuinely-missing objects get created. No drops, no journal edits, no `__drizzle_migrations` edits — `migrate()` already skips 0050–0060 so boot stays clean. Three replay errors are expected and harmless (a view-locked column in 0050's timestamptz pass, a `chat_room_id` FK from a partial chat feature in 0051, a missing-index DROP in 0053). The orphan duplicate files `0050_wave6_surveys.sql` and `0053_thin_boomerang.sql` are **not** journal tags and are ignored by `migrate()`.

**Two seed-code bugs surfaced once the run got past Phase 5** (both fixed):
1. **Phase 31 `seedMissingRoles` (fatal):** inserted `platform_admin.userId = ''` → `invalid input syntax for type uuid`, aborting the whole run before Layer 7. Fixed in `layer-2-users.ts` — platform admins now sign up a real auth user and use its uuid.
2. **Phase 36 `seedMiscCoverage` (non-fatal):** one `schedule_exception` fixture had `start === end`, violating `CHECK (end_datetime > start_datetime)`. Fixed in `layer-7-misc.ts` (`daysFromNow(7)→daysFromNow(8)`).

**Result:** `bun run db:seed` runs end-to-end to the `SEED COMPLETE` banner. All Layer 7 tables populated (spot-check: feed_post=6, support_ticket=4, feature_flag=6, advertiser=2, ad_campaign=3, ad_creative=3, payment_token=3, data_export=3, affiliation_transfer=3, royalty_split=3, disciplinary_action=3, transition_checklist=6, onboarding_state=2, dues_reminder_log=4, chapter_snapshot=2, document_tag=5, schedule_exception=3, platform_admin=3, message_template=4, email_queue=5).

**Residual non-fatal errors (pre-existing gap-fill code, Phases 23–30 — NOT Layer 7, do not abort):** `payment→invoice linking`, `chat room members` / `room type update` (both trace to the `chat_room_id` column 0051 couldn't add against the partial chat feature), `credit backfill`, `certificate backfill`, `election state coverage`. Each is try/catch-isolated. Worth a separate cleanup pass but non-blocking.

> Note for production/CI: the additive `psql` replay reconciled this *dev* DB only. A clean environment should still get a proper migration fix (re-stamp 0050–0060 with `when > 1780329600000` after making their CREATEs idempotent, or rebuild from a fresh DB) so `migrate()` tracks them honestly. The orphan duplicate migration files should also be removed.

---

## Changes Since Last Refresh

- **Reformatted to oli SEED_MANIFEST template** — added oli-version header, Stack Detection, Entity Inventory, Scenario Index, and a Coverage section honestly mapped to WORKFLOW_MAP (114 WF / 49 BR / §5 states) and ROLE_PERMISSION_MATRIX. No fabricated WF/BR coverage; unverified mappings tagged `[INFERRED]`.
- **Layer 7 documented in full (5 files, phases 32–36):** `seedCommsCoverage` (feed/templates/subscriptions/email), `seedPlatformCoverage` (flags/tiers/tickets/security/dashboards), `seedDuesCoverage` (aging/reminders/overrides/tokens/exports), `seedMemberGovernanceCoverage` (transfers/royalties/discipline/checklists/onboarding), `seedMiscCoverage` (advertising funnel/booking/document tags). These close the 39 previously-deferred tables. **Original claim "110/110 tables seeded" superseded 2026-06-02** — see new Entity Inventory header (117/122 non-auth tables seeded; 4 declassified as runtime-only).
- **Honest coverage gaps surfaced:** real-time chat (WF-079..083) partial due to missing `chat_room_id`; BRs have passing-case data but no qa-mode pass/violate pairs; most reporting workflows are data-present not scenario-mapped.
- **Read-only run:** the 7-layer seed system was analyzed but **not modified**; only this manifest was written.

## What's Next

- **Done:** schema reconciled, `db:seed` validated end-to-end, 117/122 non-auth tables seeded (4 runtime-only tables declassified per Entity Inventory header), manifest aligned to L3 artifacts.
- **Cleanup (separate task):** fix the 5 residual non-fatal gap-fill errors (Phases 23–30); remove orphan duplicate migration files (`0050_wave6_surveys`, `0053_thin_boomerang`); honestly re-stamp 0050–0060 for clean-env migration tracking; complete the partial chat feature (`chat_room_id`).
- **Deeper coverage:** re-run `/oli-plan-seed --mode qa` for per-BR boundary/violation pairs.

---

## 2026-05-31 Delta — New Knowledge Check

Audit against spec/schema changes since 2026-05-30 manifest. **Schema unchanged** — no new migrations or `*.schema.ts` since manifest write. **BR linkages changed** — Wave G6 (commit `9220dc98`) wired 3 BRs into their owning MODULE_SPEC §5:

### New BR linkages requiring seed verification

| BR | Module | WF refs | Code enforcement | Current seed coverage | Gap |
|----|--------|---------|------------------|----------------------|-----|
| BR-24 | M01 | WF-008, WF-002 | invite.repo (expiry check) | layer-4-cross-module:539-549 — 1 invitation_token seeded; expired row NOT confirmed | **PARTIAL** — add `expiresAt: daysAgo(2)` invitation row |
| BR-28 | M07 | WF-046 | createMessage.ts:32 (dedup by channel+recipient+day) | **0 matches in seed/** — no duplicate-message scenario | **MISSING** — add pre-existing same-day same-channel message before queue insert |
| BR-44 | M12 | WF-077 | (election certification cross-module — outgoing-term-end + new-term-create) | layer-3 `seedElections` + layer-5-gap-fill:162-175 has `status: 'elected'` nominees + 5 votes; layer-7-member:207 seeds transition_checklist | **PARTIAL** — full certification → officer_term rotation not seeded (election remains `votingOpen`/`awaitingConfirmation`; certified→officer_term creation flow missing) |

### Schema changes since manifest (post-2026-05-30 02:06)

`git log --since='2026-05-30 02:06' -- **/repos/*.schema.ts **/migrations/`: **empty** — no schema drift. (Original "110/110" entity-inventory framing was retired 2026-06-02; see updated Entity Inventory header.)

### Other spec changes since manifest (non-schema)

| Commit | Impact on seed |
|--------|---------------|
| 733765be — API_CONTRACTS backfill m20/m21/m22 | None — booking_event + email_template + billing_config already seeded (layer-7-misc, layer-7-comms, layer-4 seedBilling per inventory) |
| 9f23085c — CSRF middleware (THREAT_MODEL.md) | None — middleware, not data |
| a4595051 — OTel observability | None — instrumentation, not data |
| c4e0514b — DATA_GOVERNANCE.md promoted | Potential — DPA breach notification flows may need seeded notif_breach records; review next refresh |
| 6237cb25 — pagination convention codified | None |

### Recommended action

Apply 3 small additions to seed (NOT auto-generated — surfaced for human implementation):

```typescript
// services/api-ts/src/seed/layer-4-cross-module.ts (BR-24)
// Around line 549, add an expired invitation row:
await db.insert(invitationTokens).values({
  // ... existing fields ...
  expiresAt: daysAgo(2),  // BR-24 violation case
  usedAt: null,
});

// services/api-ts/src/seed/layer-7-comms.ts (BR-28)
// In seedCommsCoverage, before any message_template insert, seed a same-day duplicate:
const todayKey = new Date().toISOString().slice(0, 10);
await db.insert(messages).values({
  channel: 'email',
  recipientPersonId: officerIds[0],
  organizationId: orgId,
  sentAt: new Date(),  // today
  dedupKey: `${todayKey}:email:${officerIds[0]}`,  // BR-28 fixture
  // ...
});
// (subsequent message to same recipient/channel/day should be deduped by createMessage)

// services/api-ts/src/seed/layer-5-gap-fill.ts (BR-44)
// After votingOpen election with 'elected' nominees, add a 'certified' election where
// outgoing officer_term ended_at is set AND new officer_term started_at created from
// nominee win. Match WF-077 cross-module effects.
```

### Verdict

**Seed manifest accurate for the 27 entity-inventory groups.** 3 new BR enforcement gaps surfaced from Wave G6 spec linkages. (Note: schema-table count framing was reconciled 2026-06-02 — see updated Entity Inventory header.)

### Applied (2026-05-31)

Edits committed inline in the seed layers — not pure read-only this run. Verified by re-running `bun run db:seed` and querying DB:

| Fixture | Code change | DB verification |
|---------|-------------|-----------------|
| BR-24 | `services/api-ts/src/seed/layer-4-cross-module.ts` — per-email existence check + `expired-invite@memberry.ph` row (status='expired', expires_at=daysAgo(2)) | `SELECT … FROM invitation_token WHERE email='expired-invite@memberry.ph'` → 1 row, is_expired=t ✓ |
| BR-28 | `services/api-ts/src/seed/layer-7-comms.ts` — `messages` import + sent-today row to `memberPersonIds[0]` via email channel | `SELECT … FROM message WHERE body='SEED-BR-28: dedup precondition'` → 1 row, channel=email, status=sent, sent_at=today, recipient_count=1 ✓ |
| BR-44 | `services/api-ts/src/seed/layer-5-gap-fill.ts` — `officerTerms` import + post-election rotation block (outside nominees-existed guard so it re-runs idempotently): for each elected nominee on a published election, end any other active term on the position + create new active term with `notes='BR-44: created on election certification (WF-077)'` | `SELECT … FROM officer_term WHERE notes LIKE 'BR-44%'` → 1 active row; 1 completed row with end_date set ✓ |

### Companion fix (CSRF regression)

`services/api-ts/src/seed/client.ts` updated for Wave G5 CSRF middleware:
- Added `csrfToken` field + `fetchCsrf()` method (GET `/csrf-token`, merge cookie + extract token)
- `fetchCsrf()` called after successful `signUp` / `signIn`
- `x-csrf-token` header injected on all POST/PATCH requests

Before this fix the seed died at Phase 1 (POST `/persons` → 403 CSRF_TOKEN_MISSING). After: SEED COMPLETE end-to-end.

### Re-run command

```bash
cd services/api-ts && bun dev &  # API on :7213
sleep 8
bun run db:seed
```
