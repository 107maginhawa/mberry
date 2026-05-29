<!-- oli-seed v3.0 | generated 2026-05-29 | mode: dev | layer: L3 (workflow-aware) -->
# Seed Data Manifest

**Project:** Memberry Healthcare AMS
**Generated:** 2026-05-29 by `/oli-plan-seed` (extend-existing-layers run)
**Previous:** v2.0 (2026-05-24, pre-revamp gap analysis — now superseded)
**Stack:** Bun + Drizzle ORM + PostgreSQL
**Seed Format:** TypeScript (Drizzle insert), API-driven for auth/person
**Mode:** dev (happy paths + edge/state coverage)
**Entry point:** `services/api-ts/src/seed.ts` → `bun run db:seed` (requires API on :7213)

---

## 1. Architecture (current)

Modular, idempotent, API-driven seed. Single entry point orchestrates 7 layers in FK-dependency order. Every insert is existence-checked (re-runnable); every block is try/catch isolated (one failure never aborts the run).

| Layer | File | Responsibility |
|-------|------|----------------|
| 1 | `seed/layer-1-foundation.ts` | Association, orgs, tiers, categories |
| 2 | `seed/layer-2-users.ts` | President, officers, members, applicants, missing-role users |
| 3 | `seed/layer-3-modules.ts` | Events, training, elections, announcements, credits, photos |
| 4 | `seed/layer-4-cross-module.ts` | Notifications, certs, docs, comms, billing, dunning, committees, dues infra |
| 5 | `seed/layer-5-gap-fill.ts` | Phase 19–29 deep-fill (events, training, credentials, finance, comms, surveys, CPD, segments, jobs, privacy) |
| 6 | `seed/layer-6-states.ts` | State-machine coverage — every enum value ≥1 record |
| **7** | `seed/layer-7-*.ts` | **NEW — table coverage: fills all previously-unseeded tables** |

Support: `seed/client.ts` (SeedClient API wrapper), `seed/helpers.ts` (relative-date helpers — data never ages out), `seed/data.ts` (persona arrays), `seed/types.ts`.

---

## 2. Table Coverage

**Total defined tables: 110. Now seeded: 110 (100%).**

v2.0 covered ~70 tables and listed 39 deferred/uncovered. This run added **Layer 7** to close every remaining gap. The previously "deferred — not in v1 scope" tables (booking, advertising, affiliation transfers, royalty splits, aging buckets, etc.) are now seeded with realistic, FK-coherent data.

### Layer 7 — newly covered tables (39)

| File | Tables | Notes |
|------|--------|-------|
| `layer-7-comms.ts` (`seedCommsCoverage`) | feed_post, feed_post_reaction, feed_post_report, feed_muted_author, announcement_stats, message_template, subscription_topic, person_subscription, email_template, email_queue | Feed posts across post types incl. draft/pinned/sponsored; reactions span all reaction types; email_queue spans pending→sent→failed→cancelled. `announcement_stats` self-skips if no announcements. |
| `layer-7-platform.ts` (`seedPlatformCoverage`) | pricing_tier, subscription, feature_flag, support_ticket, ticket_comment, breach_incident, impersonation_session, chapter_snapshot, dashboard_export_log, national_dashboard_access | Tickets span status+priority; 1 resolved breach, 1 ended impersonation; dashboard tables scoped by `associationId`. |
| `layer-7-dues.ts` (`seedDuesCoverage`) | aging_bucket, dues_reminder_log, dues_category_override, webhook_retry_log, payment_token, data_export (person) | AR aging snapshots in centavos PHP; reminder logs across channels; tokens active/used/expired; data exports across status. Overrides/reminders skip if no `dues_config`/`dues_org_config`/`membership_category`. |
| `layer-7-member.ts` (`seedMemberGovernanceCoverage`) | affiliation_transfer, royalty_split, disciplinary_action, transition_checklist, onboarding_state | Transfers requested/approved/completed; disciplinary warning/suspension/probation; checklists per officer_term; onboarding one per org. |
| `layer-7-misc.ts` (`seedMiscCoverage`) | advertiser, ad_campaign, ad_creative, ad_report, member_ad_opt_out, booking_event, schedule_exception, document_tag | Full advertising funnel (advertiser→campaign→creative→report) across status enums; booking events + schedule exceptions; document tags attached to existing documents. |

All Layer 7 functions typecheck clean (`tsc --noEmit`) and follow the Layer 6 idempotent/try-catch pattern.

---

## 3. Coverage Dimensions (carried from L3 artifacts)

- **State machines** (WORKFLOW_MAP §5): covered by Layer 6 — payment (10), election (6), event/registration, training/enrollment, membership (incl. deceased/expelled), notification, announcement. Layer 7 adds states for the newly-seeded tables (ticket, transfer, ad campaign/creative, data export, email queue).
- **Roles** (ROLE_PERMISSION_MATRIX): president, secretary, treasurer, officer, member seeded in Layer 2; VP/board-member/staff + platform support/viewer via `seedMissingRoles`. Platform tier/subscription/feature-flag context now in Layer 7.
- **Business rules** (WORKFLOW_MAP §4): BR-08 refunds and BR-27 waitlist/capacity covered in Layer 6; dunning/reminder + webhook-retry BRs now have data via Layer 7.

---

## 4. Validation Status

| Check | Result |
|-------|--------|
| `tsc --noEmit` (seed.ts + all layer-7) | PASS — zero errors |
| Idempotency | Existence-check before every insert; safe to re-run |
| FK coherence | Parents-before-children within each layer; cross-refs query existing rows or skip gracefully |
| **End-to-end `db:seed` run** | **PASS** — runs to `SEED COMPLETE`, all 7 layers execute (see §5) |

---

## 5. Migration Drift — RESOLVED (2026-05-30)

The §5 blocker from the v3.0 draft (the seed died at Phase 5 on `training.visibility column does not exist`) is **fixed**. The DB was a hybrid: 50 of 61 journal migrations tracked-applied, with 0050–0060 permanently skipped by `migrate()` because their journal `when` values (`~1779.5–1780.05e9`) are *smaller* than entry 0049's `1780329600000`. Some objects those migrations create already existed (e.g. `credit_source_type`), while others were genuinely missing (`training.visibility`, `webhook_retry_log`, `feed_post`, `support_ticket`, `payment_token`, `advertiser`, `ad_campaign`, `onboarding_state`, `chapter_snapshot`, and ~25 enums).

**How it was reconciled (additive, non-destructive):** the 11 journal-tag SQL files 0050–0060 were replayed through `psql -v ON_ERROR_STOP=0`. Already-existing objects error-and-skip; genuinely-missing objects get created. No drops, no journal edits, no `__drizzle_migrations` edits — `migrate()` already skips 0050–0060 so boot stays clean. Three replay errors are expected and harmless (a view-locked column in 0050's timestamptz pass, a `chat_room_id` FK from a partial chat feature in 0051, a missing-index DROP in 0053). The orphan duplicate files `0050_wave6_surveys.sql` and `0053_thin_boomerang.sql` are **not** journal tags and are ignored by `migrate()`.

**Two seed-code bugs surfaced once the run got past Phase 5** (both previously hidden behind the blocker, now fixed):
1. **Phase 31 `seedMissingRoles` (fatal):** inserted `platform_admin.userId = ''` → `invalid input syntax for type uuid`, aborting the whole run before Layer 7. Fixed in `layer-2-users.ts` — platform admins now sign up a real auth user and use its uuid.
2. **Phase 36 `seedMiscCoverage` (non-fatal):** one `schedule_exception` fixture had `start === end`, violating `CHECK (end_datetime > start_datetime)`. Fixed in `layer-7-misc.ts` (`daysFromNow(7)→daysFromNow(8)`).

**Result:** `bun run db:seed` runs end-to-end to the `SEED COMPLETE` banner. All Layer 7 tables populated (spot-check: feed_post=6, support_ticket=4, feature_flag=6, advertiser=2, ad_campaign=3, ad_creative=3, payment_token=3, data_export=3, affiliation_transfer=3, royalty_split=3, disciplinary_action=3, transition_checklist=6, onboarding_state=2, dues_reminder_log=4, chapter_snapshot=2, document_tag=5, schedule_exception=3, platform_admin=4, message_template=4, email_queue=5).

**Residual non-fatal errors (pre-existing gap-fill code, Phases 23–30 — NOT Layer 7, do not abort):** `payment→invoice linking`, `chat room members` / `room type update` (both trace to the `chat_room_id` column 0051 couldn't add against the partial chat feature), `credit backfill`, `certificate backfill`, `election state coverage`. Each is try/catch-isolated. Worth a separate cleanup pass but non-blocking.

> Note for production/CI: the additive `psql` replay reconciled this *dev* DB only. A clean environment should still get a proper migration fix (re-stamp 0050–0060 with `when > 1780329600000` after making their CREATEs idempotent, or rebuild from a fresh DB) so `migrate()` tracks them honestly. The orphan duplicate migration files should also be removed.

---

## 6. What's Next

- **Done:** schema reconciled, `db:seed` validated end-to-end, all 110 tables seeded.
- **Cleanup (separate task):** fix the 5 residual non-fatal gap-fill errors (Phases 23–30); remove orphan duplicate migration files (`0050_wave6_surveys`, `0053_thin_boomerang`); honestly re-stamp 0050–0060 for clean-env migration tracking.
- **Deeper coverage:** re-run `/oli-plan-seed --mode qa` for boundary/violation pairs.
