# AHA Module & Audit Batch Index

Date: 2026-06-11
CODEBASE_ROOT: `/Users/elad-mini/Desktop/memberry`
Prompt: `docs/aha/prompts/01-platform-discovery-audit-index.md`

## 1. Discovery Summary

Inspected:

- **Code areas**: all 25 handler directories under `services/api-ts/src/handlers/` (file/test counts verified by direct `find`), `services/api-ts/src/core/`, `specs/api/src/modules/` (20 .tsp modules), `apps/memberry/src/routes/`, `apps/admin/src/routes/`, `packages/sdk-ts/`, `services/api-ts/src/generated/migrations/` (102 migrations), seed scripts.
- **Docs/specs**: `docs/product/` (MASTER_PRD, DOMAIN_MODEL, WORKFLOW_MAP, STATE_MACHINES, 22 nested module specs m01–m22, 16 handler-level MODULE_SPEC.*.md, 19 cross-cutting foundation docs), `docs/ver-3/` (business rules + br-registry.json + 109 UX screen specs), `docs/quality/` (scope docs, coverage audits), `docs/architecture/adr/` (10 ADRs), `docs/execution/` (wave plans + 13 slice specs), `specs/api/CONTRACT.md` + `IMPLEMENTING.md`.
- **Tests**: 514 unit test files in `services/api-ts`, 157 Hurl contract files in `specs/api/tests/contract/`, 102 E2E spec files in `apps/memberry`, near-zero E2E for `apps/admin`.
- **Prior audits**: `.audits/PRODUCTION_AUDIT.md` (2026-06-06), `docs/aha/project-structure/` outputs (2026-06-11, not re-run), `.planning/deferred/14-mega-module-split/SPLIT-PLAN.md`, `ROADMAP.md`.
- **KG**: existing `.understand-anything/` graph used as secondary evidence (see §2). Not regenerated.
- **/understand-domain**: existing domain-graph.json used; not regenerated (see §3).
- **Webwright/Playwright**: not used. Discovery did not require browser evidence; existing E2E inventory (102 specs) was sufficient to assess journey coverage. No source/tests modified.

**Limitations**: handler counts are point-in-time; doc-coverage assessments for `docs/ver-3/` currency are partially `[INFERRED]` from prior project-structure audit rather than re-read in full; admin app internals inspected at route-group level only.

**Headline discovery finding**: the live handler topology does **not** match CLAUDE.md's module map. The real mega-module is `handlers/member/` (215 non-test files across 8 submodules: certificates, chapters, credentials, credits, directory, duesspecialassessments, governance, membership). `handlers/association:member/` is a small remnant (42 files: org dashboard, disciplinary actions, officer terms). `handlers/dues/` contains only `repos/` (schemas, no handlers, no tests). There is no `certificates/` top-level handler dir (lives at `member/certificates/`). This split-brain matches `.audits/PRODUCTION_AUDIT.md` P0 and drives the suggested audit order.

## 2. Knowledge Graph Status

| Item | Status | Notes |
| --- | --- | --- |
| Existing KG found | Yes | `.understand-anything/knowledge-graph.json`, 3.2 MB |
| KG tool/source | /understand-anything | 3,474 nodes, 8,259 edges, 11 layers, commit `0178b7c` |
| KG appears fresh | Partially | Generated 2026-06-06; active dev through 2026-06-11 |
| KG refreshed or regenerated | No | Discovery answerable from direct inspection |
| Regeneration needed | Not yet | Refresh before prompt 05 or if prompt 02 wiring questions stall |
| Missing areas | Post-Jun-6 changes; doc restructure commits | |
| KG status file saved | Yes | `docs/aha/kg/knowledge-graph-status.md` |

## 3. Domain Knowledge Status

| Item | Status | Notes |
| --- | --- | --- |
| `/understand-domain` available | Yes | Output exists at `.understand-anything/domain-graph.json` |
| Domain graph/output used | Yes | Secondary evidence only |
| Domain output appears sufficient | Yes | Product docs (WORKFLOW_MAP, STATE_MACHINES, br-registry) richer and newer |
| Domain output refreshed or regenerated | No | Unnecessary for discovery |
| Missing or unclear domain areas | m13 feed ranking; m09↔m06 training payment gate; m16 ad-network integration | |
| Domain status file saved | Yes | `docs/aha/kg/domain-knowledge-status.md` |

## 4. PRD / Spec Inventory

Top-tier references only; per-module specs summarized as families (full file list in `docs/aha/project-structure/outputs/DOCS_INVENTORY.md`).

| Product Reference | Path | Type | Related Module/Group | Related Module Slug | Appears Current? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Master PRD | `docs/product/MASTER_PRD.md` | PRD | all | — | Yes | Root personas + workflows |
| Domain Model | `docs/product/DOMAIN_MODEL.md` | data model note | all | — | Yes | 112K, load-bearing |
| Workflow Map | `docs/product/WORKFLOW_MAP.md` | workflow spec | all | — | Yes | Cross-module journeys |
| State Machines | `docs/product/STATE_MACHINES.md` | workflow spec | membership, dues, governance | membership-lifecycle, dues-payments, elections-governance | Yes | |
| Role/Permission Matrix | `docs/product/ROLE_PERMISSION_MATRIX.md` | acceptance criteria | auth/RBAC | auth-rbac | Yes | Primary RBAC reference |
| Module specs m01–m22 (nested) | `docs/product/modules/m{01–22}-*/MODULE_SPEC.md` + `API_CONTRACTS.md` + `NAVIGATION_MAP.md` | PRD + API contract | per module | see §5 | Yes | m20–m22 lack ui-prototype/ |
| Handler-level specs (16) | `docs/product/MODULE_SPEC.*.md` | module spec | per handler | see §5 | Yes | Written from source inspection |
| Business rules registry | `docs/ver-3/business/br-registry.json` | business rules | all | — | Yes | Load-bearing: `bun run test:br`, br-coverage.ts |
| Business rules prose | `docs/ver-3/business/business-rules.md` | business rules | all | — | Yes | |
| Personas & roles | `docs/ver-3/business/personas-and-roles.md` | PRD | all | — | Yes | Load-bearing (project-map generator) |
| UX screen specs (109) | `docs/ver-3/ux/screens/{role}/*.md` | workflow spec / UI | frontend route groups | see §12 | Yes | Concrete per-screen contracts |
| ver-3 roadmap | `docs/ver-3/business/roadmap.md` | roadmap | — | — | Stale / Needs Confirmation | Superseded by root `ROADMAP.md` |
| API contract | `specs/api/CONTRACT.md` | API contract | api-contract-pipeline | api-contract-pipeline | Yes | Wire-level source of truth |
| TypeSpec module docs | `specs/api/src/modules/*.md` | API contract | per module | — | Mostly Yes | `patient.md`, `emr.md`, `provider.md` look healthcare-template leftovers `[NEEDS CONFIRMATION]` |
| Scope docs | `docs/quality/R0–R5_*.md`, `SCOPE.*.md` | acceptance criteria | chapters, governance, credentials, directory, elections, membership, dues, certificates, credits | various | Yes | |
| Quality audits | `docs/quality/{QA-COVERAGE-MATRIX,CONTRACT_COVERAGE,E2E_DEPTH_AUDIT,OBSERVABILITY_AUDIT}.md` | test plan | test-infrastructure | test-infrastructure | Yes | |
| Hand-wired route allowlist | `docs/quality/HAND_WIRED_ROUTES.yaml` | API contract | api-contract-pipeline | api-contract-pipeline | Yes | Load-bearing |
| ADRs 0001–0010 | `docs/architecture/adr/` | implementation plan | platform | core-platform | Yes | incl. 0010 mega-module rebuild-over-split |
| Wave/slice plans | `docs/execution/` | implementation plan | per wave | various | Yes | 13 slices with TDD_PROOF |
| Production audit | `.audits/PRODUCTION_AUDIT.md` | audit | platform | — | Yes (2026-06-06) | P0 split-brain finding |
| Mega-module split plan | `.planning/deferred/14-mega-module-split/SPLIT-PLAN.md` | implementation plan | member mega-module | member-mega-module | Stale / Needs Confirmation | Sized pre-Phase-35; file counts drifted |
| Root roadmap | `ROADMAP.md` | roadmap | all | — | Yes (2026-06-07) | Phase 47 active |

## 5. PRD / Spec Coverage by Module

| Module/Group | Module Slug | PRD/Spec Coverage | Primary Product References | Missing Product Detail | Risk | Label |
| --- | --- | --- | --- | --- | --- | --- |
| Auth & Onboarding | auth-onboarding | Strong | m01 spec; `personas-and-roles.md`; ver-3 auth screens | — | High (security surface) | |
| Person & Profile | person-profile | Strong | m02 spec; `MODULE_SPEC.member.directory.md`; ADR-0005 | — | Medium | |
| Membership Lifecycle | membership-lifecycle | Strong | m05 spec; `MODULE_SPEC.member.membership.md`; `STATE_MACHINES.md`; `SCOPE.membership.md` | Code topology vs spec mapping (split-brain) | High | `[CROSS-MODULE RISK]` |
| Chapters & Directory | chapters-directory | Strong | m05/m02 specs; `MODULE_SPEC.member.chapters.md`; R1/R4 scope docs | — | Medium | |
| Dues & Payments | dues-payments | Strong | m06 spec; `MODULE_SPEC.dues.md`; `MODULE_SPEC.member.dues-special-assessments.md` | `handlers/dues/` has repos only — where handlers live needs mapping | High | `[NEEDS CONFIRMATION]` |
| Billing (Stripe) | billing-stripe | Strong | m21 spec; `specs/api/src/modules/billing.md` | No ui-prototype | High (financial) | |
| Events & Booking | events-booking | Strong | m08 + m20 specs | m20 no ui-prototype | Medium | |
| Training & Credits | training-credits | Strong | m09 + m10 specs; `MODULE_SPEC.member.credits.md` | Payment-gate boundary m09↔m06 | High (core value: CPD) | `[CROSS-MODULE RISK]` |
| Documents & Credentials | documents-credentials | Strong | m11 spec; `MODULE_SPEC.member.credentials.md`, `.member.certificates.md`, `.storage.md`; R3 scope | — | Medium | |
| Elections & Governance | elections-governance | Strong | m12 spec; `MODULE_SPEC.member.governance.md`; R2/R5 scope docs | `deleteElection` hand-wired by design | High (trust/integrity) | |
| Committee Management | committee-management | Strong | m19 spec | — | Medium | |
| Communications | communications | Strong | m07 spec; `docs/architecture/COMMS-CONSOLIDATION.md` | — | Medium | |
| Realtime Comms (chat/video) | realtime-comms | Partial | m07 spec (partial); `specs/api/src/modules/comms.md` | WebSocket behavior, presence, reconnect semantics thin | Medium | `[INFERRED]` |
| Professional Feed | professional-feed | Partial | m13 spec | Ranking/curation logic undefined | Medium | `[NEEDS PRODUCT DECISION]` |
| Notifications & Email | notifications-email | Strong | m22 spec; `MODULE_SPEC.notifs.md`; OneSignal pattern in CLAUDE.md | m22 no ui-prototype | Medium | |
| Surveys & Polls | surveys-polls | Strong | m18 spec | Anonymity rules (BR-39/40 future) | Low | |
| Marketplace, Ads & Reviews | marketplace-advertising | Strong | m16 + m17 specs; `MODULE_SPEC.marketplace.md`, `.reviews.md` | Ad-network integration unclear | Low | `[NEEDS CONFIRMATION]` |
| Platform Admin | platform-admin | Strong | m03 spec; `MODULE_SPEC.audit.md`; `ROLE_PERMISSION_MATRIX.md` | — | High (privileged surface) | |
| Org Admin & Operations | org-admin-operations | Strong | m04 spec; `MODULE_SPEC.association_operations.md` | — | Medium | |
| National Dashboard | national-dashboard | Partial | m14 spec | Analytics data sources → schema mapping | Medium | `[INFERRED]` |
| Job Board | job-board | Partial | m15 spec | Code area unverified (handlers/jobs = background jobs, not job board) | Unknown | `[NEEDS CONFIRMATION]` |
| Member mega-module (structure) | member-mega-module | Partial | SPLIT-PLAN.md (stale), ADR-0010, PRODUCTION_AUDIT | Plan sized for old file counts | High | `[NEEDS CONFIRMATION]` |
| Auth/RBAC enforcement layer | auth-rbac | Strong | `ROLE_PERMISSION_MATRIX.md`; CLAUDE.md x-require-officer/x-require-position extensions | — | High | |
| Core platform services | core-platform | Partial | ADRs; CLAUDE.md (domain events, config) | No single spec for event bus consumers | Medium | `[INFERRED]` |
| Storage & Files | storage-files | Strong | `MODULE_SPEC.storage.md` | — | Medium | |
| Database schema | database-schema | Strong | `DOMAIN_MODEL.md`; per-module repos schemas | — | Medium | |
| API contract pipeline | api-contract-pipeline | Strong | `specs/api/CONTRACT.md`, `IMPLEMENTING.md`, HAND_WIRED_ROUTES.yaml | — | Medium | |
| SDK (sdk-ts) | sdk-ts | Weak | Generated from OpenAPI; hand-written flows/webrtc undocumented | Spec for hand-written extras | Medium | `[INFERRED]` |
| Shared UI / frontend platform | shared-ui | Strong | `UI_BLUEPRINT.md`, `UI_CONSISTENCY_SPEC.md`, ver-3 screens | — | Medium | |
| Admin app (frontend) | admin-app | Partial | m03/m14 specs; ver-3 platform-admin screens | Near-zero E2E; only 3 shared components | High | `[TEST GAP]` |
| Test infrastructure | test-infrastructure | Strong | `VERTICAL_TDD.md`; quality audits; br-registry | Admin E2E missing | Medium | `[TEST GAP]` |

## 6. PRD / Spec to Code Discovery Notes

| PRD / Spec Area | Related Module/Group | Module Slug | Code Area Found? | Evidence | Concern | Recommended Handling |
| --- | --- | --- | --- | --- | --- | --- |
| m05 Membership | Membership Lifecycle | membership-lifecycle | Yes (split) | `handlers/member/membership/` + `handlers/membership/` (5 files) + `handlers/association:member/` remnant | Requirement spans multiple dirs; CLAUDE.md map stale | First prompt-02 audit |
| m06 Dues | Dues & Payments | dues-payments | Partial | `handlers/dues/` = repos only, 0 handlers, 0 tests; dues logic in `member/duesspecialassessments/` + platformadmin | Code exists but ownership unclear | Map in prompt-02 audit |
| m11 Certificates | Documents & Credentials | documents-credentials | Yes | `handlers/member/certificates/` (no top-level `certificates/` dir) | CLAUDE.md lists nonexistent `certificates/` dir | Doc sync; audit normally |
| m15 Job Board | Job Board | job-board | Unknown | `handlers/jobs/` = background-job registry, not job board; no obvious job-board handlers found | PRD requirement may have no code area | Verify before scheduling audit |
| m13 Professional Feed | Professional Feed | professional-feed | Partial | `communication/repos/feed-post.schema.ts`; `ac-m13.professional-feed.test.ts` in communication/ | Lives inside communication module; ranking unspecified | Audit with communications |
| m14 National Dashboard | National Dashboard | national-dashboard | Yes | `apps/admin/src/routes/national-dashboard/`; analytics in association:operations | Backend data-source mapping unverified | Audit with platform-admin or org-operations |
| TypeSpec `patient.md`, `emr.md`, `provider.md` | API contract pipeline | api-contract-pipeline | Unknown | `specs/api/src/modules/` healthcare-template leftovers | Possible overbuild / template residue | Confirm and remove or mark template-only |
| SPLIT-PLAN.md (157→193 files) | Member mega-module | member-mega-module | Yes | Actual `member/` = 215 non-test files; `association:member/` = 42 | Product reference appears stale | Re-scope before any fix work |
| AUDIT_CONTRACTS.md | Platform Admin / audit | platform-admin | Partial | `handlers/audit/` has 1 handler; x-audit extension generates middleware | Marked V2-future in places; needs current-scope check | Audit with platform-admin |

## 7. Business / Domain Workflows

| Workflow | Actors | Main Steps | Modules/Groups Involved | Module Slugs Involved | Product Reference | Evidence | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Join → membership active | Prospect, Officer | register → apply → approve → tier assign → dues invoice | auth, membership, dues | auth-onboarding, membership-lifecycle, dues-payments | m01, m05, WORKFLOW_MAP | `apps/memberry/src/routes/join/`, `application-approval-flow.hurl` | High | Core funnel |
| Dues billing cycle | Member, Treasurer | invoice → pay (proof/Stripe) → mark paid → status effect → dunning | dues, billing, membership | dues-payments, billing-stripe, membership-lifecycle | m06, m21, STATE_MACHINES | `pay/` route, `aging-buckets-flow.hurl`, dunning repos | High | Financial integrity |
| Training → CPD credits → renewal | Member, Provider, Officer | enroll → complete → credits posted → license/credential renewal | training, credits, credentials | training-credits, documents-credentials | m09, m10, m11 | `member/credits/`, `association:operations` training, `m09-training-paid-gate` slice | High | Core product value |
| Election lifecycle | Member, Officer, Admin | nominate → certify → vote → tally → officer term transition | elections, governance, association:member | elections-governance | m12, R2/R5 | `elections/castVote.ts`, `flow-04.election-vote-tally.test.ts`, `transitionOfficerTerm.ts` | High | Trust-critical |
| Role change → permission effect | Officer, Admin | position assign → x-require-position/officer middleware → 2FA on privileged titles | auth-rbac, platform-admin | auth-rbac, platform-admin | ROLE_PERMISSION_MATRIX, ADR-0007 | generated routes middleware chain | High | Cross-cutting |
| Announcement/notification fan-out | Officer, Member | compose → segment → queue → email/push delivery | communication, email, notifs | communications, notifications-email | m07, m22 | `communication/` queue handlers, `email/jobs/`, `notifs/jobs/` | Medium | |
| Person deletion cascade | Member, Platform | delete request → `person.deleted` event → 9 subscriber cleanups | person + 8 modules | person-profile, core-platform | CLAUDE.md P1.6, EVENT_CONTRACTS | `core/domain-event-consumers.ts` | High | Blast radius |
| Event publish → register → attend | Officer, Member | create event → publish → register/pay → check-in | events, booking, dues | events-booking | m08, m20 | `events/`, `booking/`, memberry `events/` routes | Medium | |

## 8. Business Modules

Counts verified 2026-06-11 via `find` (non-test .ts files / .test.ts files, recursive).

| Module | Module Slug | Purpose | Main Paths | Routes/Pages | APIs/Handlers | DB/Schema | Tests Found | PRD/Spec Coverage | Primary PRD/Spec | Domain Workflow Mapping | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Person & Profile | person-profile | Central PII hub | `handlers/person/` | memberry profile/settings | 27 handlers | person repos | 29 test files | Strong | m02 + ADR-0005 | deletion cascade | Medium | |
| Auth & Onboarding | auth-onboarding | Better-Auth + onboarding | `core/auth.ts`, `handlers/onboarding/`, `handlers/invite/` | `auth/`, `join/`, `verify/`, `onboarding.tsx` | onboarding 2, invite 4 | better-auth generated schema | lockout/session tests in core | Strong | m01 | join funnel | High | 10 Better-Auth plugins |
| Member mega-module | member-mega-module | 8 submodules: membership, chapters, credentials, credits, directory, duesspecialassessments, governance, certificates | `handlers/member/` | spread across memberry `_authenticated/` | 215 files | 13+ schema files under `member/*/repos/` `[NEEDS CONFIRMATION]` | 98 test files | Strong (per submodule) | m05/m10/m11/m12 + handler specs | most member workflows | High | Real mega-module; audit per submodule, not whole |
| Membership (legacy standalone) | membership-lifecycle | Applications, approvals, tiers | `handlers/membership/`, `handlers/member/membership/`, `handlers/association:member/` | `join/` | membership 5 + member/membership subset | membership schemas | 6 + subset of 98 | Strong | m05 | join funnel | High | Split-brain target |
| Dues | dues-payments | Invoicing, payments, funds, assessments | `handlers/dues/` (repos only), `handlers/member/duesspecialassessments/` | `pay/`, officer finance pages | 0 in dues/; assessments in member/ | dues repos (5 schema files) | 0 in dues/ | Strong | m06 | billing cycle | High | Handler ownership needs mapping |
| Billing | billing-stripe | Stripe Connect | `handlers/billing/` | merchant dashboard | 16 | billing.schema.ts | 21 | Strong | m21 | billing cycle | High | Webhook handling |
| Events | events-booking | Events + scheduling | `handlers/events/`, `handlers/booking/` | memberry `events/`, admin `events/` | events 11, booking 19 | events/booking schemas | 16 + 21 | Strong | m08, m20 | event lifecycle | Medium | |
| Training & Credits | training-credits | CPD training, providers, credits | `association:operations/` (training, accredited-provider), `member/credits/` | admin `training/` | within 69 + member subset | training/provider/credits schemas | within 26 + subset | Strong | m09, m10 | CPD workflow | High | Spans 2 dirs by design |
| Elections | elections-governance | Voting + governance | `handlers/elections/`, `member/governance/`, `association:member/` officer terms | admin `committees/`, memberry governance | elections 6 + governance subset | governance schemas | 14 + subset | Strong | m12 | election lifecycle | High | deleteElection hand-wired |
| Committees | committee-management | Committees + tasks | `association:operations/` (committee, committee-task) | admin `committees/` | subset of 69 | committee schemas | subset of 26 | Strong | m19 | governance | Medium | |
| Communications | communications | Templates, queue, announcements, segments, feed | `handlers/communication/` | admin `communications/` | 43 | communication, feed-post, survey schemas | 43 | Strong | m07 (+m13 feed) | fan-out | Medium | Feed lives here |
| Realtime Comms | realtime-comms | WebSocket video/chat/DM | `handlers/comms/` | memberry chat UI | 13 | comms schemas | 7 | Partial | m07 + comms.tsp | — | Medium | Test coverage thin (7/13) |
| Documents | documents-credentials | Docs, credentials, certificates | `handlers/documents/`, `member/credentials/`, `member/certificates/` | memberry documents | documents 16 + member subsets | document/credential schemas | 21 + subsets | Strong | m11 | credential renewal | Medium | |
| Surveys | surveys-polls | Surveys + polls | `handlers/surveys/` | admin `surveys/` | 16 | survey schemas | 13 | Strong | m18 | — | Low | |
| Marketplace/Ads/Reviews | marketplace-advertising | Vendors, offers, sponsored placement, NPS | `handlers/marketplace/`, `advertising/`, `reviews/` | memberry `discover/` | 9 + 7 + 4 | respective schemas | 3 + 7 + 5 | Strong | m16, m17 | — | Low | marketplace tests thin (3/9) |
| Notifications & Email | notifications-email | OneSignal push + email queue | `handlers/notifs/`, `handlers/email/` | n/a (delivery layer) | 5 + 13 | notif/email schemas | 6 + 11 | Strong | m22 + MODULE_SPEC.notifs | fan-out | Medium | Both have jobs/ |
| Platform Admin | platform-admin | Admin-tier ops, audit, jobs | `handlers/platformadmin/`, `audit/`, `jobs/` | apps/admin (15 route groups) | 45 + 1 + 7 | platformadmin schemas | 40 + 2 + 7 | Strong | m03 | role→permission | High | Privileged + impersonation |
| Org Admin & Operations | org-admin-operations | Org dashboard, analytics, disciplinary | `handlers/association:member/`, `association:operations/` analytics | admin `organizations/`, `associations/` | 42 + analytics subset | assoc schemas | 17 + subset | Strong | m04 | — | Medium | |

## 9. Platform / Shared Groups

| Group | Group Slug | Purpose | Main Paths | Main Consumers | Tests Found | PRD/Spec Coverage | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Core platform services | core-platform | Config, domain event bus + consumers, audit-action, officer-checks, security middleware, ports | `services/api-ts/src/core/` | all handlers | lockout/session/hardening tests | Partial | High | Event-bus consumer coverage `[NEEDS CONFIRMATION]` |
| API contract pipeline | api-contract-pipeline | TypeSpec → OpenAPI → routes/validators/handler-stub generation | `specs/api/`, `services/api-ts/scripts/generate.ts`, `src/generated/openapi/` | everything | 157 hurl + Schemathesis CI | Strong | Medium | x-audit/x-require-* extension generator |
| SDK | sdk-ts | Generated client + hand-written flows, webrtc signaling, optimistic mutation | `packages/sdk-ts/` | both apps | unknown | Weak | Medium | Hand-written extras undocumented `[INFERRED]` |
| Shared UI | shared-ui | shadcn/Radix components, design tokens | `apps/memberry/src/components/` (32), `apps/admin/src/components/` (3) | both apps | via E2E | Strong | Medium | Admin component reuse thin |
| Storage & Files | storage-files | S3/MinIO upload/download | `handlers/storage/` | documents, certificates, profile | 4 test files | Strong | Medium | SVG-upload validation tests exist |

## 10. Database / Schema Groups

| Schema Area | Schema Slug | Tables/Models | Owning Module(s) | Owning Module Slug(s) | Migrations Found | Tests Found | Product Reference | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Member domain schemas | db-member-domain | membership, chapters, credentials, credits, directory, dues, dues-payments, dunning, governance, status-history, special-assessments, institutional-membership | member mega-module + association:member | member-mega-module | shared pool of 102 | schema tests in elections (`elections-schema.test.ts`) | DOMAIN_MODEL | High | Largest surface |
| Dues schemas (orphan dir) | db-dues | dues repos in `handlers/dues/repos/` | dues-payments | dues-payments | within 102 | 0 | m06 | High | Schemas without co-located handlers/tests |
| Auth schemas | db-auth | Better-Auth generated | auth-onboarding | auth-onboarding | within 102 | — | generated | Medium | Never hand-edit |
| Comms/communication schemas | db-communications | communication, feed-post, survey | communications, surveys | communications, surveys-polls | within 102 | within module tests | m07/m13/m18 | Medium | survey schema in communication/ repos `[NEEDS CONFIRMATION]` |
| Ops schemas | db-operations | events, training, committee, committee-task, accredited-provider | association:operations | org-admin-operations, training-credits | within 102 | within module tests | m08/m09/m19 | Medium | |
| Remaining module schemas | db-modules-misc | billing, booking, documents, person, platformadmin, storage, etc. | per module | various | 102 total migrations | per module | DOMAIN_MODEL | Medium | |

## 11. API / Integration Groups

| API Group | API Group Slug | Purpose | Main Paths | Consumers | Tests Found | Product Reference | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Stripe Connect | integration-stripe | Payments, merchant onboarding, webhooks, refunds | `handlers/billing/` | dues, marketplace | 21 | m21 | High | stripe-mock integration TODO (memory: pilot-tier1) |
| OneSignal | integration-onesignal | Multi-app push | `handlers/notifs/` | all notifying modules | 6 | MODULE_SPEC.notifs + CLAUDE.md pattern | Medium | external_id targeting |
| S3/MinIO | integration-s3 | File storage | `handlers/storage/` | documents, certificates | 4 | MODULE_SPEC.storage | Medium | |
| Email provider | integration-email | Transactional queue, templates, suppression | `handlers/email/` + `email/jobs/` | all mailing modules | 11 | m22 | Medium | |
| WebSocket/WebRTC | integration-realtime | Chat, DM, video signaling | `handlers/comms/`, `sdk-ts/src/utils/webrtc/` | memberry chat | 7 | comms.tsp | Medium | Signaling client hand-written |

## 12. Frontend Route / Page Groups

| Route/Page Group | Route/Page Slug | Purpose | Main Paths | Related Module(s) | Related Module Slug(s) | Tests Found | Product Reference | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Memberry auth/join/verify | fe-memberry-auth | Login, signup, join, verification | `apps/memberry/src/routes/{auth,join,verify,invite}/`, `onboarding.tsx` | auth, membership, invite | auth-onboarding, membership-lifecycle | within 102 E2E | m01 + ver-3 auth screens | High | Core funnel |
| Memberry authenticated area | fe-memberry-member | Member dashboard, profile, dues, training, governance, chat, documents | `apps/memberry/src/routes/_authenticated/` | most member modules | member-mega-module et al. | within 102 E2E | ver-3 member/officer screens | High | Bulk of product |
| Memberry public/discover/events/pay | fe-memberry-public | Discovery, event pages, payment | `routes/{discover,events,pay}/` | events, marketplace, dues | events-booking, marketplace-advertising, dues-payments | within 102 E2E | m08/m17/m06 | Medium | |
| Admin app | fe-admin | 15 route groups: associations, audit, committees, communications, compliance, events, feature-flags, impersonate, members, national-dashboard, operators, organizations, surveys, training, verifications | `apps/admin/src/routes/` | platformadmin + org ops | platform-admin, org-admin-operations | ~0 E2E | m03/m14 + ver-3 platform-admin screens | High | `[TEST GAP]` near-zero E2E |

## 13. Auth / RBAC / Security Groups

| Group | Group Slug | Purpose | Main Paths | Consumers | Tests Found | Product Reference | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Better-Auth core | auth-rbac | Sessions, 2FA, passkey, magic link, lockout, session limits/hardening | `core/auth.ts`, `core/{account-lockout,auth-session-hardening,session-limit}.ts`, `generated/better-auth/` | both apps + all routes | lockout/hardening/session tests + `auth-gate-coverage.test.ts` | ROLE_PERMISSION_MATRIX, m01 | High | |
| Officer/position enforcement | rbac-officer-position | x-require-officer / x-require-position generated middleware + `core/auth/officer-checks.ts` inline path | generator + `routes.ts` | governance, finance, admin routes | within module tests | ADR-0007, CLAUDE.md P1.5 | High | 2FA on privileged titles in prod |
| Audit trail | audit-trail | x-audit extension middleware + `core/audit/audit-action.ts` | generated routes, hand-wired app.ts | compliance | audit handler tests (2) | AUDIT_CONTRACTS, MODULE_SPEC.audit | Medium | |

## 14. Test Infrastructure Groups

| Test Group | Test Group Slug | Purpose | Main Paths | Related Modules/Groups | Current Coverage | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| API unit tests | test-api-unit | Bun test, BR-tagged tests | `services/api-ts/**/*.test.ts`, `handlers/__tests__/`, `test-isolation.ts` | all backend | 514 files | Low | Healthy volume |
| Contract tests | test-contract | Hurl suite + Schemathesis CI | `specs/api/tests/contract/` (157 .hurl), `scripts/run-contract-tests.ts`, `.github/workflows/contract.yml` | API surface | COVERAGE.md tracks | Medium | CLAUDE.md says 97 files; actual 157 — doc stale |
| Memberry E2E | test-e2e-memberry | Playwright user flows | `apps/memberry` e2e (102 spec files) | frontend | E2E_DEPTH_AUDIT tracks depth | Medium | Playwright pinned 1.58.2 |
| Admin E2E | test-e2e-admin | — | none found | admin app | ~0 | High | `[TEST GAP]` |
| BR registry harness | test-br-registry | Business-rule coverage gating | `br-registry.json`, `scripts/br-coverage.ts`, `testing/registry/report.ts` | all | 33/40 BRs complete (memory) `[NEEDS CONFIRMATION]` | Medium | Load-bearing |

## 15. Cross-Module Journeys

| Journey | Journey Slug | Modules/Groups Involved | Module Slugs Involved | Product Reference | Current Evidence | Risk | Suggested Audit Timing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Join → approve → dues → active | journey-join-to-active | auth, membership, dues | auth-onboarding, membership-lifecycle, dues-payments | WORKFLOW_MAP, m01/m05/m06 | `application-approval-flow.hurl`, join routes | High | With membership-lifecycle audit |
| Dues invoice → payment → status → dunning | journey-dues-cycle | dues, billing, membership | dues-payments, billing-stripe | m06, STATE_MACHINES | aging-buckets-flow.hurl, dunning repos | High | With dues-payments audit |
| Training → credits → credential renewal | journey-cpd | training, credits, credentials | training-credits, documents-credentials | m09/m10/m11 | paid-gate slice TDD_PROOF | High | After membership + dues |
| Election → vote → tally → officer term | journey-election | elections, governance, association:member | elections-governance | m12 | flow-04 tally test, transitionOfficerTerm | High | Standalone |
| Role/position change → permission effect | journey-rbac-effect | auth-rbac, all officer routes | auth-rbac | ROLE_PERMISSION_MATRIX | generated middleware chain | High | With auth-rbac audit |
| Person deletion → 9-subscriber cascade | journey-person-deletion | person + 8 modules | person-profile, core-platform | EVENT_CONTRACTS | `core/domain-event-consumers.ts` | High | With core-platform audit |
| Announcement → segment → email/push | journey-comms-fanout | communication, email, notifs | communications, notifications-email | m07/m22 | queue handlers + jobs | Medium | With communications audit |

## 16. Suggested Audit Order

| Order | Module/Group | Module Slug | Type | Risk | PRD/Spec Coverage | Why This Order | Recommended Prompt |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Membership Lifecycle | membership-lifecycle | Business Module | High | Strong | Core funnel; split-brain across `member/membership`, `membership/`, `association:member/`; P0 in PRODUCTION_AUDIT; everything downstream depends on member state | 02 |
| 2 | Dues & Payments | dues-payments | Business Module | High | Strong | Financial integrity; orphan `dues/` repos with 0 handlers/tests; feeds member status | 02 |
| 3 | Auth/RBAC enforcement | auth-rbac | Auth/RBAC/Security Group | High | Strong | Permission matrix is cross-cutting precondition for trusting every other audit | 02 |
| 4 | Training & Credits | training-credits | Business Module | High | Strong | Core product value (CPD); spans 2 handler dirs; payment-gate boundary | 02 |
| 5 | Elections & Governance | elections-governance | Business Module | High | Strong | Trust-critical; hand-wired deleteElection; officer-term transitions | 02 |
| 6 | Billing (Stripe) | billing-stripe | API/Integration Group | High | Strong | Webhooks + refunds; stripe-mock integration still TODO | 02 |
| 7 | Platform Admin + Admin app | platform-admin | Business Module + Frontend Route Group | High | Strong | Privileged surface, impersonation, near-zero admin E2E | 02 |
| 8 | Person & deletion cascade | person-profile | Business Module | Medium | Strong | PII hub + event-bus blast radius | 02 |
| 9 | Communications (+feed) | communications | Business Module | Medium | Strong/Partial | 43 handlers; feed product rules unclear | 02 |
| 10 | Events & Booking | events-booking | Business Module | Medium | Strong | Phase 47b booking cleanup in progress — audit after it lands | 02 |
| 11 | Documents & Credentials | documents-credentials | Business Module | Medium | Strong | After training-credits (shares renewal flow) | 02 |
| 12 | Notifications & Email | notifications-email | API/Integration Group | Medium | Strong | Delivery layer; after producers audited | 02 |
| 13 | Realtime Comms | realtime-comms | Business Module | Medium | Partial | Spec thin; test coverage 7/13 | 02 |
| 14 | Marketplace/Ads/Reviews + Surveys | marketplace-advertising | Business Module | Low | Strong | Lower risk, later | 02 |
| — | Cross-cutting patterns | cross-cutting | Platform | — | — | Only after ≥2–3 module audits | 05 |
| — | Database schema | database-schema | Database/Schema Group | — | Strong | Platform is data-heavy; run after module audits surface schema issues (orphan dues repos already a signal) | 06 |
| — | Consolidated roadmap | — | — | — | — | After several audits/fixes | 07 |

## 17. Missing or Weak Product References

| Module/Group | Module Slug | Missing Reference | Why It Matters | Label |
| --- | --- | --- | --- | --- |
| Professional Feed | professional-feed | Ranking/moderation rules | Can't audit feed correctness without intended behavior | `[NEEDS PRODUCT DECISION]` |
| Realtime Comms | realtime-comms | Presence/reconnect/retention semantics | WebSocket behavior only inferable from code | `[INFERRED]` |
| Job Board | job-board | Code-area mapping for m15 | m15 spec exists; matching backend unverified | `[NEEDS CONFIRMATION]` |
| SDK hand-written extras | sdk-ts | Spec for flows/, webrtc signaling, use-optimistic-mutation | Shared dependency of both apps | `[INFERRED]` |
| Member mega-module split | member-mega-module | Current-state split plan | SPLIT-PLAN sized for stale counts (claims 157/193; actual member/=215 + association:member/=42) | `[NEEDS CONFIRMATION]` |
| Core platform event bus | core-platform | Consumer-level contract doc | 9 fire-and-forget subscribers; failure semantics undocumented | `[INFERRED]` |
| TypeSpec healthcare leftovers | api-contract-pipeline | Intent for patient/emr/provider module docs | Possible template residue confusing the contract surface | `[NEEDS CONFIRMATION]` |

## 18. Immediate Concerns

| Concern | Module/Group | Module Slug | Evidence | Risk | Recommended Next Step |
| --- | --- | --- | --- | --- | --- |
| Split-brain handler topology: `member/` (215 files) vs `association:member/` (42) vs `membership/` (5); CLAUDE.md describes a layout that no longer exists | Membership Lifecycle / mega-module | membership-lifecycle | Verified `find` counts 2026-06-11; `.audits/PRODUCTION_AUDIT.md` P0 | High | Prompt 02 on membership-lifecycle; sync CLAUDE.md as a fix-batch item |
| `handlers/dues/` contains only repos: 0 handlers, 0 tests for dues schemas | Dues & Payments | dues-payments | `find handlers/dues` → repos only | High | Map real dues handler ownership in prompt 02 |
| Admin app has ~zero E2E coverage while exposing impersonation, operators, feature flags | Admin app | fe-admin | No E2E specs found under `apps/admin` | High | `[TEST GAP]` — capture in platform-admin gap plan |
| CLAUDE.md/docs drift: nonexistent `certificates/` handler dir; "97 hurl files" vs actual 157; stale module counts | docs | — | Verified counts | Medium | Fix-batch item in first prompt 04 run |
| `marketplace` (3 tests / 9 handlers) and `comms` (7 tests / 13 handlers) under-tested | marketplace, realtime-comms | marketplace-advertising, realtime-comms | count table §8 | Medium | `[TEST GAP]` — note in respective gap plans |
| stripe-mock integration not wired; payment webhook tests may not cover live shapes | Billing | billing-stripe | memory: pilot-tier1 TODO `[NEEDS CONFIRMATION]` | Medium | Verify in billing prompt 02 |

## 19. Recommended First Module/Group To Audit

- **Module/group**: Membership Lifecycle
- **Module slug**: `membership-lifecycle`
- **Reason**: it is the platform's core funnel (join → approve → active member) and every high-risk downstream domain (dues, credits, governance, comms targeting) keys off member state. It also sits exactly on the verified split-brain topology (`handlers/member/membership/` + `handlers/membership/` + `handlers/association:member/`), so auditing it first produces the ownership map that prompts 02 for dues, governance, and the mega-module re-scope all need.
- **PRD/spec coverage**: Strong
- **Primary PRD/spec**: `docs/product/modules/m05-membership/MODULE_SPEC.md` + `docs/product/MODULE_SPEC.member.membership.md` + `docs/product/STATE_MACHINES.md` + `docs/quality/SCOPE.membership.md`
- **Recommended prompt**: `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

## 20. Do Not Audit Yet / Delay

| Module/Group | Module Slug | Reason To Delay | Label | Recommended Prerequisite |
| --- | --- | --- | --- | --- |
| Member mega-module split (structural) | member-mega-module | SPLIT-PLAN stale; ADR-0010 chose rebuild-over-split; needs re-scope with current counts | `[NEEDS CONFIRMATION]` | membership-lifecycle audit output |
| Events & Booking | events-booking | Phase 47b booking cleanup in flight; auditing mid-refactor wastes effort | `[NEEDS CONFIRMATION]` | Phase 47b lands |
| Professional Feed | professional-feed | Ranking/moderation rules undefined (BR-35 future) | `[NEEDS PRODUCT DECISION]` | Product decision on feed behavior |
| Job Board | job-board | Code area unverified; may be V2-only | `[NEEDS CONFIRMATION]` | Quick code-mapping check |
| Cross-cutting patterns (05) | cross-cutting | Rules require ≥2–3 module audits first | — | Audits 1–3 complete |
| Database schema (06) | database-schema | Run after module audits surface schema-level issues | — | Audits 1–3 complete |
