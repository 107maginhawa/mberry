# Spec Coverage Report (oli-enforce-coverage)

**Generated:** 2026-05-29
**Analyzer:** Phase 0 enforcement suite
**Scope:** 19 module specs + 26 handler directories

---

## 1. Per-Module Coverage Table

The specs use a non-standard 22-section structure (see Section Mapping below). All 19 modules have MODULE_SPEC.md files with all 22 spec-internal sections present. The audit focuses on **section quality** (COMPLETE vs PARTIAL) and **code existence**.

| Module | Self-Score | Partial Sections | Has Backend | Has Frontend | Grade |
|--------|-----------|------------------|-------------|--------------|-------|
| M01 Auth & Onboarding | 23/23 | 0 | Yes (person: 24, invite: 3) | Yes (auth/, verify/) | A |
| M02 Member Profile | 23/23 | 0 | Yes (person: 24) | Yes (my/profile, my/settings) | A |
| M03 Platform Admin | 23/23 | 0 | Yes (platformadmin: 40) | Yes (admin app) | A |
| M04 Org Admin | 23/23 | 0 | Yes (association:member: 194) | Yes (org/$orgSlug/officer/) | A |
| M05 Membership | 23/23 | 0 | Yes (membership: 15, association:member) | Yes (org/$orgSlug/directory) | A |
| M06 Dues & Payments | 23/23 | 0 | Yes (dues: 6) | Yes (my/payments, my/billing) | A |
| M07 Communications | 23/23 | 0 | Yes (communication: 46, comms: 13) | Yes (announcements/, chat) | A |
| M08 Events | 23/23 | 0 | Yes (events: 15) | Yes (my/events) | A |
| M09 Training | 23/23 | 0 | Yes (training: 14) | Yes (my/training) | A |
| M10 Credit Tracking | 22/22 | 0 | Yes (training: 14) | Yes (my/credits/) | A |
| M11 Documents & Creds | 21/22 | 1: Edge Cases | Yes (documents: 15, certificates: 6) | Yes (documents/, certificates/) | A- |
| M12 Elections | 21/22 | 1: Edge Cases | Yes (elections: 9) | Yes (elections/) | A- |
| M13 Professional Feed | 19/23 | 4: Permissions, Data Req, Aggregates, Domain Events | No dedicated handler | Partial (discover/) | B |
| M14 National Dashboard | 19/23 | 4: Permissions, Data Req, Aggregates, Domain Events | Yes (association:operations: 69) | Yes (admin/national) | B+ |
| M15 Job Board | 22/23 | 1: Permissions | Yes (jobs: 7) | No | A- |
| M16 Advertising | 22/23 | 1: Permissions | Yes (advertising: 7) | No | A- |
| M17 Marketplace | 22/23 | 1: Permissions | Yes (marketplace: 9) | No | A- |
| M18 Surveys & Polls | 21/23 | 2: Permissions, Data Req | Yes (surveys: 16) | Yes (my/surveys/) | B+ |
| M19 Committee Mgmt | 23/23 | 0 | No dedicated handler | No | A (spec-only) |

**Grading:**
- A = 22-23/23 complete, no partials, has source code
- A- = 21-22/23 complete, 1 partial
- B+ = 19-22/23 complete, 2-4 partials, has source
- B = 19-22/23 complete, 4+ partials or missing source

---

## 2. Overall Coverage Score

| Metric | Value |
|--------|-------|
| **Breadth Score** (modules with specs / modules with code) | 19/19 = **100%** |
| **Depth Score** (avg sections complete / total sections) | 414/432 = **95.8%** |
| **Overall Coverage Score** | **93/100** |

Deductions:
- -3 for 8 unspecced handler directories (P0 findings)
- -2 for PARTIAL permissions across 6 modules (missing ROLE_PERMISSION_MATRIX entries)
- -2 for M13/M14 having 4 partial sections each

---

## 3. Findings (EC- format)

### P0: Module with source code but NO spec

| ID | Description |
|----|-------------|
| EC-BOOKING-nospec | `handlers/booking/` (19 handlers) has no MODULE_SPEC. Maps to scheduling/time-slots but no module owns it. |
| EC-BILLING-nospec | `handlers/billing/` (16 handlers) has no MODULE_SPEC. Stripe Connect integration is unspecced. |
| EC-STORAGE-nospec | `handlers/storage/` (6 handlers) has no MODULE_SPEC. S3/MinIO file ops unspecced. |
| EC-EMAIL-nospec | `handlers/email/` (13 handlers) has no MODULE_SPEC. Transactional email queue unspecced. |
| EC-NOTIFS-nospec | `handlers/notifs/` (6 handlers) has no MODULE_SPEC. OneSignal push notifications unspecced. |
| EC-AUDIT-nospec | `handlers/audit/` (1 handler) has no MODULE_SPEC. Compliance logging unspecced. |
| EC-REVIEWS-nospec | `handlers/reviews/` (4 handlers) has no MODULE_SPEC. NPS review system unspecced. |
| EC-INVITE-nospec | `handlers/invite/` (3 handlers) has no MODULE_SPEC. Partially covered by M01 but no dedicated spec. |

### P1: Spec section completely missing (no heading)

None. All 19 specs have all section headings present.

### P2: Spec section is stub or PARTIAL

| ID | Module | Section | Issue |
|----|--------|---------|-------|
| EC-M11-edgecases | M11 Documents & Creds | 13. Edge Cases | PARTIAL: zero-credit certificate needs [VERIFY] |
| EC-M12-edgecases | M12 Elections | 13. Edge Cases | PARTIAL: tie-breaking, nominee withdrawal, hybrid vote need [VERIFY] |
| EC-M13-permissions | M13 Professional Feed | 6. Permissions | PARTIAL: no ROLE_PERMISSION_MATRIX section |
| EC-M13-datamodel | M13 Professional Feed | 7. Data Requirements | PARTIAL: no feed_post table in DOMAIN_MODEL |
| EC-M13-aggregates | M13 Professional Feed | 7b. Aggregate Boundaries | PARTIAL: MutePreference entity missing from DOMAIN_MODEL |
| EC-M13-events | M13 Professional Feed | 10b. Domain Events | PARTIAL: consumed events derived, not validated |
| EC-M14-permissions | M14 National Dashboard | 6. Permissions | PARTIAL: no ROLE_PERMISSION_MATRIX section |
| EC-M14-datamodel | M14 National Dashboard | 7. Data Requirements | PARTIAL: computed view, no persisted entity |
| EC-M14-aggregates | M14 National Dashboard | 7b. Aggregate Boundaries | PARTIAL: read-only module, no domain aggregates |
| EC-M14-events | M14 National Dashboard | 10b. Domain Events | PARTIAL: consumed events derived, not validated |
| EC-M15-permissions | M15 Job Board | 6. Permissions | PARTIAL: no ROLE_PERMISSION_MATRIX section |
| EC-M16-permissions | M16 Advertising | 6. Permissions | PARTIAL: no ROLE_PERMISSION_MATRIX section |
| EC-M17-permissions | M17 Marketplace | 6. Permissions | PARTIAL: no ROLE_PERMISSION_MATRIX section |
| EC-M18-permissions | M18 Surveys & Polls | 6. Permissions | PARTIAL: no ROLE_PERMISSION_MATRIX section |
| EC-M18-datamodel | M18 Surveys & Polls | 7. Data Requirements | PARTIAL: no DOMAIN_MODEL tables (since resolved in Wave 6) |

### P3: Spec section present but thin (< 3 lines of content)

| ID | Module | Section | Issue |
|----|--------|---------|-------|
| EC-M14-statemachine | M14 National Dashboard | 8. State Transitions | Read-only module, section says "N/A" -- 1 line |

---

## 4. Unspecced Code Directories

These handler directories exist in `services/api-ts/src/handlers/` but have no corresponding MODULE_SPEC:

| Directory | Handlers | TypeSpec? | Likely Ownership |
|-----------|----------|-----------|------------------|
| `booking/` | 19 | Yes | Standalone scheduling module (not covered by any M01-M19) |
| `billing/` | 16 | Yes | Stripe Connect -- should be M06 sibling or standalone |
| `storage/` | 6 | Yes | Platform infra -- could be infra spec |
| `email/` | 13 | Yes | Platform infra -- transactional email |
| `notifs/` | 6 | Mixed | Platform infra -- OneSignal push |
| `audit/` | 1 | Yes | Platform infra -- compliance logging |
| `reviews/` | 4 | Yes | NPS reviews -- could fold into M18 or standalone |
| `invite/` | 3 | Yes | Partially covered by M01 onboarding spec |

**Total unspecced handlers:** 68 (out of ~596 total) = **11.4% of codebase is unspecced**

Note: `jobs/` under handlers is the M15 Job Board implementation (createJobPosting, searchJobPostings, etc.), not background job infrastructure. The M15 spec maps to this directory.

Also confirmed: `communications/` handler directory does NOT exist. M07 maps to `communication/` + `comms/` only.

---

## 5. Breadth Score

| Metric | Count |
|--------|-------|
| Total modules defined | 19 |
| Modules with specs | 19 |
| Modules with backend code | 16 (M13, M19 have no dedicated handlers; M15 maps to jobs/) |
| Modules with frontend code | 14 |
| Handler dirs with specs | 18/26 (excluding __tests__) |
| **Breadth** | **19/19 = 100%** |

---

## 6. Depth Score

| Category | Score |
|----------|-------|
| Modules with 0 partials (full coverage) | 10/19 (53%) |
| Modules with 1 partial | 5/19 (26%) |
| Modules with 2 partials | 1/19 (5%) |
| Modules with 4 partials | 2/19 (11%) |
| Modules not yet implemented (spec-only) | 1/19 (5%) |
| **Avg sections complete per module** | **21.8/23 = 94.8%** |

---

## 7. Section Mapping: Standard 22 vs Spec 22

The MODULE_SPEC files use a **different 22-section structure** than the standard 22 requested. Here is the mapping:

| Standard Section | Spec Section(s) |
|-----------------|-----------------|
| Module Identity | 1. Module Overview |
| Purpose & Scope | 1. Purpose + In Scope + Out of Scope |
| User Stories | 3. Workflows + 4. Workflow Details |
| Functional Requirements | 5. Business Rules |
| Non-Functional Requirements | 16. Performance Expectations |
| Data Model | 7. Data Requirements + 7b. Aggregate Boundaries |
| API Endpoints | 10. API Expectations |
| Business Rules | 5. Business Rules (shared with Functional Req) |
| State Machines | 8. State Transitions |
| Domain Events | 10b. Domain Events |
| Error Taxonomy | 15. Error Handling |
| Access Control / Permissions | 6. Permissions |
| Validation Rules | 5. Business Rules (implicit) |
| Integration Points | 14. Dependencies |
| UI/UX Requirements | 9. UI/UX Requirements |
| Notifications | 17. Observability Hooks |
| Audit Requirements | 17. Observability Hooks (shared) |
| Performance Requirements | 16. Performance Expectations (shared with NFR) |
| Migration Strategy | 19. Vertical Slice Plan |
| Test Strategy | 12. Test Expectations |
| Acceptance Criteria | 11. Acceptance Criteria |
| Open Questions | 22. Downstream Impact |

**Additional spec sections not in standard 22:** 2. Domain Terms, 13. Edge Cases, 18. Feature Flags, 20. AI Instructions, 21. Section Completeness

---

## 8. Remediation Priority

### Immediate (P0) -- Create MODULE_SPECs for unspecced code:
1. **booking/** -- 19 handlers, actively used, zero spec coverage
2. **billing/** -- 16 handlers, Stripe integration, zero spec coverage
3. **email/** -- 13 handlers, transactional email, zero spec coverage

### Short-term (P2) -- Fix PARTIAL sections:
4. Add ROLE_PERMISSION_MATRIX entries for M13-M18 (6 modules)
5. Add DOMAIN_MODEL entries for M13 (feed_post), M18 (survey tables)
6. Resolve [VERIFY] tags in M11, M12 edge cases

### Low priority (P3):
7. M14 state transitions section is thin (read-only module, acceptable)

---

*Report generated by oli-enforce-coverage Phase 0*
