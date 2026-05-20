---
oli-version: 1.1
based-on:
  - MODULE_SPEC m06-dues-payments v1.0
  - MODULE_SPEC m19-committee-management v1.0
  - WORKFLOW_MAP v1.0
  - ROLE_PERMISSION_MATRIX v1.0
  - Codebase audit (2026-05-20)
  - Gap-fill audit (2026-05-20)
generated: 2026-05-20
updated: 2026-05-20
mode: dev
format: drizzle (TypeScript)
seed-file: services/api-ts/src/seed-scenarios.ts
---

# Seed Data Manifest

## Stack Detection

- **ORM:** Drizzle ORM + raw SQL (mixed)
- **DB:** PostgreSQL
- **Framework:** Hono + Bun
- **Existing seeds:** `services/api-ts/src/seed-scenarios.ts` (~1,800 lines, 18 phases)
- **Run command:** `cd services/api-ts && bun run db:seed-scenarios` (requires API on port 7213)

## Entity Inventory

| Entity | Table | Records | Phase | Source |
|--------|-------|---------|-------|--------|
| Association | `association` | 1 | 0 | Schema |
| Organization | `organization` | 2 | 0 | Schema |
| Membership Tier | `membership_tier` | 4 | 0 | Schema |
| Membership Category | `membership_category` | 4 | 0 | Schema |
| Person | `person` | ~33 | 1-4 | Schema + API |
| Membership | `membership` | ~31 | 1-4 | Schema + API |
| Position | `position` | 5 | 1-2 | Schema |
| Officer Term | `officer_term` | 5 | 1-2 | Schema |
| Membership Application | `membership_application` | 2 | 4 | Schema + API |
| Platform Admin | `platform_admin` | 1 | 1 | Schema |
| Event | `event` | ~5 | 5 | Schema |
| Event Registration | `event_registration` | ~30 | 8 | Schema |
| Training | `training` | ~4 | 5 | Schema |
| Training Enrollment | `training_enrollment` | ~16 | 8 | Schema |
| Credit Entry | `credit_entry` | ~15 | 7 | API |
| Dues Payment | `dues_payment` | ~13 | 8,17 | Raw SQL |
| **Dues Invoice** | `dues_invoice` | **13** | **17** | **Schema (NEW)** |
| **Dues Config** | `dues_config` | **2** | **17** | **Schema (NEW)** |
| **Dues Fund** | `dues_fund` | **3** | **17** | **Schema (NEW)** |
| **Dues Org Config** | `dues_org_config` | **1** | **17** | **Schema (NEW)** |
| **Committee** | `committee` | **3** | **18** | **Schema (NEW)** |
| **Committee Member** | `committee_member` | **11** | **18** | **Schema (NEW)** |
| **Committee Task** | `committee_task` | **8** | **18** | **Schema (NEW)** |
| Notification | `notification` | ~15 | 10 | Schema |
| Certificate | `certificate` | ~10 | 11 | Schema |
| Document | `document` | 8 | 12 | Schema |
| Document Access Log | `document_access_log` | 5 | 12 | Schema |
| Chat Room | `chat_room` | 3 | 13 | Schema |
| Chat Message | `chat_message` | ~15 | 13 | Schema |
| Invoice (billing) | `invoice` | 5 | 14 | Schema |
| Merchant Account | `merchant_account` | 1 | 14 | Schema |
| Dunning Event | `dunning_event` | ~10 | 15 | Schema |
| Audit Log Entry | `audit_log` | 20 | 15 | Schema |
| Vendor | `vendor` | 2 | 16 | Schema |
| Marketplace Listing | `marketplace_listing` | 4 | 16 | Schema |
| Marketplace Order | `marketplace_order` | 2 | 16 | Schema |
| Review | `review` | 3 | 16 | Schema |
| Invitation Token | `invitation_token` | 2 | 16 | Schema |
| Stored File | `stored_file` | 5 | 16 | Schema |
| **Check-In** | `check_in` | **6** | **19** | **Schema (NEW)** |
| **Waitlist Entry** | `waitlist_entry` | **3** | **19** | **Schema (NEW)** |
| **Election Nominee** | `election_nominee` | **3** | **19** | **Schema (NEW)** |
| **Election Vote** | `election_vote` | **10** | **19** | **Schema (NEW)** |
| **Accredited Provider** | `accredited_provider` | **3** | **20** | **Schema (NEW)** |
| **Course** | `course` | **4** | **20** | **Schema (NEW)** |
| **Course Enrollment** | `course_enrollment` | **7** | **20** | **Schema (NEW)** |
| **Quiz Attempt** | `quiz_attempt` | **5** | **20** | **Schema (NEW)** |
| **Professional License** | `professional_license` | **8** | **21** | **Schema (NEW)** |
| **License Renewal Alert** | `license_renewal_alert` | **3** | **21** | **Schema (NEW)** |
| **Credential Template** | `credential_template` | **1** | **21** | **Schema (NEW)** |
| **Digital Credential** | `digital_credential` | **6** | **21** | **Schema (NEW)** |
| **Directory Profile** | `directory_profile` | **9** | **22** | **Schema (NEW)** |
| **Chapter Affiliation** | `chapter_affiliation` | **11** | **22** | **Schema (NEW)** |
| **Notification Preference** | `notification_preference` | **30** | **22** | **Schema (NEW)** |
| **Person Privacy Setting** | `person_privacy_setting` | **9** | **22** | **Schema (NEW)** |
| **Membership Status History** | `membership_status_history` | **~17** | **22** | **Schema (NEW)** |

## Scenario Index (New — Phase 17-18)

| Scenario | Type | Source | Entities |
|----------|------|--------|----------|
| `scenario_dues_invoice_paid` | state | M06 State Transitions | DuesInvoice (5 × status=paid) |
| `scenario_dues_invoice_sent` | state | M06 State Transitions | DuesInvoice (3 × status=sent) |
| `scenario_dues_invoice_generated` | state | M06 State Transitions | DuesInvoice (3 × status=generated) |
| `scenario_dues_invoice_overdue` | state | M06 State Transitions | DuesInvoice (2 × status=overdue) |
| `scenario_dues_proof_submitted` | workflow | WF: Payment Proof Submission | DuesPayment (3 × status=submitted, with proof metadata) |
| `scenario_dues_fund_allocation` | config | BR-05: Fund split | DuesFund (3 funds, sums to 100%) |
| `scenario_committee_standing` | entity | M19 Committee Types | Committee (active, standing type) |
| `scenario_committee_adhoc_dissolved` | state | M19-R5: Dissolution | Committee (completed, dissolved with reason) |
| `scenario_committee_tasks_mixed` | state | M19 Task States | CommitteeTask (pending, in_progress, completed, overdue, cancelled) |
| `scenario_committee_members_roles` | entity | M19 Roles | CommitteeMember (chairperson, vice_chairperson, secretary, member) |

## Coverage (Phases 17-18)

### Covered (Phases 17-18)
- **Dues status filter:** `dues_invoice` records linked to memberships via `membershipId` — roster filter now returns results for Paid/Sent/Generated/Overdue
- **Pending payment proofs:** 3 `dues_payment` records with `status=submitted` + proof metadata — PendingProofsList component has data
- **Fund configuration:** `dues_config` (per-tier), `dues_fund` (allocation targets), `dues_org_config` (org-level settings)
- **Committee governance:** 3 committees (standing + ad-hoc dissolved), 11 members across roles, 8 tasks across all statuses

## Scenario Index (New — Phase 19-22)

| Scenario | Type | Source | Entities |
|----------|------|--------|----------|
| `scenario_checkin_qr_manual` | state | M08 Events: check-in methods | CheckIn (6: mixed qr/manual on completed events) |
| `scenario_waitlist_promoted` | workflow | WF: Waitlist promotion | WaitlistEntry (3: 1 promoted, 2 pending) |
| `scenario_election_nominees_elected` | state | M12 Elections: nominee status | ElectionNominee (3: elected/accepted) |
| `scenario_election_votes` | workflow | M12 Elections: voting | ElectionVote (10: 5 voters × 2 positions) |
| `scenario_accredited_providers_mixed` | entity | M09 Training: PRC providers | AccreditedProvider (3: active/active/suspended) |
| `scenario_courses_published_draft` | state | M09 Training: course status | Course (4: 3 published, 1 draft) |
| `scenario_course_enrollments_progress` | workflow | M09 Training: e-learning | CourseEnrollment (7: 4 completed, 3 in-progress) |
| `scenario_quiz_pass_fail_retry` | state | M09 Training: quiz attempts | QuizAttempt (5: 4 pass, 1 fail-then-pass) |
| `scenario_licenses_active_expired` | state | M11 Credentials: license status | ProfessionalLicense (8: 6 active, 2 expired) |
| `scenario_renewal_alerts_mixed` | state | M11 Credentials: alert status | LicenseRenewalAlert (3: pending/sent/acknowledged) |
| `scenario_member_id_cards` | entity | M11 Credentials: digital IDs | DigitalCredential (6: 5 active, 1 revoked) |
| `scenario_directory_profiles_visibility` | state | M04 Org Admin: directory | DirectoryProfile (9: 3 public, 4 memberOnly, 2 hidden) |
| `scenario_membership_status_transitions` | workflow | M05 Membership: status machine | MembershipStatusHistory (~17: active/grace/lapsed transitions) |
| `scenario_notification_prefs_per_category` | config | M02 Profile: notification prefs | NotificationPreference (30: 6 persons × 5 categories) |
| `scenario_privacy_settings_per_person` | config | M02 Profile: privacy controls | PersonPrivacySetting (9: email/phone/photo/address visibility) |

### Coverage

#### Covered (Phases 19-22)
- **Event check-ins:** Both `qr` and `manual` methods represented — officer dashboard check-in UI has data
- **Waitlist:** 1 promoted entry simulates the waitlist → registration flow
- **Election nominees + votes:** Published 2025 election has full participant set; admin UI can render results
- **Accredited providers:** All 3 status values covered (active, active, suspended)
- **Self-paced courses:** 4 courses (3 published + 1 draft) with enrollments at varied progress
- **Quiz attempts:** Fail-then-pass scenario exercisable by training reports
- **Professional licenses:** 8 licenses including expired ones — license expiry alert workflow exercisable
- **Digital credentials:** Member ID card template + 6 issued credentials (1 revoked) — credential UI has data
- **Directory profiles:** 3 visibility states (public/memberOnly/hidden) for directory filter tests
- **Chapter affiliations:** All active members linked to the Metro Manila chapter
- **Notification preferences:** 6 persons with all 5 categories seeded — M02 settings UI has data
- **Privacy settings:** Varied visibility flags per person — directory privacy filter exercisable
- **Membership status history:** Full state machine traces for active/grace/lapsed paths

### Remaining Gaps (deferred — no handlers or schema yet)

| Table | Module | Reason |
|-------|--------|--------|
| `booking_event` | M08 Booking | Schema exists but no seed — booking features show empty |
| `time_slot` | M08 Booking | Depends on booking_event |
| `booking` | M08 Booking | Depends on time_slot |
| `schedule_exception` | M08 Booking | Depends on booking_event |
| `affiliation_transfer` | M04 Org Admin | Schema exists; transfer workflow not yet in scope |
| `royalty_split` | M04 Org Admin | Schema exists; dues split config not in v1 scope |
| `dues_payment_status_history` | M06 Dues | Schema exists; needs dues_payment IDs to link |
| `dues_category_override` | M06 Dues | Schema exists; category override not in v1 scope |
| `dues_reminder_schedule` | M06 Dues | Schema exists; scheduler not wired |
| `dues_gateway_config` | M06 Dues | Schema exists; PayMongo/Stripe config not in v1 |
| `aging_bucket` | M06 Dues | Schema exists; AR aging report not in v1 |
| `dues_reminder_log` | M06 Dues | Schema exists; reminder idempotency log |

### What's Next
- Run `/oli-confidence-stack` to validate test confidence with new seed data
- Browse officer payments page to verify dues filter + pending proofs work
- Seed `booking_event` / `time_slot` / `booking` when M08 booking handlers ship
