# Wave 2b: Credit Pipeline & Compliance — Vertical Slice Plan

## Scope
End-to-end credit pipeline: event check-in triggers credit issuance, compliance materialized view, certificate generation, and CPD configuration.

## Slices Delivered

### S1: Credit Pipeline Jobs
- `creditIssue.ts` — Idempotent credit entry creation with cycle computation
- `complianceThreshold.ts` — Threshold notification handler
- Job chain: `attendance.confirmed` -> `credit.issue` -> `compliance.threshold_met`

### S2: Compliance View
- Migration 0046: `compliance_standings` materialized view
- `compliance.repo.ts` — Repository with org summary + paginated standings
- `refreshCompliance.ts` / `getComplianceReport.ts` — Officer endpoints

### S3: CPD Configuration
- `org_cpd_config` table (migration 0045)
- `getCpdConfig.ts` / `updateCpdConfig.ts` — Officer CRUD with validation
- Frontend: `/officer/settings/cpd` — Settings page with Select components

### S4: Manual Credit Award
- `awardManualCredit.ts` — Officer endpoint with SDL cap warning + idempotency
- Frontend: integrated into member CPD dashboard

### S5: Certificate Extension
- Extended `certificates.schema.ts` with status, signing officer, credit hours, revocation
- `orgCertificateSeq` table for sequential numbering (ORG-YYYY-NNNN)
- `bulkIssueCertificates.ts` — Sync (<10) or queued (>10) bulk issuance
- `verifyCertificatePublic.ts` — Public verification endpoint

### S6: Member CPD Dashboard
- `/my-cpd` — Credit summary, category breakdown, SDL cap indicator, history
- `/officer/compliance` — Compliance dashboard with status filter
- `/officer/certificates` — Bulk issue + verify UI

### S7: Training Integration
- `markComplete.ts` updated to trigger `credit.issue` job after credit creation

## Migrations
- 0045: credit_source_type/credit_status enums, credit_entry columns, org_cpd_config
- 0046: compliance_standings materialized view
- 0047: certificate_status enum, certificate extensions, org_certificate_seq

## Routes Added (app.ts)
- GET/PATCH `/association/member/cpd-config/:organizationId`
- POST `/association/member/credits/manual`
- GET `/association/member/compliance/:organizationId`
- POST `/association/member/compliance/:organizationId/refresh`
- GET `/persons/me/credits`
- POST `/certificates/bulk-issue`
- GET `/certificates/verify/:certificateNumber` (public)
