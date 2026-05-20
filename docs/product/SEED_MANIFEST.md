---
oli-version: 1.0
based-on:
  - MODULE_SPEC m06-dues-payments v1.0
  - MODULE_SPEC m19-committee-management v1.0
  - WORKFLOW_MAP v1.0
  - ROLE_PERMISSION_MATRIX v1.0
  - Codebase audit (2026-05-20)
generated: 2026-05-20
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

## Coverage

### Covered (New)
- **Dues status filter:** `dues_invoice` records linked to memberships via `membershipId` — roster filter now returns results for Paid/Sent/Generated/Overdue
- **Pending payment proofs:** 3 `dues_payment` records with `status=submitted` + proof metadata — PendingProofsList component has data
- **Fund configuration:** `dues_config` (per-tier), `dues_fund` (allocation targets), `dues_org_config` (org-level settings)
- **Committee governance:** 3 committees (standing + ad-hoc dissolved), 11 members across roles, 8 tasks across all statuses

### Uncovered (Remaining Gaps)

| Table | Module | Reason |
|-------|--------|--------|
| `booking_event` | M08 Booking | Schema exists but no seed — booking features show empty |
| `schedule_exception` | M08 Booking | Depends on booking_event |
| `course` | M09 Training | Online course entities (separate from training events) |
| `course_enrollment` | M09 Training | Depends on course |
| `digital_credential` | M11 Documents | Member digital ID cards |
| `credential_template` | M11 Documents | Template for credential generation |
| `election_nominee` | M12 Elections | Election nominees (elections table seeded, nominees not) |
| `election_vote` | M12 Elections | Votes for nominees |
| `professional_license` | M02 Profile | PRC license tracking |
| `directory_profile` | M02 Profile | Public directory entries |
| `check_in` | M08 Events | Event check-in records |
| `waitlist_entry` | M08 Events | Separate waitlist tracking |

### What's Next
- Run `/oli-seed --entities booking_event,course,digital_credential --mode dev` to fill remaining L2 gaps
- Run `/oli-confidence-stack` to validate test confidence with new seed data
- Browse officer payments page to verify dues filter + pending proofs work
