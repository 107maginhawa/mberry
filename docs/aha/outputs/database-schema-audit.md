# AHA Database / Schema Audit

Date: 2026-06-11
Prompt: `docs/aha/prompts/06-database-schema-audit.md`
Scope: platform-wide database/schema risk review (audit-only — no source/test/schema/migration/seed edits, no commit).
Codebase root: `/Users/elad-mini/Desktop/memberry`

> Method note: schema surface read directly from `services/api-ts/src/handlers/*/repos/*.schema.ts`, `services/api-ts/src/core/database.schema.ts` (base entity fields), `services/api-ts/src/generated/migrations/*.sql` + `meta/_journal.json` (64 migrations, 0000–0063), `services/api-ts/src/core/domain-event-consumers.ts` (person-deletion cascade), and `services/api-ts/src/seed/*`. Already-fixed items verified against the 14 `*-fix-report.md` files. Routed-here items (cross-cutting §11) classified `Fixed` / `Still Open` / `Planned-Not-Completed` per 06 §3. No DB was booted (`DATABASE_URL` unset) → live migration-apply and live constraint verification are `[BLOCKED BY ENVIRONMENT]`.

---

## 1. Inputs Reviewed

| Input | Details |
| --- | --- |
| Module audit index | `docs/aha/outputs/module-audit-index.md` (reviewed; §10 Database/Schema Groups consumed) |
| Gap plans reviewed | All 14 (`docs/aha/module-gap-plans/*-gap-plan.md`); schema-flagged items in dues, billing, membership, surveys, realtime-comms, documents, person read in detail |
| Fix-ready plans reviewed | All 14 (context only; Batch F = db-schema isolation in membership/dues/documents/realtime-comms/surveys) |
| Completed fix reports reviewed | All 14 (`*-fix-report.md`) — authoritative; dues + billing schema fixes confirmed `Fixed` |
| Cross-cutting audit reviewed | `docs/aha/outputs/cross-cutting-pattern-audit.md` — §11 routed 6 schema items here; honored |
| Schema/model files inspected | All 35 `*.schema.ts` under `handlers/*/repos/` + `core/database.schema.ts`. Detailed: membership, status-history, dues-payments, dues, certificates, comms, survey, person, documents, billing, governance, elections, credits, platform-admin, audit, advertising, jobs |
| Migration files inspected | `meta/_journal.json` (64 entries 0000–0063); `0016`/`0019` (multi-tenant scoping), `0062` (receipt counter), `0063` (billing metadata indexes) read in full |
| Seed/fixture files inspected | `src/seed/` (layer-1…layer-7-*, data.ts, helpers.ts, reset-mutated.ts); inventory only (no live run) |
| Repository/query files inspected | `core/domain-event-consumers.ts` (full person-deletion cascade), dues/billing/membership repos via fix reports |
| API/handler files inspected | Via fix reports + cross-cutting audit (validators.ts `targetAudience` lines, generated org-id optional lines) |
| Validation schemas inspected | `services/api-ts/src/generated/openapi/validators.ts` (`targetAudience: z.object` at 4131/9097/9192/9220/9542; org-id `.optional()` cross-cutting P-2) |
| Tests inspected | Referenced in fix reports (`statusRecomputeCron.integration.test.ts` proved live missing-column P0; receipt-collision test); not re-run |
| KG used | Yes (secondary) — `.understand-anything/knowledge-graph.json` per `docs/aha/kg/knowledge-graph-status.md` (3,474 nodes, generated 2026-06-06) |
| KG refreshed | No — schema ownership answerable by direct inspection; KG 5 days stale, doc-restructure not represented `[NEEDS CONFIRMATION]` on KG-derived blast-radius |
| `/understand-domain` used | Yes (secondary) — `.understand-anything/domain-graph.json` per `docs/aha/kg/domain-knowledge-status.md`; product docs (DOMAIN_MODEL, WORKFLOW_MAP, br-registry) are primary |
| `/understand-domain` refreshed | No — unnecessary |
| Webwright used | No — schema/data-layer findings are backend; no UI-journey question required browser proof |
| Playwright/E2E inspected | No (not run this pass; E2E env-blocked platform-wide per cross-cutting P-6) |
| Limitations | (1) `[BLOCKED BY ENVIRONMENT]` — no booted/seeded DB → migrations `0016`/`0019`/`0062`/`0063` live-apply + live nullability unverified. (2) Live row-counts/orphan checks impossible without DB. (3) KG 5 days stale. (4) Seed files inventoried, not executed. |

---

## 2. Fix Status Interpretation

| Module/Group | Gap Plan Exists? | Fix-Ready Plan Exists? | Fix Report Exists? | Schema/Data Status | Notes |
| --- | --- | --- | --- | --- | --- |
| dues-payments | Yes | Yes | Yes | **Fixed** | Per-org receipt counter (`dues_receipt_counter`) + per-org receipt unique (`dued_payment_org_receipt_unique`) replacing global unique. Migration `0062` + schema present. Live apply env-blocked. |
| billing-stripe | Yes | Yes | Yes | **Fixed** | Invoice-metadata expression indexes (`invoices_metadata_payment_intent_idx`, `invoices_metadata_transfer_idx`). Migration `0063` present. Live apply env-blocked. |
| membership-lifecycle | Yes | Yes | Yes | Partially Fixed | Status-truth cron P0 fixed reading only real columns; **`resigned_at`/`expelled_at` additive columns NOT added** (Batch F, product-gated). Enum values `resigned`/`deceased`/`expelled` already present. |
| surveys-polls | Yes | Yes | Yes | **Still Open** (schema) | Read-auth fixed (Batch A); `targetAudience` union normalization + person-deletion FK/anonymization for `survey_response` deferred (Batch F). |
| realtime-comms | Yes | Yes | Yes | **Still Open** (schema) | Real-time delivery fixed (Batch A); `chat_room`/`chat_message` `organization_id` NOT NULL migration deferred (Batch F). Schema says `.notNull()`, DB columns nullable (migration ordering bug). |
| documents-credentials | Yes | Yes | Yes | **Still Open** (schema) | Access-log + status enforcement fixed (Batch B1); certificate PDF/training-linkage backfill + cert-schema migration deferred (Batch C/F, Q8-gated). Cert schema itself exists + is rich. |
| person-profile | Yes | Yes | Yes | Partially Fixed | Privacy-key P0 fixed; person-deletion FK cascade design is in scope here (06). `survey_response` + chat tables NOT in cascade (see §8). |
| auth-rbac | Yes | Yes | Yes | No Schema/Data Issue Found | Enforcement-layer fixes; no schema change. |
| platform-admin | Yes | Yes | Yes | No Schema/Data Issue Found | Test-hardening + super-gates; no schema change. `breach_incident`/`support_ticket` `organizationId` nullable by design (platform-wide). |
| communications | Yes | Yes | Yes | No Schema/Data Issue Found (this audit) | Delivery spine fixed; no schema defect surfaced. |
| training-credits | Yes | Yes | Yes | No Schema/Data Issue Found | Credit-award journey fixed; credit schema sound (`credit_entry` unique `uq_credit_source_person`). |
| elections-governance | Yes | Yes | Yes | No Schema/Data Issue Found | Close-voting op added; election/vote/nominee FK cascades sound. |
| notifications-email | Yes | Yes | Yes | No Schema/Data Issue Found | Suppression baseline; no schema defect. |
| marketplace-advertising | Yes | Yes | Yes | No Schema/Data Issue Found | Route-prefix fix (not schema); advertising/marketplace schemas org-scoped + sound. |

---

## 3. Schema Ownership Map

| Table/Model | Owning Module/Group | Owning Module Slug | Shared? | Main Consumers | Evidence | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `person` | Person & Profile | person-profile | **Yes (hub)** | Nearly every module FK-references `persons.id` | `handlers/person/repos/person.schema.ts` | Central PII hub; deletion cascade blast radius |
| `membership`, `membership_tier`, `membership_category`, `membership_application` | Membership | membership-lifecycle | Yes | dues, credits, elections targeting, directory | `association:member/repos/membership.schema.ts` | Heavily shared; enum has resigned/deceased/expelled |
| `membership_status_history` | Membership | membership-lifecycle | No | audit/compliance reads | `association:member/repos/status-history.schema.ts` | Append-only history (no immutability guard) |
| `dues_payment`, `dues_org_config`, `dues_fund`, `dues_fund_allocation`, `dues_receipt_counter`, `dues_gateway_config`, `webhook_retry_log`, `dues_reminder_*` | Dues | dues-payments | Yes | membership status, billing, platformadmin | **Canonical** `handlers/dues/repos/dues-payments.schema.ts`; `association:member/repos/dues*.schema.ts` are re-export shims (BCI-01 circular-dep break) | Not a duplicate source of truth — shims only |
| `dues_payment_status_history` | Dues | dues-payments | No | financial audit trail | `association:member/repos/dues-payment-status-history.schema.ts` | Append-only history (no immutability guard) |
| `invoice`, `merchant_account` | Billing | billing-stripe | Yes | dues online-pay, booking, platformadmin | `handlers/billing/repos/billing.schema.ts` | `customer`/`merchant` → persons (restrict) |
| `certificate`, `org_certificate_seq` | Documents/Credentials | documents-credentials | Yes | training (m09 seam), member id-card | `handlers/member/certificates/repos/certificates.schema.ts` | Per-org cert seq + unique cert number |
| `credential_*`, `digital_credential` | Credentials | documents-credentials | Yes | training renewal | `association:member/repos/credentials.schema.ts` | |
| `credit_entry`, `org_cpd_config` | Credits | training-credits | Yes (3 dirs) | training, credentials renewal, member profile | `association:member/repos/credits.schema.ts` | Schema in member/repos feeds 3 handler dirs (do not relocate — P1-11 collision) |
| `position`, `officer_term`, `transition_checklist`, `disciplinary_action` | Governance | elections-governance | Yes | RBAC officer checks, election transition | `association:member/repos/governance.schema.ts` | |
| `election`, `election_nominee`, `election_vote` | Elections | elections-governance | Yes | governance officer transition | `handlers/elections/repos/elections.schema.ts` | Cascade on election delete; person FK on votes |
| `survey`, `survey_response` | Surveys | surveys-polls | No | feed/notify | `communication/repos/survey.schema.ts` | `respondent_id` nullable, **no declared FK** |
| `chat_room`, `chat_message`, `chat_room_member`, `chat_message_reaction` | Realtime Comms | realtime-comms | No | memberry chat UI | `handlers/comms/repos/comms.schema.ts` | `organization_id` `.notNull()` in Drizzle, nullable in DB |
| `message_template`, `message`, `announcement`, `person_subscription`, `saved_segment`, `feed_post` | Communications | communications | Yes | email/notifs delivery | `communication/repos/communication.schema.ts`, `feed-post.schema.ts` | |
| `document`, `document_version`, `document_tag`, `document_access_log` | Documents | documents-credentials | Yes | credentials, profile | `handlers/documents/repos/documents.schema.ts` | Access-log present |
| `organization`, `association`, `feature_flag`, `platform_admin`, `impersonation_session`, `breach_incident`, `support_ticket`, `ticket_comment`, `pricing_tier`, `subscription` | Platform Admin | platform-admin | **Yes (root)** | all org-scoped tables FK `organization.id` | `platformadmin/repos/platform-admin.schema.ts` | `organization` is the org-scoping anchor |
| `audit_log_entry` | Audit | platform-admin | Yes | compliance | `handlers/audit/repos/audit.schema.ts` | Retention-status enum; no DB-level immutability |
| `job_posting`, `job_application` | Jobs | jobs | Yes | discover UI | `handlers/jobs/repos/*.schema.ts` | org-scoped; routes emitted at root (cross-cutting P-1, not schema) |
| `payment_token` | Dues (one-tap) | dues-payments | No | officer payment links | `member/duesspecialassessments/repos/` | HMAC token, person + org FK |
| `notification_preference`, `person_privacy_settings`, `notification_preferences` | Person | person-profile | Yes | comms/email targeting | `person/repos/*.schema.ts` | |

---

## 4. Database / Schema Groups

| Schema Area | Tables/Models | Related Modules | Risk | Notes |
| --- | --- | --- | --- | --- |
| Identity / PII hub | `person`, `notification_preference`, `person_privacy_settings` | person-profile, all | High | Deletion cascade is fire-and-forget; survey/chat tables not covered (§8) |
| Membership lifecycle | `membership*`, `membership_status_history` | membership-lifecycle | Medium | Enum complete; lifecycle timestamps incomplete (`resigned_at`/`expelled_at` absent) |
| Financial | `dues_*`, `invoice`, `merchant_account`, `payment_token` | dues-payments, billing-stripe | High | Receipt counter + metadata indexes Fixed; BR-32 preserves amounts on deletion |
| Records / history | `*_status_history`, `audit_log_entry`, `certificate`, `document_access_log` | membership, dues, audit, documents | Medium | Append-only by convention, no DB immutability/trigger guard |
| Governance / elections | `position`, `officer_term`, `election*` | elections-governance | Medium | FK cascades sound; person FK restrict-by-default on votes |
| Multi-tenant scoping | `organization_id` on ~all tables | platform-admin (anchor) + all | High | `chat_room`/`chat_message` org_id nullable in DB despite schema `.notNull()` |
| Realtime comms | `chat_*` | realtime-comms | High | org_id mismatch + not in deletion cascade |
| Surveys | `survey`, `survey_response` | surveys-polls | Medium | `targetAudience` API-layer union (not a column); `respondent_id` no FK, not anonymized on deletion |

---

## 5. Critical Schema Risks

| Risk | Area | Severity | Scope Label | Affected Modules | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **R-1 `chat_room`/`chat_message`.`organization_id` nullable in DB despite `.notNull()` in Drizzle** (migration ordering bug: `0016` adds columns nullable + comments out `SET NOT NULL`; `0019`'s `SET NOT NULL` gated behind `IF NOT EXISTS(column)` → never runs after 0016) | Multi-tenant scoping / realtime | P1 | V1 REQUIRED | realtime-comms | `0016_multi_tenant_scoping.sql:15-31` (nullable, NOT NULL commented out); `0019_p0-7-multi-tenant-scoping.sql:709-715` (skipped when column exists); `comms.schema.ts` `organizationId: uuid('organization_id').notNull()` | Schema↔DB mismatch; WS/system messages can insert NULL org → cross-org chat data-isolation hole; no read-path org filter | Backfill org_id from room row, then `SET NOT NULL` migration. **Still Open** (realtime-comms Batch F). Derive orgId server-side `[DO NOT OVERBUILD]` — do not add middleware. |
| **R-2 `survey_response` not anonymized on `person.deleted`; `respondent_id` nullable `uuid` with NO declared FK** | Privacy / deletion | P1 | V1 REQUIRED | surveys-polls, person-profile | `core/domain-event-consumers.ts` — 9 `person.deleted` subscribers, **none touch `surveyResponses`** (grep: 0 hits for survey/respondent in cascade); `survey.schema.ts` `respondentId: uuid('respondent_id')` (no `.references()`) | Identified (`type='identified'`) survey responses retain a dangling `respondent_id` after account deletion → de-anonymization + BR-32 violation. No FK means deletion isn't blocked, so the orphan is silent | Add a `person.deleted` → surveys subscriber that nullifies/anonymizes `respondent_id` for identified responses (anon responses already NULL by BR-40). **Still Open** (surveys Batch F). |
| **R-3 `chat_message`/`chat_room_member`/`chat_message_reaction` not in `person.deleted` cascade** | Privacy / deletion | P2 | V1 RECOMMENDED | realtime-comms, person-profile | `domain-event-consumers.ts` imports + 9 subscribers list — no chat tables; `chat_message.sender` is plain `uuid` (no FK), `chat_room_member.person_id` plain uuid | Deleted person's messages + room memberships + reactions retain their personId → PII residue in chat history | Add chat-table handling to the cascade (anonymize sender display, drop memberships) once R-1 org backfill lands. `[NEEDS PRODUCT DECISION]` on retain-vs-delete chat history. |
| **R-4 Person-deletion cascade is fire-and-forget with no completion guarantee** (cross-cutting P-8) | Deletion integrity | P2 | V2 DEFERRED | person-profile + 9 cascade modules | `domain-event-consumers.ts` each subscriber owns try/catch + log only; a silent failure drops a cleanup step | A failed subscriber leaves partial PII residue with no retry/aggregation; `deletion_completed_at` may be set while cleanup incomplete | Delivery-semantics change is high blast radius across 9 subscribers → dedicated core-platform audit (P-8). Not a schema column fix. **V2 DEFERRED**. |
| **R-5 `membership` lacks `resigned_at`/`expelled_at` timestamps** (enum values exist; only `removed_at`/`date_of_death` columns present) | Lifecycle | P2 | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` | membership-lifecycle | `membership.schema.ts` — `membershipStatusEnum` has `resigned`/`expelled`; columns: `suspendedAt`, `removedAt`, `removalReason`, `dateOfDeath` — no resigned/expelled timestamp | Cannot report *when* a member resigned/was expelled without reading `membership_status_history`; reporting + reinstatement-eligibility windows rely on it | Additive `resigned_at` (+later `expelled_at`) migration, gated on §8 lifecycle product decisions. **Planned-Not-Completed** (membership Batch F). |
| **R-6 Generated Zod marks required `organizationId`/`orgId` as `.optional()`** (cross-cutting P-2) | Validation / scoping | P1 | V1 RECOMMENDED | person-profile + any handler trusting validator for org presence | `validators.ts` 30+ `organizationId: z.string().optional()` lines (98, 193, 354…); generator `scripts/generate.ts` | If any handler trusts the validator for org presence, org scoping is silently skippable | Generator-level fix (emit non-optional for org-required ops) OR document `orgContextMiddleware` as sole authority. Generator change, not a schema column. Routed from 05; **Still Open**. |
| **R-7 No DB-level immutability on append-only history/audit tables** | Records / audit | P3 | V1 RECOMMENDED | membership, dues, audit | `membership_status_history`, `dues_payment_status_history`, `audit_log_entry` — all have `...baseEntityFields` (incl. `updatedAt`, `version`) and standard `pgTable`; no trigger/grant preventing UPDATE/DELETE | History/audit rows are technically mutable; a buggy or malicious UPDATE could rewrite the financial/compliance trail | Convention-level today (handlers only INSERT). DB trigger or revoke is V1-RECOMMENDED hardening, not blocking. `[DO NOT OVERBUILD]` — do not add a generic event-store. |

---

## 6. Data Integrity Findings

| Finding | Table/Model | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| `survey_response.respondent_id` is `uuid` with no `.references(persons.id)` | `survey_response` | `survey.schema.ts` (nullable, no FK) | P2 | Intentional for BR-40 anonymity, BUT identified responses then have an unconstrained personId that no cascade cleans (R-2). Keep nullable; add cascade anonymization |
| `chat_message.sender`, `chat_room_member.person_id`, `chat_message_reaction.person_id` are plain `uuid` with no person FK | comms tables | `comms.schema.ts` (`sender: uuid('sender_id').notNull()` — no references) | P3 | No referential integrity to `person`; orphan/dangling sender possible. Acceptable if cascade handles it (R-3); otherwise add FK |
| `dues_payment.invoice_id` is `uuid` with no FK to any invoice table | `dues_payment` | `dues-payments.schema.ts:79` `invoiceId: uuid('invoice_id')` (no references); no `dues_invoice` table exists | P3 | Dues uses billing `invoice` or an external ref; loose coupling intentional. `[NEEDS CONFIRMATION]` whether `invoice_id` ever points to `billing.invoice.id` — if so add FK |
| `org_id` nullable in DB on `chat_room`/`chat_message` | comms | `0016`/`0019` migration ordering (R-1) | P1 | See R-1 |
| `breach_incident.organization_id` and `support_ticket.organization_id` nullable (by design: platform-wide rows) | platform-admin | `platform-admin.schema.ts:130` (`// nullable for platform-wide`), `:157` | P3 | Intentional; documented in schema. No change |
| BR-32 financial preservation: dues amounts + invoices retained on deletion (only proof PII anonymized) | `dues_payment`, `invoice` | cascade sets `proofStorageKey/FileName/MimeType=null`, keeps amounts; billing deactivates merchant only | P3 (correct) | Sound — financial record preserved. No change |
| No global duplicate source of truth: `association:member/repos/dues*.schema.ts` are `export *` shims of canonical `dues/repos/` | dues | `dues.schema.ts` / `dues-payments.schema.ts` (member dir) = 3-line re-export comments (BCI-01) | P3 (resolved) | Verified not a duplicate. No change |

---

## 7. Tenant / Org / User / Permission Scoping Findings

| Finding | Table/Model/API | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| `chat_room`/`chat_message` org_id nullable in DB → tenant isolation not enforced at column level | comms | R-1; `0016:15-31`, `0019:709-715` | P1 | Backfill + `SET NOT NULL` (realtime-comms Batch F) |
| Generated validator marks org-required `organizationId` `.optional()` | generated `validators.ts` | R-6; 30+ lines | P1 | Generator fix or documented middleware authority (routed from 05) |
| `organization_id` consistently present + indexed on org-scoped tables (membership, dues, billing, documents, surveys, elections, governance, advertising, marketplace, jobs) | platform-wide | direct grep — every audited org-scoped table has `organizationId` + an org index | P3 (good) | No change — scoping representation is consistent |
| Record-org *ownership* asserted per-handler, not via shared assertion (cross-cutting P-7) | membership (has `assert-record-org.ts`), realtime-comms | `membership-lifecycle-fix-report.md` §12 | P2 | `[DO NOT OVERBUILD]` — promote to shared `core/` helper only on 2+ more consumers |
| `audit_log_entry` scoped, retention-status enum present | audit | `audit.schema.ts:104` `retentionStatus` default `active` | P3 (good) | No change |

---

## 8. Audit / History / Record Safety Findings

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Person-deletion cascade covers 9 module subscribers but MISSES `survey_response` (identified responses keep personId) | surveys | R-2; `domain-event-consumers.ts` (no survey handler in cascade) | P1 | Add survey anonymization subscriber (Batch F) |
| Person-deletion cascade MISSES `chat_*` tables (messages/memberships/reactions keep personId) | realtime-comms | R-3; cascade imports list has no chat schema | P2 | Add chat handling once org_id backfill lands; `[NEEDS PRODUCT DECISION]` retain-vs-delete |
| Cascade is best-effort (fire-and-forget); `deletion_completed_at` may be set with cleanup incomplete | person + 9 modules | R-4; `person.schema.ts` has `deletion_*` timestamps; each subscriber try/catch-logs | P2 | Core-platform delivery-guarantee audit (P-8, V2 DEFERRED) |
| History/audit tables technically mutable (no DB immutability) | `*_status_history`, `audit_log_entry` | R-7; all use `baseEntityFields` + plain `pgTable` | P3 | Convention-enforced today; DB trigger/revoke is V1-RECOMMENDED hardening |
| Certificate records retained + anonymized-by-reference on deletion (records kept for compliance) | certificate | cascade sets `updatedBy=SYSTEM` only, keeps row | P3 (correct) | Sound compliance design |
| BR-32: dues amounts + invoices preserved, only proof PII stripped | dues, billing | cascade (R-6 row in §6) | P3 (correct) | Sound |
| `dateOfDeath` recorded on deceased; `removedAt`/`removalReason` on removal — but no resigned/expelled timestamp | membership | R-5 | P2 | Additive timestamp columns (Batch F, product-gated) |

---

## 9. Lifecycle / Status Model Findings

| Finding | Table/Model | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| `membership_status` enum is complete (10 values incl. resigned/deceased/expelled) but lifecycle *timestamps* incomplete | `membership` | `membership.schema.ts` enum + columns (R-5) | P2 | `resigned_at`/`expelled_at` additive migration, product-gated |
| `dues_payment_status` enum rich + has dedicated `dues_payment_status_history` audit table | `dues_payment` | `dues-payments.schema.ts` enum; `dues-payment-status-history.schema.ts` | P3 (good) | No change |
| `election_status` 6-state machine matches governance flow incl. `awaitingConfirmation` (close-voting op added) | `election` | `elections.schema.ts:8`; elections-governance fix report | P3 (good) | No change |
| `certificate_status` (`issued`/`revoked`) with `revokedAt`/`revokedReason` | `certificate` | `certificates.schema.ts` | P3 (good) | No change |
| `term_status` enum (`upcoming`/`active`/`completed`/`resigned`/`removed`) + date-order CHECK constraint | `officer_term` | `governance.schema.ts` `check('officer_term_date_order', …)` | P3 (good) | Exemplary — CHECK constraints rare elsewhere |
| `credit_status` (`active`/`voided`/`disputed`) + unique `uq_credit_source_person` prevents double-award | `credit_entry` | `credits.schema.ts` | P3 (good) | No change |

---

## 10. API / UI / Schema Mismatches

| Mismatch | UI/API/Schema Area | Affected Modules | Evidence | Severity | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| `targetAudience` is an API-layer object (`z.object` in validators at 5 sites) collected by `survey-builder.tsx` but **never persisted as a normalized column** — survey uses `distribution` enum + `categoryFilter` jsonb | surveys API ↔ schema | surveys-polls | `validators.ts:4131/9097/9192/9220/9542` `targetAudience: z.object`; `survey.schema.ts` has `distribution`/`categoryFilter` (no `targetAudience` column); `survey-builder.tsx:180-194` collects it | P2 | Normalize the API `targetAudience` union → the schema's `distribution`+`categoryFilter`, OR add a `target_audience` jsonb column. Decide canonical shape before enforcing targeting (surveys Batch F) |
| Generated Zod org-id `.optional()` vs schema `.notNull()` | generated validators ↔ schema | person-profile + all | R-6 | P1 | Generator fix (routed from 05) |
| Comms FE never sends `x-org-id`; schema expects org_id | comms FE ↔ schema | realtime-comms | realtime gap plan (FE zero `x-org-id` usage) | P1 | Derive org server-side from room row (R-1) |
| `dues_payment.invoice_id` populated by handlers but no FK / no `dues_invoice` table | dues API ↔ schema | dues-payments | §6 row | P3 | Confirm target; add FK if it references `billing.invoice` |

---

## 11. Migration Health Findings

| Finding | Migration/Schema Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| **64 migrations (0000–0063), `_journal.json` version 7, sequential idx 0–63** — ordering intact | all | `meta/_journal.json` | P3 (healthy) | No change |
| **Migration ordering bug**: `0016` adds `chat_room`/`chat_message` org_id nullable + comments out `SET NOT NULL`; `0019` `SET NOT NULL` gated on `IF NOT EXISTS(column)` (false after 0016) → columns stay nullable | `0016`, `0019` | `0016:15-31`, `0019:709-715` | P1 | Corrective additive `SET NOT NULL` migration after backfill (R-1) |
| Hand-written migrations `0062`/`0063` (drizzle-kit `generate` exits 127 in CI — documented) | `0062`, `0063` | migration header comments | P2 | Drizzle-kit generation failure is a recurring CI/tooling issue → future migrations must be hand-written + reviewed. `[BLOCKED BY ENVIRONMENT]` on root-causing exit 127 |
| `0062` per-org receipt counter + drops global `dues_payment_receipt_unique`, adds `dues_payment_org_receipt_unique` | dues | `0062_dues_receipt_counter.sql` | P3 (Fixed) | Live apply env-blocked — verify after booted stack |
| `0063` expression indexes on `invoice.metadata->>'stripePaymentIntentId'`/`'stripeTransferId'` | billing | `0063_billing_webhook_metadata_indexes.sql` | P3 (Fixed) | Live apply env-blocked — verify after booted stack |
| `0050_timestamptz-migration` present; new tables use `withTimezone: true` consistently | all | journal + schema grep (0 `timestamp(` without `withTimezone` in audited handlers) | P3 (good) | Timestamp consistency healthy |
| **LIVE-APPLY of `0016`/`0019`/`0062`/`0063` UNVERIFIED** — `DATABASE_URL` unset, no booted DB | all | cross-cutting P-6; no DB this pass | P1 (process) | `[BLOCKED BY ENVIRONMENT]` — boot + seed stack, apply migrations, verify constraints (see §21) |

---

## 12. Seed Data / Fixture / Test Data Findings

| Finding | File/Area | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- |
| Layered seed system present (`layer-1-foundation`…`layer-7-{comms,dues,member,misc,platform}`, `data.ts`, `helpers.ts`, `reset-mutated.ts`, `diagnose-seed-data.ts`) | `src/seed/` | file inventory | Seed infra is mature + layered | Inventory only — not executed (env-blocked) |
| Seed drift vs new schema additions (`dues_receipt_counter`, receipt prefix, comms org_id) UNVERIFIED | `layer-7-dues.ts`, `layer-7-comms.ts` | not run | If seeds don't set org_id on chat rows, they'll reproduce the R-1 nullable hole | `[BLOCKED BY ENVIRONMENT]` — run seed after booted stack; confirm seeds set `organization_id` on chat + claim receipt numbers via counter |
| Whether seed honors per-org receipt counter vs old `count(*)` sequence | `layer-7-dues.ts` | `0062` changed sequence source | Stale seed could insert colliding receipts | Verify post-stack |

---

## 13. Index / Query Performance Risks

| Risk | Query/Table Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Invoice→Stripe correlation was O(n) `findAll(limit 500)` → silently failed >500 invoices | `invoice.metadata` | `0063` header (money captured, invoice never marked paid) | P2 (Fixed) | `0063` expression indexes added — Fixed; verify live |
| Receipt-number generation was `count(*)`-based (race + no index) | `dues_payment` | `0062` header | P2 (Fixed) | `dues_receipt_counter` atomic counter — Fixed |
| Org-scoped list/read paths well-indexed (org idx + compound org+status/org+person on membership, dues, invoice, chat, documents) | platform-wide | per-table index blocks | P3 (good) | No missing-index risk surfaced for common queries |
| `survey_response` indexed on `survey_id` + `respondent_id`; aggregation queries covered | surveys | `survey.schema.ts` indexes | P3 (good) | No change |
| `chat_message` heavily compound-indexed (room+timestamp, sender+timestamp, room+type, parent) | comms | `comms.schema.ts` index block | P3 (good) | Indexing is thorough |

---

## 14. External / Integration Identifier Findings

| Finding | Identifier / Integration Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Stripe IDs stored in `invoice.metadata` jsonb (`stripePaymentIntentId`, `stripeTransferId`) — now indexed | billing/Stripe | `0063`; `billing.schema.ts` `metadata` jsonb | P3 (Fixed) | Expression indexes back lookups — sound |
| Gateway secrets AES-GCM encrypted (`dues_gateway_config.encrypted_secret`), not plaintext (gap-plan "plaintext" note was outdated per dues fix report) | dues/PayMongo/Stripe | `dues-payments.schema.ts` `encryptedSecret: text(...)`; dues prompt-03 log correction | P3 (good) | No change — confirmed encrypted |
| `webhook_retry_log` with unique `idempotency_key` + retry status/next-retry indexes | dues/Stripe webhooks | `dues-payments.schema.ts` | P3 (good) | Idempotency + dead-letter handling present |
| `payment_token` stores HMAC-SHA256 hash (never raw), single-use, 72h expiry, org+person FK | dues one-tap | `payment_token` schema | P3 (good) | Secure-by-design |
| OneSignal targeting via `external_id` (person id), not stored secret | notifs | CLAUDE.md OneSignal pattern | P3 | No schema risk |

---

## 15. Knowledge Graph Findings

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| KG used as secondary only; schema ownership resolved by direct inspection | `kg/knowledge-graph-status.md` (3,474 nodes, 2026-06-06) | KG 5 days stale; doc-restructure + post-Jun-6 schema work (0062/0063, member/membership topology) not represented | `[NEEDS CONFIRMATION]` on any KG-derived blast-radius; refresh before a KG-dependent platform schema fix |
| `person` confirmed as highest-fan-in node (deletion blast radius) via direct FK grep, consistent with KG hub role | direct `references(() => persons.id)` grep across all schemas | Validates cascade is the critical correctness surface | Prioritize R-2/R-3/R-4 |
| Real handler topology (`member/` 215 files vs `association:member/` remnant) means schema lives in `association:member/repos/` not `member/*/repos/` | direct find (membership schema at `association:member/repos/membership.schema.ts`) | Audit/doc references to schema paths must use real location | Sync CLAUDE.md schema paths (doc-drift, not a schema bug) |

---

## 16. Domain / Data Lifecycle Findings

| Domain Finding | Related Table/Model | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- |
| Membership is the source-of-truth for member state; status computed-on-read after the cron P0 fix | `membership` | membership fix report (status-truth) | Downstream dues/credit/election eligibility key off this | Sound post-fix; add lifecycle timestamps (R-5) for reporting |
| Survey anonymity is an architectural guarantee (BR-40): `respondent_id` NULL for anonymous at write time | `survey_response` | `survey.schema.ts` BR-40 comment | Correct for anonymous; identified responses are the de-anon risk (R-2) | Cascade must anonymize identified responses |
| Financial records (dues, invoices) are immutable-by-business-rule (BR-32 preserve on deletion) | `dues_payment`, `invoice` | cascade + BR-32 | Correct; amounts retained, PII stripped | Sound; consider DB immutability hardening (R-7) `[DO NOT OVERBUILD]` |
| Certificate + audit records retained for compliance, PII anonymized by reference | `certificate`, `audit_log_entry` | cascade (`updatedBy=SYSTEM`) | Correct compliance lifecycle | Sound |
| Chat history lifecycle on member departure is **undefined** (retain vs delete vs anonymize) | `chat_*` | no cascade handling | Cannot decide R-3 fix without product call | `[NEEDS PRODUCT DECISION]` |

---

## 17. Webwright / Playwright Findings

Not used this pass. Schema/data-layer findings are backend-resolvable; no UI-journey question required browser proof, and E2E/contract layers are env-blocked platform-wide (cross-cutting P-6). No evidence captured, no screenshots saved.

| Finding | Tool | Evidence Location | Affected Data Area | Recommendation |
| --- | --- | --- | --- | --- |
| (none) | — | — | — | Defer schema↔UI save/reload proof (e.g. comms org_id, survey targeting) to a post-P-6 booted-stack E2E pass |

---

## 18. Module-Local Schema Fix Candidates

| Fix | Module/Group | Evidence | Severity | Recommended Prompt |
| --- | --- | --- | --- | --- |
| Backfill + `SET NOT NULL` on `chat_room`/`chat_message`.`organization_id` (R-1) | realtime-comms | `0016`/`0019` ordering bug | P1 | `04-module-or-group-fix-tdd.md` (realtime-comms Batch F) |
| Add `person.deleted` → surveys subscriber to anonymize identified `survey_response.respondent_id` (R-2) | surveys-polls (+ core consumer) | cascade gap | P1 | `04-module-or-group-fix-tdd.md` (surveys Batch F) — edits shared `core/domain-event-consumers.ts`, path-scope it |
| Normalize `targetAudience` API union ↔ schema `distribution`/`categoryFilter` (or add column) before targeting enforcement | surveys-polls | `validators.ts` vs `survey.schema.ts` | P2 | `04` surveys Batch F (after product decision on canonical shape) |
| Additive `resigned_at` (+later `expelled_at`) migration (R-5) | membership-lifecycle | enum present, columns absent | P2 | `04` membership Batch F (after §8 lifecycle decisions) |
| Certificate PDF/training-linkage backfill + cert-schema migration (Q8) | documents-credentials | documents fix report §10 (Q8/Batch C/F) | P2 | `04` documents Batch C/F (after Q8 decision) |

---

## 19. Platform-Wide / Shared Schema Fix Candidates

| Fix | Why Platform-Wide | Affected Modules | Evidence | Risk | Recommended Prompt |
| --- | --- | --- | --- | --- | --- |
| Generator: emit non-optional `organizationId` for org-required ops (R-6) | One generator change fixes all modules' validator org-presence; touches `scripts/generate.ts` → all `validators.ts` | person-profile + every org-scoped module | cross-cutting P-2; `validators.ts` 30+ optional lines | Medium (must not flip genuinely-optional ops) | future specialized schema/database fix prompt (needs required-org op list first) |
| Person-deletion cascade completeness + delivery guarantee (R-3 chat coverage + R-4 retry/aggregation) | Cascade spans 9+ modules; adding coverage + changing bus semantics is cross-module | person-profile + all cascade modules | `domain-event-consumers.ts`; cross-cutting P-8 | High (bus blast radius) | dedicated core-platform audit (delivery semantics) + `04` per-module for missing table coverage |
| DB-level immutability hardening on history/audit tables (R-7) | Same pattern across membership/dues/audit history | membership, dues, audit | §8/R-7 | Low | `07-consolidate-roadmap.md` (prioritize as V1-RECOMMENDED hardening); `[DO NOT OVERBUILD]` no event-store |
| Resolve drizzle-kit `generate` exit-127 CI failure (forces all-hand-written migrations) | Tooling blocks normal migration generation platform-wide | all future migrations | `0061`/`0062`/`0063` headers | Low | resolve environment/tooling blocker |

---

## 20. Product Decisions Needed

| Decision | Label | Affected Tables/Modules | Why Needed | Suggested Owner / Next Step |
| --- | --- | --- | --- | --- |
| Chat history on member departure: retain / anonymize / delete? | `[NEEDS PRODUCT DECISION]` | `chat_message`, `chat_room_member`, `chat_message_reaction` (realtime-comms) | Determines R-3 cascade behavior | Product → then realtime-comms `04` |
| Canonical survey targeting shape: API `targetAudience` union vs schema `distribution`+`categoryFilter` | `[NEEDS PRODUCT DECISION]` | `survey`, `survey_response` (surveys) | R-2/targeting enforcement + §10 mismatch | Product → then surveys Batch F |
| Membership lifecycle timestamps + reinstatement windows (governs `resigned_at`/`expelled_at`) | `[NEEDS PRODUCT DECISION]` | `membership` (R-5) | membership §8 state-machine decisions gate the additive migration | Product (already in membership-lifecycle §8) |
| Certificate backfill strategy for already-issued artifacts (Q8) | `[NEEDS CONFIRMATION]` | `certificate`, `org_certificate_seq` (documents) | Gates cert-schema migration (Batch C/F) | Eng/Product (documents Q8) |
| Does `dues_payment.invoice_id` reference `billing.invoice.id`? (add FK or keep loose) | `[NEEDS CONFIRMATION]` | `dues_payment`, `invoice` | Decides whether to add an FK constraint | Eng — trace handler write path |
| Should history/audit tables be DB-immutable (trigger/revoke) or convention-only? | `[NEEDS PRODUCT DECISION]` | `*_status_history`, `audit_log_entry` | Compliance posture for financial/audit trail (R-7) | Product/Compliance |

---

## 21. Blockers

| Blocker | Label | Affected Tables/Modules | Impact | Recommended Next Step |
| --- | --- | --- | --- | --- |
| No booted/seeded DB (`DATABASE_URL` unset) | `[BLOCKED BY ENVIRONMENT]` | all — esp. `0016`/`0019`/`0062`/`0063` | Live migration-apply, live nullability of comms org_id, receipt-uniqueness, seed-drift, orphan-row counts all unverified | Boot + seed stack; apply migrations; verify constraints + run seed; clears cross-cutting P-6 |
| drizzle-kit `generate` exits 127 in CI | `[BLOCKED BY ENVIRONMENT]` | all future migrations | Forces hand-written migrations (`0061`–`0063`); error-prone | Root-cause exit 127 (tooling pass) |
| Person-deletion cascade delivery semantics (R-4) touch 9+ subscribers | `[CROSS-MODULE RISK]` | person + all cascade modules | Changing bus delivery is high blast radius | Dedicated core-platform audit (not a module batch) |
| KG 5 days stale | `[NEEDS CONFIRMATION]` | schema blast-radius claims | Post-Jun-6 schema work not represented | Refresh `/understand-anything` before KG-dependent platform schema fix |
| Survey targeting + chat-retention product calls unmade | `[NEEDS PRODUCT DECISION]` | survey, chat | Blocks R-2 targeting + R-3 cascade | Product-decision pass |

---

## 22. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Domain-event bus retry/aggregation/delivery-guarantee layer (R-4) | `V2 DEFERRED` | High blast radius across 9 subscribers; dedicated core-platform audit, not a schema column |
| Generic event-store / append-only framework for all history tables | `DO NOT ADD` `[DO NOT OVERBUILD]` | Targeted trigger/revoke per history table suffices (R-7); a framework is premature |
| Promote `assert-record-org.ts` to shared `core/` record-org guard | `[DO NOT OVERBUILD]` | Only 1 strong + 1 partial consumer (cross-cutting P-7); revisit on 2+ more |
| Add person FK to `chat_message.sender`/`chat_room_member.person_id` purely for integrity | `[NEEDS PRODUCT DECISION]` | Only worthwhile alongside the R-3 cascade decision; don't add FK in isolation |
| Speculative analytics/reporting columns, soft-delete `deleted_at` on every table | `DO NOT ADD` | No repeated V1 evidence; current soft-delete is per-domain status enums, which is correct |
| New `target_audience` jsonb column before the union-shape decision | `[NEEDS PRODUCT DECISION]` | Adding a column before deciding the canonical shape risks a second migration |

---

## 23. Recommended Schema Fix Order

| Order | Fix | Scope | Why Now | Tests Needed First | Risk | Recommended Prompt |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **R-2** survey `person.deleted` anonymization (identified `respondent_id`) | cross-module | Open privacy/BR-32 violation; identified responses leak personId after deletion | RED: cascade test asserting `respondent_id` nulled for identified responses | Low (path-scoped consumer edit) | `04` surveys Batch F |
| 2 | **R-1** comms `chat_room`/`chat_message` org_id backfill + `SET NOT NULL` | database/schema | Open tenant-isolation hole; schema↔DB mismatch | RED: insert NULL-org message fails after migration; backfill correctness | Medium (corrective migration on live data — needs booted stack) | `04` realtime-comms Batch F (after P-6) |
| 3 | **P-6 / env** boot+seed stack, apply `0016`-fix/`0062`/`0063`, verify constraints + seed drift | environment/tooling | Unblocks live verification of every schema fix | n/a (infra) | Medium | resolve environment/tooling blocker |
| 4 | **R-6** generator non-optional org-id for org-required ops | shared/platform | Removes silent org-scope-skippable validator class | Generator unit test on required-org op set | Medium | future specialized schema/database fix prompt |
| 5 | **R-5** membership `resigned_at`/`expelled_at` additive migration | database/schema | Reporting + reinstatement windows | Migration review; backfill from status_history | Low (additive) | `04` membership Batch F (after product decision) |
| 6 | **targetAudience** normalize union ↔ schema | database/schema | Unblocks survey targeting enforcement | Decide shape; migration if column added | Low | `04` surveys Batch F (after product decision) |
| 7 | **Q8** certificate backfill + cert-schema migration | database/schema | Cert PDF/training linkage | Backfill plan; migration | Low | `04` documents Batch C/F (after Q8) |
| 8 | **R-3** chat-table cascade coverage | cross-module | PII residue in chat history | RED: chat anonymized on deletion | Low-Med | `04` realtime-comms (after retention decision) |
| 9 | **R-7** history/audit DB immutability hardening | shared/platform | Compliance posture | Trigger/revoke test | Low | `07` prioritize (V1-RECOMMENDED) |
| — | **R-4** cascade delivery guarantee | product decision / cross-module | High blast radius | n/a | High | dedicated core-platform audit (V2) |

---

## 24. Recommended Next Step

**Proceed to `07-consolidate-roadmap.md`.**

Rationale: this database/schema audit was the final unaudited surface. The data layer is, on balance, **healthy** — org-scoping is consistently represented and indexed, timestamps are timezone-consistent (`0050` migration), lifecycle/status enums are complete, financial idempotency (receipt counter `0062`, webhook-retry, expression indexes `0063`) is sound and the two routed fixes are confirmed `Fixed`, and there is no duplicate source of truth (the apparent dues-schema duplication is re-export shims). The genuine open risks are a small, well-scoped set:

- **2 P1** schema items — comms `org_id` NOT NULL backfill (R-1, realtime-comms Batch F) and survey identified-response anonymization in the deletion cascade (R-2, surveys Batch F) — both module-local Batch-F work for a 2nd `04` pass.
- **1 P1 platform** generator fix (R-6, org-id `.optional()`, routed from 05) for a future specialized schema/database prompt.
- **4 P2 / 1 P3** items (membership timestamps, targetAudience normalization, cert backfill, chat cascade coverage, history immutability) mostly product-decision-gated.

These should be **scheduled, not fixed here** (06 is audit-only). The consolidated roadmap (07) is the correct owner: it will distinguish the already-`Fixed` dues/billing schema work from the `Still Open` (R-1, R-2, R-6) and `Planned-Not-Completed` (R-5, cert backfill) items, fold them next to the cross-cutting code fixes (jobs `/postings` P0, generated-route integrity suite, fake-green gate), and sequence them behind the **environment blocker (P-6)** and the **6 product decisions** in §20.

Recommended sequencing into 07:
- **Module/group + slugs**: realtime-comms (`realtime-comms`, R-1 Batch F), surveys-polls (`surveys-polls`, R-2 + targetAudience Batch F), membership-lifecycle (`membership-lifecycle`, R-5 Batch F), documents-credentials (`documents-credentials`, cert backfill Batch C/F).
- **Platform**: generator org-id fix (R-6), cascade completeness/delivery (R-3/R-4 → core-platform audit), history-table immutability (R-7).
- **Blocker first**: stand up booted+seeded stack (P-6) so `0016`-fix/`0062`/`0063` apply + comms-org-id/receipt-uniqueness/seed-drift can be verified.
- **File paths**: schema sources under `services/api-ts/src/handlers/*/repos/*.schema.ts`; migrations under `services/api-ts/src/generated/migrations/`; cascade at `services/api-ts/src/core/domain-event-consumers.ts`; generator at `services/api-ts/src/scripts/generate.ts`.

Then run `docs/aha/prompts/07-consolidate-roadmap.md`.
