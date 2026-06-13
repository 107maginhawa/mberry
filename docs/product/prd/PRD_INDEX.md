# PRD Index

Index of all product-requirement-tier docs in `docs/product/`. Generated 2026-06-10.

## How to read this index

This repo carries PRDs at **two layers**. Both are canonical at their layer:

1. **Product-module layer (m01-m22)** — what the *product* delivers per module, validated against `MASTER_PRD.md`. Lives under `docs/product/modules/m{NN}-{slug}/`.
2. **Handler layer (16 specs)** — what the *backend handler dir* implements, source-inspected. Lives flat at `docs/product/MODULE_SPEC.*.md`.

A single product module (e.g. M05 Membership) may map to multiple handler-level specs (e.g. `MODULE_SPEC.member.membership.md` + `MODULE_SPEC.member.chapters.md` + …).

When changing requirements:
- New user-facing capability → update the **product-module spec**.
- Backend implementation change (new handler, new endpoint, refactored repo) → update the **handler-level spec**.
- API contract change → update both `API_CONTRACTS.md` and TypeSpec.

---

## Master PRD

| Path | Status | Notes |
|---|---|---|
| [`../MASTER_PRD.md`](../MASTER_PRD.md) | Active | v3.0. Cross-module product requirements. |

## Cross-module foundation docs

| Path | Purpose |
|---|---|
| [`../DOMAIN_MODEL.md`](../DOMAIN_MODEL.md) | Bounded contexts, aggregates, value objects |
| [`../WORKFLOW_MAP.md`](../WORKFLOW_MAP.md) | User journey → module surface mapping |
| [`../STATE_MACHINES.md`](../STATE_MACHINES.md) | Aggregate state machines |
| [`../EVENT_CONTRACTS.md`](../EVENT_CONTRACTS.md) | Domain event payloads |
| [`../ERROR_TAXONOMY.md`](../ERROR_TAXONOMY.md) | Error codes + categorization |
| [`../ROLE_PERMISSION_MATRIX.md`](../ROLE_PERMISSION_MATRIX.md) | Role × action matrix |
| [`../THREAT_MODEL.md`](../THREAT_MODEL.md) | OWASP/A04 threat surface |
| [`../DATA_GOVERNANCE.md`](../DATA_GOVERNANCE.md) | PII, retention, consent |
| [`../DISASTER_RECOVERY.md`](../DISASTER_RECOVERY.md) | RTO/RPO + procedures |
| [`../OBSERVABILITY.md`](../OBSERVABILITY.md) | Logs, traces, metrics conventions |
| [`../PERFORMANCE.md`](../PERFORMANCE.md) | Performance targets |
| [`../UI_BLUEPRINT.md`](../UI_BLUEPRINT.md) | UI structure + IA |
| [`../UI_CONSISTENCY_SPEC.md`](../UI_CONSISTENCY_SPEC.md) | Visual + behavior consistency rules |
| [`../NAVIGATION_MAP.md`](../NAVIGATION_MAP.md) | Consolidated route map (auto-generated) |
| [`../MODULE_MAP.md`](../MODULE_MAP.md) | m{NN} module catalog |
| [`../API_CONVENTIONS.md`](../API_CONVENTIONS.md) | API design rules |
| [`../AUDIT_CONTRACTS.md`](../AUDIT_CONTRACTS.md) | Audit event shapes |
| [`../DOMAIN_GLOSSARY.md`](../DOMAIN_GLOSSARY.md) | Terminology |
| [`../SEED_MANIFEST.md`](../SEED_MANIFEST.md) | Demo/test seed data |

## Product-module specs (22 modules)

Each module owns `MODULE_SPEC.md` + `API_CONTRACTS.md` + `NAVIGATION_MAP.md` (plus optional `INTEGRATION_CONTRACTS.md` + `ui-prototype/`).

| Module | Path | Companion handler specs |
|---|---|---|
| M01 Auth & Onboarding | [`../modules/m01-auth-onboarding/`](../modules/m01-auth-onboarding/) | (Better-Auth integrated, no handler dir) |
| M02 Member Profile | [`../modules/m02-member-profile/`](../modules/m02-member-profile/) | — |
| M03 Platform Admin | [`../modules/m03-platform-admin/`](../modules/m03-platform-admin/) | — |
| M04 Org Admin | [`../modules/m04-org-admin/`](../modules/m04-org-admin/) | — |
| M05 Membership | [`../modules/m05-membership/`](../modules/m05-membership/) | [`MODULE_SPEC.member.membership`](../MODULE_SPEC.member.membership.md) |
| M06 Dues & Payments | [`../modules/m06-dues-payments/`](../modules/m06-dues-payments/) | [`MODULE_SPEC.dues`](../MODULE_SPEC.dues.md), [`MODULE_SPEC.member.dues-special-assessments`](../MODULE_SPEC.member.dues-special-assessments.md) |
| M07 Communications | [`../modules/m07-communications/`](../modules/m07-communications/) | — |
| M08 Events | [`../modules/m08-events/`](../modules/m08-events/) | — |
| M09 Training | [`../modules/m09-training/`](../modules/m09-training/) | — |
| M10 Credit Tracking | [`../modules/m10-credit-tracking/`](../modules/m10-credit-tracking/) | [`MODULE_SPEC.member.credits`](../MODULE_SPEC.member.credits.md) |
| M11 Documents & Credentials | [`../modules/m11-documents-credentials/`](../modules/m11-documents-credentials/) | [`MODULE_SPEC.member.credentials`](../MODULE_SPEC.member.credentials.md), [`MODULE_SPEC.member.certificates`](../MODULE_SPEC.member.certificates.md) |
| M12 Elections & Governance | [`../modules/m12-elections-governance/`](../modules/m12-elections-governance/) | [`MODULE_SPEC.member.governance`](../MODULE_SPEC.member.governance.md) |
| M13 Professional Feed | [`../modules/m13-professional-feed/`](../modules/m13-professional-feed/) | — |
| M14 National Dashboard | [`../modules/m14-national-dashboard/`](../modules/m14-national-dashboard/) | [`MODULE_SPEC.association_operations`](../MODULE_SPEC.association_operations.md) |
| M15 Job Board | [`../modules/m15-job-board/`](../modules/m15-job-board/) | — |
| M16 Advertising | [`../modules/m16-advertising/`](../modules/m16-advertising/) | — |
| M17 Marketplace | [`../modules/m17-marketplace/`](../modules/m17-marketplace/) | [`MODULE_SPEC.marketplace`](../MODULE_SPEC.marketplace.md) |
| M18 Surveys & Polls | [`../modules/m18-surveys-polls/`](../modules/m18-surveys-polls/) | [`MODULE_SPEC.reviews`](../MODULE_SPEC.reviews.md) |
| M19 Committee Management | [`../modules/m19-committee-management/`](../modules/m19-committee-management/) | [`MODULE_SPEC.member.chapters`](../MODULE_SPEC.member.chapters.md) |
| M20 Booking | [`../modules/m20-booking/`](../modules/m20-booking/) | — |
| M21 Billing | [`../modules/m21-billing/`](../modules/m21-billing/) | — |
| M22 Email | [`../modules/m22-email/`](../modules/m22-email/) | — |

## Cross-cutting handler specs (no single product-module owner)

| Spec | Notes |
|---|---|
| [`../MODULE_SPEC.audit.md`](../MODULE_SPEC.audit.md) | Audit logging — used by every module |
| [`../MODULE_SPEC.notifs.md`](../MODULE_SPEC.notifs.md) | OneSignal push notifications — cross-module |
| [`../MODULE_SPEC.storage.md`](../MODULE_SPEC.storage.md) | S3/MinIO file storage — cross-module |
| [`../MODULE_SPEC.invite.md`](../MODULE_SPEC.invite.md) | Org invitations — spans M01 + M04 |
| [`../MODULE_SPEC.member.directory.md`](../MODULE_SPEC.member.directory.md) | Member directory — spans M02 + M05 |

## Audit-derived requirements (separate tier)

These were extracted from audits, not promoted into PRDs. See `docs/quality/` for the source audits.

| Path | Source |
|---|---|
| [`../../quality/SCOPE.certificates.md`](../../quality/SCOPE.certificates.md) | Rebuild milestone scope |
| [`../../quality/SCOPE.credits.md`](../../quality/SCOPE.credits.md) | Rebuild milestone scope |
| [`../../quality/SCOPE.dues-special-assessments.md`](../../quality/SCOPE.dues-special-assessments.md) | Rebuild milestone scope |
| [`../../quality/SCOPE.membership.md`](../../quality/SCOPE.membership.md) | Rebuild milestone scope |
| [`../../quality/R0_BASELINE.md`](../../quality/R0_BASELINE.md) | Rebuild milestone baseline |
| [`../../quality/R1_CHAPTERS_SCOPE.md`](../../quality/R1_CHAPTERS_SCOPE.md) — `R5` | Per-area rebuild scope |

## Historical / versioned PRDs

| Path | Status |
|---|---|
| [`../../ver-3/plan.md`](../../ver-3/plan.md) | Versioned plan snapshot — v3 iteration |
| [`../../ver-3/business/`](../../ver-3/business/) | Versioned business rules + personas |
| [`../../ver-3/ux/screens/`](../../ver-3/ux/screens/) | Versioned per-screen specs (role × screen) |

## Needs Review

| File | Reason |
|---|---|
| _none currently flagged_ | flat vs nested distinction documented above |

---

**Maintenance**: regenerate this index if you add a new product module (m##), a new flat `MODULE_SPEC.*.md`, or a new cross-cutting spec. Hand-maintained — no script.
