# Pitfalls Research

**Domain:** Healthcare AMS — v1.2.0 Pilot Launch features (account deletion, payment recording, officer bulk ops, PRC compliance, cross-org transfers, deceased handling, email guards)
**Researched:** 2026-05-13
**Confidence:** HIGH — drawn from existing codebase knowledge + domain patterns in GDPR/DPA compliance systems, healthcare AMS post-mortems, and PH regulatory context

---

## Critical Pitfalls

### Pitfall 1: Incomplete Anonymization Leaves Cross-Module PII

**What goes wrong:**
Account deletion anonymizes the Person row (name, email, contact), but foreign-key references in other modules still expose personal data. Training credits store member name denormalized. Certificate PDFs stored in S3 contain full name/PRC number. Audit logs capture the pre-anonymization payload. Communication module chat history retains display name. The deletion "looks done" but a join or audit query reconstructs the person.

**Why it happens:**
Person module is the PII hub, so developers anonymize there and assume done. They don't inventory every table that cached or denormalized PII at write time. Audit middleware captures full before/after payloads — nobody thinks to scrub those. S3 object metadata and filenames often contain person identifiers.

**How to avoid:**
- Build a PII manifest before writing the deletion handler: list every table with a `personId` FK + every table with denormalized name/email fields.
- Cascade anonymization jobs to: certificates (S3 object rename + PDF redaction or deletion), chat message display names, audit log payload scrubbing (replace with `[DELETED]` sentinel, not delete — preserve the action record), training credit roster entries, election ballot records.
- Run anonymization in a DB transaction + async S3 cleanup job with idempotency key so failures are retryable without partial state.
- PH Data Privacy Act (RA 10173) requires anonymization, not deletion, of records needed for legitimate business purposes (dues history, audit trail). Retention rule: financial records 10 years, compliance records 5 years.

**Warning signs:**
- `SELECT * FROM training_credits WHERE member_name LIKE '%deleted%'` still returns real names after deletion test.
- Audit log `payload` JSONB still contains email/phone after anonymization.
- `GET /certificates/{id}` still returns a PDF with the member's name after deletion.

**Phase to address:** Account deletion phase — must define PII manifest as acceptance criterion before any code is written.

---

### Pitfall 2: Financial Record Retention vs. Right to Erasure Conflict

**What goes wrong:**
Developer implements "full delete" on account deletion request to satisfy DPA. This destroys dues invoices, payment records, and Stripe transaction references. Finance can no longer reconcile. BIR audit trail breaks (Philippine tax authority requires 10-year retention). Stripe chargebacks have no local record to dispute with.

**Why it happens:**
"Delete account" is interpreted as "delete all data." The developer doesn't distinguish between PII (must anonymize on request) and financial transaction records (must retain regardless).

**How to avoid:**
- Dues invoices: anonymize the `personId` link to a tombstone record (e.g., `DELETED-{uuid}`), retain all financial fields (amount, date, status, stripe_payment_intent_id).
- Payment records: never delete. Flag `member_deleted_at` on the invoice row. Keep stripe references intact for chargeback defense.
- Deletion handler must check for open invoices (status `pending` or `overdue`) and either block deletion or force a final settlement first.
- Separate the concept of "account deactivated" (soft delete, login blocked) from "data anonymized" (PII scrubbed) — implement as two distinct states with a cooling-off period (30 days) matching RA 10173 grace period.

**Warning signs:**
- Deletion handler does a `DELETE FROM dues_invoices WHERE person_id = ?` — stop immediately.
- No `deleted_members` or `person_tombstones` table in the schema.
- Stripe webhook handlers crash on `charge.dispute.created` for a deleted member.

**Phase to address:** Account deletion phase — financial retention rules must be in acceptance criteria, not discovered during QA.

---

### Pitfall 3: Data Export Missing Modules

**What goes wrong:**
The export endpoint returns Person profile + membership record but omits: training credits, CPD points, certificate metadata, dues history, event attendance, election participation, audit log entries for that person. Member downloads their data, finds it incomplete, files a DPA complaint (RA 10173 §16 data portability right). Export also leaks org-level data the member shouldn't see (other members' info via association-level queries).

**Why it happens:**
Developer queries `person` + `membership` tables — the most obvious join. The full data inventory across 22 handler directories requires deliberate enumeration. PII leaks happen when export queries use organizationId without also filtering by personId.

**How to avoid:**
- Define an export manifest (same PII manifest as deletion, but read direction): every table with `personId` FK must contribute to the export.
- Export format: JSON with module-namespaced keys (`{ "profile": {...}, "training": {...}, "dues": {...} }`). Include generated_at timestamp and checksum for integrity.
- Each module's export query must be explicitly scoped to `WHERE person_id = $1` — no org-level aggregates.
- Rate-limit: one export request per 24h per person (GDPR/DPA best practice, prevents data scraping via export).
- Background job pattern: export is async (can take seconds), return a signed S3 URL valid for 1h. Don't stream synchronously.

**Warning signs:**
- Export JSON has no `training` or `dues` keys.
- Export includes fields like `organization.member_count` or other members' names.
- Export endpoint is synchronous with no size limit.

**Phase to address:** Data export phase — acceptance criterion must be a module coverage checklist.

---

### Pitfall 4: Payment Race Condition — Double Invoice Finalization

**What goes wrong:**
Member clicks "Pay" twice quickly. Two requests hit `POST /dues/invoices/{id}/record-payment` concurrently. Both read `status = 'pending'`, both pass the status check, both write `status = 'paid'` with different payment references. Invoice shows paid twice. Dues total is doubled. Audit log has two `payment.recorded` events for the same invoice.

**Why it happens:**
The status check and the update are two separate DB operations with no locking. At normal scale this is rare — at pilot launch with spotty PH internet, retried requests are common.

**How to avoid:**
- Use a Postgres advisory lock or `SELECT ... FOR UPDATE` on the invoice row at the start of the payment handler.
- Alternatively: `UPDATE dues_invoices SET status = 'paid', payment_ref = $1 WHERE id = $2 AND status = 'pending' RETURNING id` — check `rowCount === 1`, reject if 0 (already processed).
- Idempotency key: accept `X-Idempotency-Key` header, store in a `payment_attempts` table, return cached response for duplicate keys within 24h.
- The "record payment" endpoint is officer-only (manual recording of cash/check) — ensure it checks `status !== 'paid'` before proceeding, not just `status === 'pending'`.

**Warning signs:**
- Payment handler reads `invoice.status` then separately updates — two DB calls with no transaction.
- No `FOR UPDATE` or `rowCount` check in the payment update query.
- Load test: two concurrent identical payment requests succeed instead of one succeeding and one returning 409.

**Phase to address:** Payment recording phase — include concurrent-request test in acceptance criteria.

---

### Pitfall 5: Officer Bulk Actions — Permission Escalation

**What goes wrong:**
Officer bulk-approves 50 membership applications. The bulk endpoint iterates and calls the per-record approval handler internally. One of those applications belongs to a member in a different chapter. The per-record handler checks chapter membership, but the bulk endpoint only checks that the caller is an officer — without re-validating chapter scope per record. Officer inadvertently approves cross-chapter members they have no authority over.

**Why it happens:**
Bulk endpoints are written as "loop over IDs, call handler logic." The authorization check moves to the outer level ("is this user an officer?") and the inner loop skips per-record scope validation as an optimization.

**How to avoid:**
- Bulk handlers must validate scope per record, not just per request. Each ID in the bulk set must be checked against the caller's chapter/organization scope.
- Return a partial-success response: `{ succeeded: [...], failed: [{ id, reason }] }` — never silently skip unauthorized records.
- Limit bulk batch size (max 100 records) to prevent timeout and partial application at DB level.
- Wrap entire bulk operation in a single DB transaction — all succeed or all fail, never partial commit.

**Warning signs:**
- Bulk handler does `WHERE id IN (?)` without `AND organization_id = ?` and `AND chapter_id = ?`.
- No partial-success response shape in the OpenAPI spec — bulk endpoint returns `200` with no failure details.
- Bulk endpoint authorization check is only `isOfficer(caller)` without record-level scope.

**Phase to address:** Officer bulk operations phase — the partial-success response shape must be in the TypeSpec definition before implementation.

---

### Pitfall 6: N+1 Queries on Officer Roster

**What goes wrong:**
Officer opens roster view. Frontend calls `GET /members?chapter=X` which returns 200 members. For each member, the SDK hook calls `GET /members/{id}/dues-status` and `GET /members/{id}/training-credits` to build the roster table. 200 members = 400+ sequential queries. Page takes 15-30 seconds. On Railway free tier this hits the connection limit.

**Why it happens:**
Roster view is built feature-by-feature. Dues status added later as a separate endpoint. Training credits added even later. Each was individually correct but the combination creates N+1.

**How to avoid:**
- `GET /members` must support a `?include=dues_status,training_summary` query param that does a single JOIN query server-side.
- Define the roster response shape in TypeSpec upfront with embedded summaries — don't let the frontend aggregate.
- For the pilot (small associations, <500 members), a single query with LEFT JOINs to dues and training tables is sufficient. Add pagination (`limit=50`) to keep worst-case bounded.
- Index: `dues_invoices(person_id, status)` and `training_credits(person_id, organization_id)` are required for the JOINs to be fast.

**Warning signs:**
- Roster page makes more than 3 API calls per member displayed.
- No `?include=` parameter in the member list endpoint TypeSpec.
- Missing indexes on `person_id` FKs in dues/training tables.

**Phase to address:** Officer daily ops phase — roster query shape defined in TypeSpec before frontend work begins.

---

### Pitfall 7: PRC Regulatory Format Changes Break Accreditation Submission

**What goes wrong:**
The PRC (Professional Regulation Commission) changes their CPD submission format mid-pilot. The system has hardcoded field names matching the 2023 format (e.g., `cpd_provider_no` → renamed to `cpd_provider_accreditation_no` in 2024 rules). Submissions fail silently — the PRC portal accepts the upload but marks it as incomplete. Members don't get their CPD points credited.

**Why it happens:**
PRC format is treated as a stable external spec. Nobody builds version tracking or format validation against the official PRC schema. The submission pipeline has no feedback loop — it uploads and assumes success.

**How to avoid:**
- PRC submission format must be configurable (stored as a JSON template in the DB or config), not hardcoded in handler logic.
- Add a `prc_format_version` field to the training/CPD submission record — when PRC changes format, old submissions are still valid against their version.
- CPD credit records must track: `units`, `provider_accreditation_no`, `activity_date`, `topic_code` — these are the fields PRC has historically changed.
- Build a dry-run validation endpoint (`POST /training/prc-validate`) that checks the submission against expected format before live submission.
- Check https://www.prc.gov.ph/cpd for current accreditation requirements before writing the submission handler.

**Warning signs:**
- CPD submission field names are hardcoded strings in the handler, not driven by a config or schema document.
- No `prc_format_version` column in training tables.
- Submission handler returns `200` with no confirmation from PRC side (fire-and-forget).

**Phase to address:** PRC compliance phase — format must be researched from current PRC guidelines, not assumed from memory.

---

### Pitfall 8: Accreditation Expiry Edge Cases Cause Silent Credit Loss

**What goes wrong:**
A training provider's accreditation expires on the same day a member completes their CPD activity. The system records the credit because the activity date is valid. But PRC rejects it because the provider's accreditation was expired at time of activity. Member loses the credit retroactively with no warning. They don't find out until renewal time.

**Why it happens:**
Training credit validation checks `activity_date` but not `provider_accreditation_expiry_date`. The join is missing.

**How to avoid:**
- `training_providers` table must have `accreditation_expiry_date`. When recording a credit, validate: `activity_date < provider.accreditation_expiry_date`.
- Proactive expiry warnings: 30-day and 7-day notifications to officers when a provider's accreditation is about to expire.
- Grace period handling: if a provider's accreditation lapses, flag in-flight credits as `pending_validation` rather than `approved`.
- For activities near expiry boundary (within 7 days of provider expiry), add a `requires_verification` flag.

**Warning signs:**
- `training_credits` table has no reference to `provider_accreditation_expiry_date`.
- No cron job or scheduled check for expiring provider accreditations.
- Credit approval is automatic without date-range validation against provider accreditation.

**Phase to address:** PRC compliance phase.

---

### Pitfall 9: Cross-Org Transfer — Training Credits Double-Counted

**What goes wrong:**
Member transfers from Chapter A to Chapter B. Training credits completed under Chapter A are copied to Chapter B's roster. Both chapters now report the same CPD units in their org-level analytics. National org's aggregate count is inflated. PRC submission from Chapter B includes credits that Chapter A already submitted.

**Why it happens:**
Transfer is implemented as "copy member record + copy credits to new org." Nobody tracks that credits have a canonical `source_organization_id` and should not be re-submitted by the receiving org.

**How to avoid:**
- Training credits must have `source_organization_id` (where the activity occurred) and `current_organization_id` (the member's current home). These can differ post-transfer.
- PRC submission queries must use `source_organization_id`, not `current_organization_id`.
- Org analytics (CPD totals, compliance rates) must use `current_organization_id` for membership counts but `source_organization_id` for submission attribution.
- Transfer handler: move membership record, do NOT copy or re-create training credit records — they travel with the person, ownership doesn't change.
- Cross-org analytics endpoint must deduplicate credits by `(person_id, activity_id)` to prevent double-count even if schema has bugs.

**Warning signs:**
- `training_credits` has only `organization_id`, no `source_organization_id` distinction.
- Transfer handler does `INSERT INTO training_credits SELECT ... FROM training_credits WHERE person_id = ?`.
- `GET /training/org-summary` returns different totals before and after a transfer that shouldn't change the total.

**Phase to address:** Transfer and cross-org training phase.

---

### Pitfall 10: Deceased Member — Notification and Billing Continue

**What goes wrong:**
Officer marks member as deceased. The system does not immediately suppress: (1) upcoming dues invoice auto-generation for the next cycle, (2) OneSignal push notifications from the notifications module, (3) scheduled email reminders (dues, event invites, CPD renewal), (4) election nomination eligibility. Dues invoice generates after death. Renewal reminder sent to the member's email (now monitored by family). Family receives a billing demand — reputational damage.

**Why it happens:**
"Deceased" status is added as a flag on the Person row. But the downstream systems (dues scheduler, notification triggers, election eligibility checks) each independently check membership status using `is_active = true` — they don't check the deceased flag because it was added later without updating all consumers.

**How to avoid:**
- Deceased flag must be a first-class membership status, not a separate boolean. Use `membership.status = 'deceased'` (same enum as `active`, `suspended`, `lapsed`).
- All dues scheduler queries must include `WHERE status NOT IN ('deceased', 'resigned', 'expelled')`.
- All notification send paths must check membership status before dispatch.
- All election eligibility queries must exclude `status = 'deceased'`.
- When marking deceased: immediately cancel any pending dues invoices (status → `void`), cancel scheduled notifications, add to an exclusion list in OneSignal.
- Deceased handling must be atomic: mark deceased + cancel invoices + suppress notifications in one transaction + async job.

**Warning signs:**
- Deceased is stored as `is_deceased = true` on Person rather than as a membership status value.
- Dues invoice scheduler uses `WHERE membership.is_active = true` without consulting deceased flag.
- Test: mark a member deceased, fast-forward dues cycle, verify no new invoice is created.

**Phase to address:** Member departure and deceased handling phase.

---

### Pitfall 11: Email Guards Rate-Limit Blocks Critical Transactional Emails

**What goes wrong:**
Rate-limiting is added to protect against email loops and abuse. A global rate limiter is applied: max 10 emails per person per day. Officer triggers a bulk communication (chapter-wide announcement + dues reminder + event invite simultaneously). Members who receive all three in the same hour have the third email silently dropped. Dues reminder is dropped. Member misses payment deadline. Late fee applies. Member disputes.

**Why it happens:**
Rate limiting is implemented globally per-recipient without distinguishing email categories. "Transactional" (dues, receipts, password reset) and "marketing/bulk" (announcements, event invites) are treated the same.

**How to avoid:**
- Email categories must be distinct at the schema level: `email.type IN ('transactional', 'notification', 'bulk')`.
- Rate limiting applies only to `type = 'bulk'`. Transactional emails (dues invoices, payment receipts, password reset, account deletion confirmation) bypass rate limits entirely.
- Separate sending queues for transactional vs. bulk — transactional has priority and no rate gate.
- Dead-letter queue: emails that fail delivery (bounce, rate exceeded) must be logged with reason code, not silently dropped.
- Bounce handling: distinguish hard bounce (invalid address — unsubscribe permanently) from soft bounce (temporary — retry 3x then alert officer). Never remove a valid address based on a single soft bounce.

**Warning signs:**
- Email queue table has no `type` or `category` column.
- Rate limiter middleware applies to all outbound email without exempting transactional types.
- Bounce webhook handler does `DELETE FROM person SET email = NULL` on first bounce event.

**Phase to address:** Email and notification guards phase.

---

### Pitfall 12: Audit Log Payload Contains Post-Anonymization PII

**What goes wrong:**
Global audit middleware captures `before` and `after` snapshots of every write. Account deletion anonymizes the `persons` row. But the audit log entry for the anonymization itself contains the pre-anonymization payload as the `before` snapshot: `{ "email": "real@email.com", "first_name": "Real Name" }`. The audit log now permanently stores the PII that was just removed.

**Why it happens:**
Audit middleware runs on all writes including the anonymization write. The before-snapshot is captured before the write, so it contains the real data. Nobody considered that the deletion handler's own audit entry would undo the anonymization.

**How to avoid:**
- The account deletion/anonymization handler must be exempt from full payload capture in the audit middleware, or must use a redacted payload writer.
- Audit entry for deletion should store: `{ "action": "person.anonymized", "person_id": "[TOMBSTONE-uuid]", "reason": "user_request", "requested_at": "..." }` — no PII fields.
- Add a middleware exemption list: routes that process PII deletion get a custom audit writer that logs the action without the payload.
- Run a scheduled scan: `SELECT id FROM audit_logs WHERE payload::text LIKE '%@%' AND person_id IN (SELECT id FROM persons WHERE is_deleted = true)` to detect leaks.

**Warning signs:**
- Audit middleware always captures `before` payload without checking if the operation is a deletion.
- No middleware exemption mechanism exists.
- Deleted member's audit log still shows their email in a `before_state` field.

**Phase to address:** Account deletion phase — audit exemption must be built before the anonymization handler.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `is_deceased` boolean on Person instead of membership status enum | Quick to add | Breaks all downstream status checks; N consumers need patching when discovered | Never — use status enum from the start |
| Hardcode PRC field names in handler | Faster to ship | Format changes break submissions silently; no version tracking | Never — store as config |
| Export endpoint returns everything synchronously | Simpler implementation | Timeouts for members with 3+ years of data; blocks API worker | Acceptable in MVP only if export size is bounded (<100 records) |
| Bulk action returns 200 on partial failure | Simpler response handling | Caller doesn't know which records failed; data integrity unknown | Never — always return partial-success shape |
| Global rate limit across email types | Simple to implement | Drops transactional emails under load | Never — always separate transactional from bulk |
| Anonymize Person row only | Fast deletion UX | PII persists in 15+ other tables | Never — always run full PII manifest |
| Copy training credits on transfer | Preserves history visually | Double-counts in analytics and PRC submissions | Never — credits travel with person, not duplicated |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Stripe | Delete local payment records when member deleted | Anonymize local record, keep Stripe references intact for chargeback defense |
| OneSignal | Only cancel subscription on account delete | Also suppress on deceased, suspended, resigned membership status changes |
| Postmark/SMTP | Apply same bounce handling to all bounces | Hard bounce = permanent unsubscribe; soft bounce = retry with backoff |
| S3/MinIO | Leave certificate PDFs accessible after deletion | Delete or redact S3 objects; audit S3 key patterns that contain person identifiers |
| PRC portal | Assume submission format is stable | Treat as versioned external schema; log format version with each submission |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 roster queries | Officer roster takes 15s+ to load | `?include=dues_status,training_summary` on member list endpoint with server-side JOINs | >20 members |
| Bulk anonymization without batching | Account deletion times out for members with 5+ years of data | Async job with batch size 100, idempotency key | >500 records across tables |
| Synchronous data export | Export endpoint times out; Railway 30s limit | Background job + signed S3 URL | Member with >200 events/trainings |
| Full-table scan on audit log | `GET /audit?person_id=X` slow | Index `audit_logs(person_id, created_at)` — required before audit log queries in deletion flow | >10k audit records |
| Transaction wrapping entire bulk op with no timeout | Bulk approval of 200 members holds lock for 30s | Batch in groups of 25, release lock between batches | >50 records in single transaction |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Bulk endpoint checks only `isOfficer()` without record-level chapter scope | Officer approves members from other chapters they don't govern | Per-record scope check inside bulk loop; return 403 for out-of-scope records |
| Data export endpoint not scoped to requesting user's own data | Member A downloads Member B's data via URL manipulation | Export handler must validate `requesting_person_id === target_person_id` OR caller has admin role |
| Payment recording endpoint accessible to member (not officer-only) | Member self-approves their own payment | Endpoint must require `officer` or `admin` role; verify in both middleware and handler |
| Deceased flag does not immediately revoke session | Deceased member's session remains active | On deceased marking, invalidate all Better-Auth sessions for that person_id |
| Transfer handler doesn't verify caller has authority in BOTH source and destination org | Rogue officer moves members between orgs | Transfer requires `admin` role in both source and destination organization |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No cooling-off period for account deletion | Member deletes by mistake; data unrecoverable | 30-day deactivation → anonymization pipeline; allow reactivation within window |
| Bulk action with no progress indicator | Officer submits 100-member bulk approval; page freezes; they click again | Optimistic lock + return job_id; poll for completion; show progress |
| Data export returns immediately with empty or partial data | Member thinks export is broken | Async export: "Your data export is being prepared. You'll receive an email with a download link." |
| Deceased handling requires no confirmation | Officer accidentally marks living member as deceased | Two-step confirmation: "Mark [Name] as deceased? This will void pending invoices and suppress all communications." |
| CPD credit shows as approved but is pending PRC submission | Member believes they're compliant; learns otherwise at renewal | Credit status must show `recorded` vs. `submitted_to_prc` vs. `prc_confirmed` — three distinct states |

---

## "Looks Done But Isn't" Checklist

- [ ] **Account deletion:** Verify audit log `before_state` payload does NOT contain email/phone after anonymization test.
- [ ] **Account deletion:** `GET /certificates/{id}` returns 404 or redacted response after member deletion.
- [ ] **Account deletion:** `GET /dues/invoices?person_id={deleted}` returns anonymized records with `DELETED` reference, not real name.
- [ ] **Data export:** Export JSON contains keys for all 8+ modules: profile, membership, dues, training, events, certificates, communications, audit.
- [ ] **Payment recording:** Send two identical payment requests concurrently — only one succeeds; second returns 409.
- [ ] **Officer bulk:** Bulk-approve a set that includes out-of-scope records — out-of-scope records appear in `failed` response array, in-scope records succeed.
- [ ] **Deceased handling:** Mark member deceased, run dues invoice scheduler — no new invoice is created for the deceased member.
- [ ] **Deceased handling:** Check OneSignal external_id for deceased member — subscription is unsubscribed or notification filtered.
- [ ] **Cross-org transfer:** Transfer member, check org-level training summary — total credits unchanged (not doubled).
- [ ] **Email guards:** Send 3 transactional emails to same member in 1 minute — all 3 are delivered (transactional bypass works).
- [ ] **PRC compliance:** Record a training credit with an expired provider — system rejects or flags as `pending_validation`.
- [ ] **Audit log:** Every deletion/anonymization action has an audit record; none of those audit records contain the PII being anonymized.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| PII found in audit logs post-anonymization | HIGH | Write migration to scrub `payload` JSONB fields for tombstoned persons; audit each log entry; may require DPA notification |
| Double-counted training credits post-transfer | MEDIUM | Write dedup migration: remove credits where `source_organization_id != current_organization_id` that duplicate existing records; rerun org summaries |
| Dues invoice sent to deceased member | LOW-MEDIUM | Void the invoice; send apology communication to family contact; document in case of complaint |
| Bulk action partial-applied (some records updated, some not due to timeout) | HIGH | Requires per-record audit log review to determine applied set; manual reconciliation; introduce idempotency key on retry |
| Data export missing modules discovered post-DPA complaint | HIGH | Retroactive export with missing modules + formal response to DPA complaint; add module coverage test to export acceptance criteria |
| Payment double-recorded | MEDIUM | Void the duplicate payment record; refund if actual duplicate charge occurred; add to audit trail with explanation |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Incomplete anonymization | Account deletion phase | PII manifest checklist; `SELECT` audit on all FK tables post-test |
| Financial retention vs. erasure conflict | Account deletion phase | Dues records survive deletion; Stripe reference intact |
| Audit log captures PII being anonymized | Account deletion phase | Audit entry for anonymization has no email/name in payload |
| Data export missing modules | Data export phase | Export coverage test: assert JSON has 8+ module keys |
| Payment race condition | Payment recording phase | Concurrent request test in acceptance criteria |
| Officer bulk permission escalation | Officer bulk ops phase | Out-of-scope records rejected with 403 in partial-success response |
| N+1 roster queries | Officer daily ops phase | Roster loads in <2s for 200 members; single query verified in test |
| PRC format hardcoded | PRC compliance phase | Format driven by config; dry-run validation endpoint exists |
| Accreditation expiry edge cases | PRC compliance phase | Credit with expired provider flagged as `pending_validation` |
| Cross-org credit double-counting | Transfer and cross-org phase | Org summary total unchanged after transfer; source_org attribution correct |
| Deceased billing and notifications | Member departure phase | No invoice generated post-deceased; OneSignal suppressed |
| Email guards blocking transactional | Email guards phase | Transactional bypass test: 3 transactional emails in 1 min all delivered |

---

## Sources

- PH Data Privacy Act RA 10173 — requirements for anonymization, data portability, retention
- PRC CPD accreditation rules (https://www.prc.gov.ph/cpd) — current field format requirements
- PostgreSQL `SELECT FOR UPDATE` documentation — optimistic/pessimistic locking patterns
- OneSignal external_id targeting and subscription management docs
- Stripe dispute documentation — chargeback defense requires local transaction records
- Existing codebase: `services/api-ts/src/handlers/` — 22 handler directories, current schema patterns
- VERTICAL_TDD.md — vertical slice gate enforcement, acceptance criteria discipline
- Existing audit middleware — global write capture behavior that drives Pitfall 12

---
*Pitfalls research for: Healthcare AMS v1.2.0 Pilot Launch — PH dental associations*
*Researched: 2026-05-13*
