# Module Enforcement: m15-job-board

**Score:** 0.0/10 — CRITICALLY NON-COMPLIANT
**Source:** No handler directory (Future module)
**Spec:** docs/product/modules/m15-job-board/MODULE_SPEC.md
**Status:** COMPLETE
**Date:** 2026-05-28

## Dimension Scores

| Dimension | Score | P0 | P1 | P2 | P3 |
|-----------|-------|----|----|----|-----|
| Public API Completeness | 0/10 | 0 | 9 | 0 | 0 |
| Workflow Implementation | 0/10 | 0 | 5 | 0 | 0 |
| Domain Term Consistency | N/A | 0 | 0 | 0 | 0 |
| State Machine Enforcement | 0/10 | 0 | 2 | 0 | 0 |
| Event Publishing | 0/10 | 0 | 4 | 0 | 0 |
| Business Rule Enforcement | 0/10 | 0 | 6 | 0 | 0 |
| Auth/Permission Enforcement | 0/10 | 0 | 7 | 0 | 0 |

**Total P1 findings: 33**

## Findings — Public API Completeness

| ID | Sev | Dimension | Finding | File | Confidence |
|----|-----|-----------|---------|------|------------|
| EM-M15-4a1b8c2d | P1 | Public API | GET /orgs/{orgId}/jobs — List job postings: Not implemented (future module) | N/A | HIGH |
| EM-M15-5e3f9a0b | P1 | Public API | GET /orgs/{orgId}/jobs/{jobId} — Job detail: Not implemented (future module) | N/A | HIGH |
| EM-M15-6c7d2e4f | P1 | Public API | POST /orgs/{orgId}/jobs — Create posting: Not implemented (future module) | N/A | HIGH |
| EM-M15-7a8b1c3d | P1 | Public API | PATCH /orgs/{orgId}/jobs/{jobId} — Update posting: Not implemented (future module) | N/A | HIGH |
| EM-M15-8e9f0a2b | P1 | Public API | POST /orgs/{orgId}/jobs/{jobId}/apply — Apply to job: Not implemented (future module) | N/A | HIGH |
| EM-M15-9c1d3e5f | P1 | Public API | POST /orgs/{orgId}/jobs/{jobId}/bookmark — Save listing: Not implemented (future module) | N/A | HIGH |
| EM-M15-0a2b4c6d | P1 | Public API | DELETE /orgs/{orgId}/jobs/{jobId}/bookmark — Unsave listing: Not implemented (future module) | N/A | HIGH |
| EM-M15-1e3f5a7b | P1 | Public API | POST /orgs/{orgId}/jobs/alerts — Create job alert: Not implemented (future module) | N/A | HIGH |
| EM-M15-2c4d6e8f | P1 | Public API | DELETE /orgs/{orgId}/jobs/alerts/{alertId} — Delete job alert: Not implemented (future module) | N/A | HIGH |

## Findings — Workflow Implementation

| ID | Sev | Dimension | Finding | File | Confidence |
|----|-----|-----------|---------|------|------------|
| EM-M15-3a5b7c9d | P1 | Workflow | WF-087 (Browse & Save Jobs) — Member search, filter, save, apply flow: Not implemented (future module) | N/A | HIGH |
| EM-M15-4e6f8a0b | P1 | Workflow | WF-088 (Create Job Posting) — Officer/employer post listing flow: Not implemented (future module) | N/A | HIGH |
| EM-M15-5c7d9e1f | P1 | Workflow | WF-089 (External Employer Registration) — Register, approve, post flow: Not implemented (future module) | N/A | HIGH |
| EM-M15-6a8b0c2d | P1 | Workflow | WF-090 (Job Listing Expiry) — Auto-expire at 30 days with 7-day warning: Not implemented (future module) | N/A | HIGH |
| EM-M15-7e9f1a3b | P1 | Workflow | WF-091 (Job Alerts) — Keyword/specialty/location alert notifications: Not implemented (future module) | N/A | HIGH |

## Findings — State Machine Enforcement

| ID | Sev | Dimension | Finding | File | Confidence |
|----|-----|-----------|---------|------|------------|
| EM-M15-8c0d2e4f | P1 | State Machine | Job Posting status machine (draft→active→expired→closed→filled, draft→pendingReview→active/rejected, expired→active): Not implemented (future module) | N/A | HIGH |
| EM-M15-9a1b3c5d | P1 | State Machine | Job Application status machine (applied→screening→interviewed→offered→hired/rejected, any→withdrawn): Not implemented (future module) | N/A | HIGH |

## Findings — Event Publishing

| ID | Sev | Dimension | Finding | File | Confidence |
|----|-----|-----------|---------|------|------------|
| EM-M15-0e2f4a6b | P1 | Events | JobPostingCreated event (listing published): Not implemented (future module) | N/A | HIGH |
| EM-M15-1c3d5e7f | P1 | Events | JobPostingExpired event (auto-expiry triggered): Not implemented (future module) | N/A | HIGH |
| EM-M15-2a4b6c8d | P1 | Events | JobApplicationSubmitted event (member applies): Not implemented (future module) | N/A | HIGH |
| EM-M15-3e5f7a9b | P1 | Events | JobPostingExpiryWarning event (7 days before expiry): Not implemented (future module) | N/A | HIGH |

## Findings — Business Rule Enforcement

| ID | Sev | Dimension | Finding | File | Confidence |
|----|-----|-----------|---------|------|------------|
| EM-M15-4c6d8e0f | P1 | Business Rule | BR-37: Auto-expire listings at 30 days with 7-day warning: Not implemented (future module) | N/A | HIGH |
| EM-M15-5a7b9c1d | P1 | Business Rule | M15-R1: Grace/Lapsed members get read-only job board access: Not implemented (future module) | N/A | HIGH |
| EM-M15-6e8f0a2b | P1 | Business Rule | M15-R2: External employer postings require platform admin approval: Not implemented (future module) | N/A | HIGH |
| EM-M15-7c9d1e3f | P1 | Business Rule | M15-R3: Expired listings hidden from search, poster notified: Not implemented (future module) | N/A | HIGH |
| EM-M15-8a0b2c4d | P1 | Business Rule | M15-R4: Listing extension resets 30-day counter: Not implemented (future module) | N/A | HIGH |
| EM-M15-9e1f3a5b | P1 | Business Rule | M15-R5: Application submitted notifies poster via M07: Not implemented (future module) | N/A | HIGH |

## Findings — Auth/Permission Enforcement

| ID | Sev | Dimension | Finding | File | Confidence |
|----|-----|-----------|---------|------|------------|
| EM-M15-0c2d4e6f | P1 | Auth/Perm | Browse job board restricted to active members: Not implemented (future module) | N/A | HIGH |
| EM-M15-1a3b5c7d | P1 | Auth/Perm | Save/bookmark restricted to active members (not Grace/Lapsed): Not implemented (future module) | N/A | HIGH |
| EM-M15-2e4f6a8b | P1 | Auth/Perm | Apply to job restricted to active members: Not implemented (future module) | N/A | HIGH |
| EM-M15-3c5d7e9f | P1 | Auth/Perm | Post job listing restricted to Officers (Secretary) and verified employers: Not implemented (future module) | N/A | HIGH |
| EM-M15-4a6b8c0d | P1 | Auth/Perm | Manage listings restricted to own-org Officers and Platform Admin: Not implemented (future module) | N/A | HIGH |
| EM-M15-5e7f9a1b | P1 | Auth/Perm | External employer registration is public (no auth required): Not implemented (future module) | N/A | HIGH |
| EM-M15-6c8d0e2f | P1 | Auth/Perm | Approve external employers restricted to Platform Admin: Not implemented (future module) | N/A | HIGH |

## Data Entities (Declared, Not Implemented)

| Entity | Fields | Schema File |
|--------|--------|-------------|
| JobPosting | 18 fields (id, organizationId, title, organizationName, description, type, location, salary, specialty, requirements, applicationUrl, applicationEmail, status, expiresAt, postedAt, postedBy, createdAt, updatedAt) | N/A |
| JobApplication | 7 fields (id, postingId, personId, resumeRef, coverLetter, status, appliedAt) | N/A |
| JobBookmark | 4 fields (id, personId, jobPostingId, createdAt) | N/A |
| JobAlert | 5 fields (id, personId, keywords, specialty, location, createdAt) | N/A |

## Vertical Slices (All Pending)

| Slice | Name | Priority | Status |
|-------|------|----------|--------|
| M15-S1 | Browse Jobs | P0 | NOT STARTED |
| M15-S2 | Create Listing | P0 | NOT STARTED |
| M15-S3 | Save/Bookmark | P1 | NOT STARTED |
| M15-S4 | Auto-Expiry | P1 | NOT STARTED |
| M15-S5 | Apply to Job | P1 | NOT STARTED |
| M15-S6 | External Employers | P2 | NOT STARTED |
| M15-S7 | Job Alerts | P2 | NOT STARTED |
| M15-S8 | Listing Extension | P2 | NOT STARTED |


---

*Re-validated by /oli-check --enforcement on 2026-06-02T00:00:00Z. Baseline v50 confirms no drift; no new findings; no resolved findings. Working-tree changes since map v6 are limited to 12 frontend UX-polish files + 7 generated SDK/OpenAPI files — no structural change touches this module enforcement surface. Trust context: STALE-OVERLAP on map; this report findings remain accurate per baseline.*
