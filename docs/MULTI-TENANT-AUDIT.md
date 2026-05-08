# Multi-Tenant Table Audit

> Gate 5 deliverable. Inventories all tables, categorizes org-scoping status, and provides migration plan for unscoped tables.
>
> Source: `docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md` sections 7, 8.3, 13 (P0-4/P0-7).
> Cross-ref: `.planning/P0-P1-FIXES.md` P0-7.

## Summary

| Metric | Original Audit (Gate 0) | Verified (Gate 5) |
|--------|------------------------|-------------------|
| Schema files | 29 | 29 (28 handler + 1 better-auth) |
| Total tables | 72 | **79** |
| With `organizationId` | 46 (64%) | **35 (44%)** |
| Without `organizationId` | 26 (36%) | **44 (56%)** |

**Why the discrepancy**: The original audit (1) missed 7 better-auth tables in its total, (2) counted some child tables as "scoped" if their parent had `organizationId`, and (3) missed tables from `membership.schema.ts`, `notification-preferences.schema.ts`, `privacy-settings.schema.ts`, and `booking.schema.ts`. This audit verifies each table's schema definition directly.

**Corrected breakdown of 44 unscoped tables**:
- **12 Intentionally Global** — no change needed (auth + platform tables)
- **19 Needs `organizationId`** — direct scoping required (security risk)
- **13 Child of Org-Scoped Parent** — add `organizationId` for defense-in-depth

---

## Full Table Inventory

### association:member (18/18 scoped)

| # | Table Name | Variable | Schema File | Has orgId |
|---|-----------|----------|-------------|-----------|
| 1 | `affiliation_transfer` | `affiliationTransfers` | `chapters.schema.ts` | YES |
| 2 | `aging_bucket` | `agingBuckets` | `dues.schema.ts` | YES |
| 3 | `chapter_affiliation` | `chapterAffiliations` | `chapters.schema.ts` | YES |
| 4 | `credential_template` | `credentialTemplates` | `credentials.schema.ts` | YES |
| 5 | `credit_entry` | `creditEntries` | `credits.schema.ts` | YES |
| 6 | `digital_credential` | `digitalCredentials` | `credentials.schema.ts` | YES |
| 7 | `directory_profile` | `directoryProfiles` | `directory.schema.ts` | YES |
| 8 | `dues_config` | `duesConfigs` | `dues.schema.ts` | YES |
| 9 | `dues_invoice` | `duesInvoices` | `dues.schema.ts` | YES |
| 10 | `license_renewal_alert` | `licenseRenewalAlerts` | `credentials.schema.ts` | YES |
| 11 | `membership` | `memberships` | `membership.schema.ts` | YES |
| 12 | `membership_application` | `membershipApplications` | `membership.schema.ts` | YES |
| 13 | `membership_category` | `membershipCategories` | `membership.schema.ts` | YES |
| 14 | `membership_tier` | `membershipTiers` | `membership.schema.ts` | YES |
| 15 | `officer_term` | `officerTerms` | `governance.schema.ts` | YES |
| 16 | `position` | `positions` | `governance.schema.ts` | YES |
| 17 | `professional_license` | `professionalLicenses` | `credentials.schema.ts` | YES |
| 18 | `royalty_split` | `royaltySplits` | `chapters.schema.ts` | YES |

All paths under `services/api-ts/src/handlers/association:member/repos/`.

### association:operations (3/9 scoped)

| # | Table Name | Variable | Schema File | Has orgId | Category |
|---|-----------|----------|-------------|-----------|----------|
| 19 | `event` | `events` | `events.schema.ts` | YES | — |
| 20 | `event_registration` | `eventRegistrations` | `events.schema.ts` | **NO** | Child of `event` |
| 21 | `check_in` | `checkIns` | `events.schema.ts` | **NO** | Child of `event_registration` |
| 22 | `waitlist_entry` | `waitlistEntries` | `events.schema.ts` | **NO** | Child of `event` |
| 23 | `training` | `trainings` | `training.schema.ts` | YES | — |
| 24 | `training_enrollment` | `trainingEnrollments` | `training.schema.ts` | **NO** | Child of `training` |
| 25 | `course` | `courses` | `training.schema.ts` | YES | — |
| 26 | `course_enrollment` | `courseEnrollments` | `training.schema.ts` | **NO** | Child of `course` |
| 27 | `quiz_attempt` | `quizAttempts` | `training.schema.ts` | **NO** | Child of `course` |

All paths under `services/api-ts/src/handlers/association:operations/repos/`.

### audit (0/1 scoped)

| # | Table Name | Variable | Schema File | Has orgId | Category |
|---|-----------|----------|-------------|-----------|----------|
| 28 | `audit_log_entry` | `auditLogEntries` | `audit.schema.ts` | **NO** | **CRITICAL — Needs orgId** |

Path: `services/api-ts/src/handlers/audit/repos/audit.schema.ts`.

### better-auth (0/7 scoped) — Intentionally Global

| # | Table Name | Variable | Schema File | Has orgId | Category |
|---|-----------|----------|-------------|-----------|----------|
| 29 | `user` | `user` | `schema.ts` | **NO** | Global by design |
| 30 | `session` | `session` | `schema.ts` | **NO** | Global by design |
| 31 | `account` | `account` | `schema.ts` | **NO** | Global by design |
| 32 | `verification` | `verification` | `schema.ts` | **NO** | Global by design |
| 33 | `passkey` | `passkey` | `schema.ts` | **NO** | Global by design |
| 34 | `two_factor` | `twoFactor` | `schema.ts` | **NO** | Global by design |
| 35 | `apikey` | `apikey` | `schema.ts` | **NO** | Global by design |

Path: `services/api-ts/src/generated/better-auth/schema.ts`.
Rationale: Better-Auth manages cross-org identity. Users exist globally and join organizations via membership. These tables are managed by the Better-Auth library and should not be modified directly.

### billing (0/3 scoped)

| # | Table Name | Variable | Schema File | Has orgId | Category |
|---|-----------|----------|-------------|-----------|----------|
| 36 | `invoice` | `invoices` | `billing.schema.ts` | **NO** | **Needs orgId** |
| 37 | `invoice_line_item` | `invoiceLineItems` | `billing.schema.ts` | **NO** | **Needs orgId** |
| 38 | `merchant_account` | `merchantAccounts` | `billing.schema.ts` | **NO** | **Needs orgId** |

Path: `services/api-ts/src/handlers/billing/repos/billing.schema.ts`.

### booking (0/4 scoped)

| # | Table Name | Variable | Schema File | Has orgId | Category |
|---|-----------|----------|-------------|-----------|----------|
| 39 | `booking` | (inline) | `booking.schema.ts` | **NO** | **Needs orgId** |
| 40 | `booking_event` | `bookingEvents` | `booking.schema.ts` | **NO** | **Needs orgId** |
| 41 | `schedule_exception` | `scheduleExceptions` | `booking.schema.ts` | **NO** | **Needs orgId** |
| 42 | `time_slot` | (inline) | `booking.schema.ts` | **NO** | **Needs orgId** |

Path: `services/api-ts/src/handlers/booking/repos/booking.schema.ts`.

### certificates (1/1 scoped)

| # | Table Name | Variable | Schema File | Has orgId |
|---|-----------|----------|-------------|-----------|
| 43 | `certificate` | `certificates` | `certificates.schema.ts` | YES |

Path: `services/api-ts/src/handlers/certificates/repos/certificates.schema.ts`.

### comms (0/2 scoped)

| # | Table Name | Variable | Schema File | Has orgId | Category |
|---|-----------|----------|-------------|-----------|----------|
| 44 | `chat_room` | `chatRooms` | `comms.schema.ts` | **NO** | **Needs orgId** |
| 45 | `chat_message` | `chatMessages` | `comms.schema.ts` | **NO** | **Needs orgId** |

Path: `services/api-ts/src/handlers/comms/repos/comms.schema.ts`.

### communication (4/4 scoped)

| # | Table Name | Variable | Schema File | Has orgId |
|---|-----------|----------|-------------|-----------|
| 46 | `message` | `messages` | `communication.schema.ts` | YES |
| 47 | `message_template` | `messageTemplates` | `communication.schema.ts` | YES |
| 48 | `person_subscription` | `personSubscriptions` | `communication.schema.ts` | YES |
| 49 | `subscription_topic` | `subscriptionTopics` | `communication.schema.ts` | YES |

Path: `services/api-ts/src/handlers/communication/repos/communication.schema.ts`.

### communications (1/2 scoped)

| # | Table Name | Variable | Schema File | Has orgId | Category |
|---|-----------|----------|-------------|-----------|----------|
| 50 | `announcement` | `announcements` | `communications.schema.ts` | YES | — |
| 51 | `announcement_stats` | `announcementStats` | `communications.schema.ts` | **NO** | Child of `announcement` |

Path: `services/api-ts/src/handlers/communications/repos/communications.schema.ts`.

### documents (3/4 scoped)

| # | Table Name | Variable | Schema File | Has orgId | Category |
|---|-----------|----------|-------------|-----------|----------|
| 52 | `document` | `documents` | `documents.schema.ts` | YES | — |
| 53 | `document_access_log` | `documentAccessLogs` | `documents.schema.ts` | **NO** | Child of `document` |
| 54 | `document_tag` | `documentTags` | `documents.schema.ts` | YES | — |
| 55 | `document_version` | `documentVersions` | `documents.schema.ts` | YES | — |

Path: `services/api-ts/src/handlers/documents/repos/documents.schema.ts`.

### dues (4/7 scoped)

| # | Table Name | Variable | Schema File | Has orgId | Category |
|---|-----------|----------|-------------|-----------|----------|
| 56 | `dues_org_config` | `duesConfigs` | `dues-payments.schema.ts` | YES | — |
| 57 | `dues_fund` | `duesFunds` | `dues-payments.schema.ts` | YES | — |
| 58 | `dues_gateway_config` | `duesGatewayConfigs` | `dues-payments.schema.ts` | YES | — |
| 59 | `dues_payment` | `duesPayments` | `dues-payments.schema.ts` | YES | — |
| 60 | `dues_category_override` | `duesCategoryOverrides` | `dues-payments.schema.ts` | **NO** | Child of `dues_org_config` |
| 61 | `dues_fund_allocation` | `duesFundAllocations` | `dues-payments.schema.ts` | **NO** | Child of `dues_fund` |
| 62 | `dues_reminder_schedule` | `duesReminderSchedules` | `dues-payments.schema.ts` | **NO** | Child of `dues_org_config` |

Path: `services/api-ts/src/handlers/dues/repos/dues-payments.schema.ts`.

### elections (1/3 scoped)

| # | Table Name | Variable | Schema File | Has orgId | Category |
|---|-----------|----------|-------------|-----------|----------|
| 63 | `election` | `elections` | `elections.schema.ts` | YES | — |
| 64 | `election_nominee` | `electionNominees` | `elections.schema.ts` | **NO** | Child of `election` |
| 65 | `election_vote` | `electionVotes` | `elections.schema.ts` | **NO** | Child of `election` |

Path: `services/api-ts/src/handlers/elections/repos/elections.schema.ts`.

### email (0/2 scoped)

| # | Table Name | Variable | Schema File | Has orgId | Category |
|---|-----------|----------|-------------|-----------|----------|
| 66 | `email_template` | `emailTemplates` | `email.schema.ts` | **NO** | **Needs orgId** |
| 67 | `email_queue` | `emailQueue` | `email.schema.ts` | **NO** | **Needs orgId** |

Path: `services/api-ts/src/handlers/email/repos/email.schema.ts`.

### invite (0/1 scoped)

| # | Table Name | Variable | Schema File | Has orgId | Category |
|---|-----------|----------|-------------|-----------|----------|
| 68 | `invitation_token` | `invitationTokens` | `invite.schema.ts` | **NO** | **Needs orgId** |

Path: `services/api-ts/src/handlers/invite/repos/invite.schema.ts`.

### notifs (0/1 scoped)

| # | Table Name | Variable | Schema File | Has orgId | Category |
|---|-----------|----------|-------------|-----------|----------|
| 69 | `notification` | `notifications` | `notification.schema.ts` | **NO** | **Needs orgId** |

Path: `services/api-ts/src/handlers/notifs/repos/notification.schema.ts`.

### person (0/3 scoped)

| # | Table Name | Variable | Schema File | Has orgId | Category |
|---|-----------|----------|-------------|-----------|----------|
| 70 | `person` | `persons` | `person.schema.ts` | **NO** | **Needs orgId** |
| 71 | `notification_preference` | `notificationPreferences` | `notification-preferences.schema.ts` | **NO** | **Needs orgId** |
| 72 | `person_privacy_setting` | `personPrivacySettings` | `privacy-settings.schema.ts` | **NO** | **Needs orgId** |

Path: `services/api-ts/src/handlers/person/repos/`.

### platformadmin (0/5 scoped) — Intentionally Global

| # | Table Name | Variable | Schema File | Has orgId | Category |
|---|-----------|----------|-------------|-----------|----------|
| 73 | `organization` | `organizations` | `platform-admin.schema.ts` | **NO** | Global by design |
| 74 | `association` | `associations` | `platform-admin.schema.ts` | **NO** | Global by design |
| 75 | `platform_admin` | `platformAdmins` | `platform-admin.schema.ts` | **NO** | Global by design |
| 76 | `feature_flag` | `featureFlags` | `platform-admin.schema.ts` | **NO** | Global by design |
| 77 | `impersonation_session` | `impersonationSessions` | `platform-admin.schema.ts` | **NO** | Global by design |

Path: `services/api-ts/src/handlers/platformadmin/repos/platform-admin.schema.ts`.
Rationale: These tables define organizations, associations, and platform-level administration. `organization` IS the tenant — it cannot be scoped to itself. `platform_admin` and `feature_flag` are system-wide. `impersonation_session` tracks admin actions across all orgs.

### reviews (0/1 scoped)

| # | Table Name | Variable | Schema File | Has orgId | Category |
|---|-----------|----------|-------------|-----------|----------|
| 78 | `review` | `reviews` | `review.schema.ts` | **NO** | **Needs orgId** |

Path: `services/api-ts/src/handlers/reviews/repos/review.schema.ts`.

### storage (0/1 scoped)

| # | Table Name | Variable | Schema File | Has orgId | Category |
|---|-----------|----------|-------------|-----------|----------|
| 79 | `stored_file` | `storedFiles` | `file.schema.ts` | **NO** | **Needs orgId** |

Path: `services/api-ts/src/handlers/storage/repos/file.schema.ts`.

---

## Categorization of 44 Unscoped Tables

### Category A: Intentionally Global (12 tables) — No Change Needed

These tables are global by design. No `organizationId` column should be added.

| Table | Module | Justification |
|-------|--------|---------------|
| `user` | better-auth | Cross-org identity hub. Users join orgs via membership. |
| `session` | better-auth | User sessions are identity-level, not org-level. |
| `account` | better-auth | OAuth provider links are per-user, not per-org. |
| `verification` | better-auth | Email/phone verification is per-user. |
| `passkey` | better-auth | WebAuthn credentials are per-user. |
| `two_factor` | better-auth | TOTP secrets are per-user (but need encryption — P0-1). |
| `apikey` | better-auth | API keys are per-user. |
| `organization` | platformadmin | IS the tenant. Cannot scope to itself. |
| `association` | platformadmin | Cross-org entity (associations span organizations). |
| `platform_admin` | platformadmin | System-wide admin roster. |
| `feature_flag` | platformadmin | System-wide feature toggles. |
| `impersonation_session` | platformadmin | Admin actions tracked across all orgs. |

### Category B: Needs `organizationId` — Direct Scoping Required (19 tables)

These tables have no org-scoped parent to inherit from. Must add `organizationId` column directly.

| Priority | Table | Module | Risk | Migration Complexity |
|----------|-------|--------|------|---------------------|
| **P0** | `audit_log_entry` | audit | HIPAA compliance gap. Cross-org audit trail exposure. | S — add column, update `logEvent()`, backfill from handler context |
| **P0** | `person` | person | Central PII hub visible across all orgs. | M — hub entity, many FKs reference it. Backfill via membership table |
| **P0** | `invoice` | billing | Cross-org financial data leakage. | M — Stripe integration touchpoints |
| **P0** | `merchant_account` | billing | Payment credentials exposed cross-org. | S — add column + index |
| **P0** | `chat_room` | comms | Chat data leakage between orgs. | S — add column, update create/query |
| **P0** | `chat_message` | comms | Chat content leakage between orgs. | S — add column, update create/query |
| **P1** | `notification_preference` | person | PII-adjacent. Preferences visible cross-org. | S — add column, backfill from person→membership→org |
| **P1** | `person_privacy_setting` | person | PII-adjacent. Privacy choices visible cross-org. | S — add column, backfill from person→membership→org |
| **P1** | `invoice_line_item` | billing | Financial line items exposed cross-org. | S — add column, backfill from invoice |
| **P1** | `booking` | booking | Scheduling data exposed cross-org. | S — add column + index |
| **P1** | `booking_event` | booking | Event bookings exposed cross-org. | S — add column + index |
| **P1** | `schedule_exception` | booking | Schedule data exposed cross-org. | S — add column + index |
| **P1** | `time_slot` | booking | Time slot data exposed cross-org. | S — add column + index |
| **P1** | `email_template` | email | Org-specific templates visible to other orgs. | S — add column + index |
| **P1** | `email_queue` | email | Email queue entries visible cross-org. | S — add column + index |
| **P1** | `notification` | notifs | Notifications visible cross-org. | S — add column + index |
| **P1** | `stored_file` | storage | Files accessible cross-org. | S — add column, update upload/download |
| **P2** | `review` | reviews | NPS reviews visible cross-org. | S — add column + index |
| **P2** | `invitation_token` | invite | Invitations visible cross-org. | S — add column + index |

### Category C: Child of Org-Scoped Parent — Add `organizationId` for Defense-in-Depth (13 tables)

These tables have a logical FK to an org-scoped parent. They inherit org context implicitly through JOINs, but **should still get their own `organizationId` column** for:
1. Direct query performance (avoid JOINs for org filtering)
2. Defense-in-depth (if parent FK is corrupted, child is still isolated)
3. Row-level security (RLS policies need a direct column)

| Table | Module | Parent Table | Parent Has orgId |
|-------|--------|-------------|-----------------|
| `event_registration` | association:operations | `event` | YES |
| `check_in` | association:operations | `event` (via registration) | YES |
| `waitlist_entry` | association:operations | `event` | YES |
| `training_enrollment` | association:operations | `training` | YES |
| `course_enrollment` | association:operations | `course` | YES |
| `quiz_attempt` | association:operations | `course` | YES |
| `announcement_stats` | communications | `announcement` | YES |
| `document_access_log` | documents | `document` | YES |
| `dues_category_override` | dues | `dues_org_config` | YES |
| `dues_fund_allocation` | dues | `dues_fund` | YES |
| `dues_reminder_schedule` | dues | `dues_org_config` | YES |
| `election_nominee` | elections | `election` | YES |
| `election_vote` | elections | `election` | YES |

---

## Migration Plan

### Phase 1: P0 Critical Tables (6 tables)

Execute as part of P0-7 from `.planning/P0-P1-FIXES.md`. Each table is an independent migration.

**Pattern for each table**:
1. Add `organizationId` column (nullable initially for backfill)
2. Add index on `organizationId`
3. Add FK to `organization` table
4. Backfill existing rows from related data
5. Set column to `NOT NULL` after backfill
6. Update all repo queries to include `WHERE organizationId = ?`
7. Update all INSERT operations to include `organizationId` from request context

#### 1. `audit_log_entry` (audit)

```
Schema: services/api-ts/src/handlers/audit/repos/audit.schema.ts
Repo:   services/api-ts/src/handlers/audit/repos/audit.repo.ts
```

- Add `organizationId uuid` column + index + FK
- Update `AuditService.logEvent()` to require `organizationId` parameter
- Update all callers to pass `ctx.var.orgId`
- Add `WHERE organizationId = ?` to all audit queries
- Backfill: derive orgId from `user` → `membership` → `organizationId`

#### 2. `person` (person)

```
Schema: services/api-ts/src/handlers/person/repos/person.schema.ts
Repo:   services/api-ts/src/handlers/person/repos/person.repo.ts
```

- Add `organizationId uuid` column + index + FK
- **Note**: Person is a hub entity referenced by many tables. This is the most complex migration.
- A person can belong to multiple orgs. Consider: should this be a join table instead of a column? If a person can only belong to one org at a time, a column works. If multi-org, the `membership` table already handles this — person itself may remain global with org-scoped access enforced at the query layer.
- **Decision needed**: Direct column vs. query-layer enforcement via `membership` JOIN.
- Backfill: via `memberships.personId` → `memberships.organizationId`

#### 3. `invoice` (billing)

```
Schema: services/api-ts/src/handlers/billing/repos/billing.schema.ts
Repo:   services/api-ts/src/handlers/billing/repos/billing.repo.ts
```

- Add `organizationId uuid` column + index + FK
- Update Stripe webhook handlers to capture org context
- Backfill: derive from `merchant_account` or billing context

#### 4. `merchant_account` (billing)

```
Schema: services/api-ts/src/handlers/billing/repos/billing.schema.ts
Repo:   services/api-ts/src/handlers/billing/repos/billing.repo.ts
```

- Add `organizationId uuid` column + index + FK
- Each org has its own Stripe Connect account — natural 1:1 mapping
- Backfill: from Stripe metadata or manual mapping

#### 5. `chat_room` (comms)

```
Schema: services/api-ts/src/handlers/comms/repos/comms.schema.ts
Repo:   services/api-ts/src/handlers/comms/repos/comms.repo.ts
```

- Add `organizationId uuid` column + index + FK
- Update chat room creation to capture org context
- Backfill: derive from participants' membership org

#### 6. `chat_message` (comms)

```
Schema: services/api-ts/src/handlers/comms/repos/comms.schema.ts
Repo:   services/api-ts/src/handlers/comms/repos/comms.repo.ts
```

- Add `organizationId uuid` column + index + FK
- Inherit org from `chat_room` on insert
- Backfill: derive from parent `chat_room`

### Phase 2: P1 Tables (11 tables)

After Phase 1 establishes the pattern. Same migration approach per table.

| Table | Module | Backfill Source |
|-------|--------|----------------|
| `notification_preference` | person | `person` → `membership` → org |
| `person_privacy_setting` | person | `person` → `membership` → org |
| `invoice_line_item` | billing | Parent `invoice.organizationId` (after Phase 1) |
| `booking` | booking | Request context / org header |
| `booking_event` | booking | Request context / org header |
| `schedule_exception` | booking | Request context / org header |
| `time_slot` | booking | Request context / org header |
| `email_template` | email | Request context / org header |
| `email_queue` | email | Request context / org header |
| `notification` | notifs | Request context / org header |
| `stored_file` | storage | Request context / upload context |

### Phase 3: P2 Tables + Defense-in-Depth (15 tables)

Lower priority. Includes 2 P2 tables + 13 child tables.

| Table | Module | Backfill Source |
|-------|--------|----------------|
| `review` | reviews | Request context |
| `invitation_token` | invite | Request context |
| `event_registration` | association:operations | Parent `event.organizationId` |
| `check_in` | association:operations | Parent `event.organizationId` via registration |
| `waitlist_entry` | association:operations | Parent `event.organizationId` |
| `training_enrollment` | association:operations | Parent `training.organizationId` |
| `course_enrollment` | association:operations | Parent `course.organizationId` |
| `quiz_attempt` | association:operations | Parent `course.organizationId` |
| `announcement_stats` | communications | Parent `announcement.organizationId` |
| `document_access_log` | documents | Parent `document.organizationId` |
| `dues_category_override` | dues | Parent `dues_org_config.organizationId` |
| `dues_fund_allocation` | dues | Parent `dues_fund.organizationId` |
| `dues_reminder_schedule` | dues | Parent `dues_org_config.organizationId` |
| `election_nominee` | elections | Parent `election.organizationId` |
| `election_vote` | elections | Parent `election.organizationId` |

---

## Org Isolation Test Cases

For each table that receives `organizationId`, implement these test patterns:

### Unit Tests (per table)

```typescript
// 1. Insert with orgId
test('insert stores correct organizationId', async () => {
  const record = await repo.create({ ...data, organizationId: orgA.id });
  expect(record.organizationId).toBe(orgA.id);
});

// 2. Query filters by orgId
test('query returns only org-scoped records', async () => {
  await repo.create({ ...data, organizationId: orgA.id });
  await repo.create({ ...data, organizationId: orgB.id });
  const results = await repo.findAll({ organizationId: orgA.id });
  expect(results).toHaveLength(1);
  expect(results[0].organizationId).toBe(orgA.id);
});

// 3. Cross-org isolation
test('org A cannot access org B data', async () => {
  const orgBRecord = await repo.create({ ...data, organizationId: orgB.id });
  const result = await repo.findById(orgBRecord.id, { organizationId: orgA.id });
  expect(result).toBeNull();
});
```

### Contract Tests (per API endpoint)

```hurl
# Verify API returns only org-scoped data
GET {{base_url}}/resource
x-org-id: {{org_a_id}}
Authorization: Bearer {{org_a_token}}
HTTP 200
[Asserts]
jsonpath "$.data[*].organizationId" includes "{{org_a_id}}"
jsonpath "$.data[*].organizationId" not includes "{{org_b_id}}"
```

### E2E Tests

```typescript
// Multi-org user sees correct data per org context
test('switching org context shows different data', async () => {
  // Login as user with membership in both Org A and Org B
  await switchOrg(orgA);
  const orgAData = await fetchRecords();

  await switchOrg(orgB);
  const orgBData = await fetchRecords();

  // No overlap in IDs
  const orgAIds = orgAData.map(r => r.id);
  const orgBIds = orgBData.map(r => r.id);
  expect(orgAIds.filter(id => orgBIds.includes(id))).toHaveLength(0);
});
```

---

## Special Considerations

### Person Table: Multi-Org Design Decision

The `person` table is the central PII hub. A person can belong to multiple organizations via the `membership` table. Two approaches:

**Option A: Add `organizationId` to `person`** (simpler, but forces 1:1)
- Pro: Simple queries, consistent with other tables
- Con: Breaks multi-org membership model. Person duplicated per org.

**Option B: Keep `person` global, enforce org-scoping at query layer** (recommended)
- Pro: Preserves multi-org membership. Person exists once.
- Con: Every query must JOIN through `membership` for org filtering. More complex.
- Implementation: Add `orgScopedPersonQuery()` helper that always JOINs membership.

**Recommendation**: Option B. The `membership` table already serves as the person-to-org bridge. Adding `organizationId` to `person` would duplicate data and break the multi-org model. Instead, enforce org scoping via query helpers and middleware.

### Better-Auth Tables: Security Without Org Scoping

Better-Auth tables are intentionally global but have security concerns:
- `two_factor`: Secrets stored plaintext (P0-1 fix — encrypt, don't add orgId)
- `session`: Tokens stored plaintext (P0-2 fix — hash, don't add orgId)
- `user.email`: Global unique constraint blocks multi-org (P1-8 fix)

These are addressed by separate P0/P1 fixes, not by adding `organizationId`.

### Platform Admin Tables: Global by Design

Platform admin tables (`organization`, `association`, `platform_admin`, `feature_flag`, `impersonation_session`) are system-level entities. The `organization` table IS the tenant — scoping it to itself is circular. Access is controlled via `platformAdminMiddleware`, not org scoping.

---

## Cross-Reference with P0-P1-FIXES.md

| P0-P1 Fix | Tables Affected | Status in This Audit |
|-----------|----------------|---------------------|
| P0-3: Add orgId to audit log | `audit_log_entry` | Phase 1, table #28 |
| P0-7: Multi-tenant table scoping | All 32 non-global unscoped tables | This entire document |
| P1-8: Fix user.email unique | `user` (better-auth) | Intentionally global — separate fix |

---

## Verification Checklist

- [x] Table count verified: 79 tables across 29 schema files
- [x] 35 tables confirmed to have `organizationId` column in schema definition
- [x] 44 tables confirmed to lack `organizationId` column
- [x] 12 tables categorized as intentionally global with justification
- [x] 19 tables categorized as needing direct `organizationId`
- [x] 13 tables categorized as child tables needing defense-in-depth `organizationId`
- [x] Migration phased by priority (P0 → P1 → P2/defense-in-depth)
- [x] Test patterns defined for org isolation verification
- [x] Cross-referenced with P0-P1-FIXES.md
- [x] Person table multi-org design decision documented
