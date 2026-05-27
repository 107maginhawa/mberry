<!-- oli-version: 1.1 -->
# Enforcement Coverage Report

**Generated:** 2026-05-27T00:00:00Z
**Modules Assessed:** 19

## Overall Score: 62%

13 implemented modules with handler code, 6 future modules (no code). All specs exist but systematically lack formal Public API sections (only m01 has one). State Machine sections missing from modules that clearly use status transitions in code.

## Per-Module Coverage

| Module | Depth | Breadth | Score | Status | Notes |
|--------|-------|---------|-------|--------|-------|
| m01-auth-onboarding | PARTIAL | PARTIAL | 75% | WARN | Has Public API (unique among specs). Missing State Machines heading despite account deletion state logic. 49 handler files in person/, spec has 9 HTTP refs — partial breadth. |
| m02-member-profile | PARTIAL | PARTIAL | 65% | WARN | Missing Public API section. Shares person/ handlers (49 files). 10 HTTP refs inline but no structured endpoint table. |
| m03-platform-admin | PARTIAL | PARTIAL | 65% | WARN | Missing Public API section. 53 handler files in platformadmin/. 15 HTTP refs inline. Org status transitions in code but State Machines only in body text. |
| m04-org-admin | PARTIAL | PARTIAL | 60% | WARN | Missing Public API section. Maps to association:member/ mega-module (249 handler files). 8 HTTP refs — low coverage for handler count. |
| m05-membership | PARTIAL | PARTIAL | 60% | WARN | Missing Public API section. 36 handlers in membership/ + shared association:member/. Status transitions in code (graceToLapsed job) but no formal State Machine heading. |
| m06-dues-payments | PARTIAL | PARTIAL | 60% | WARN | Missing Public API section. dues/ (10 files) + billing/ (37 files) = 47 handler files. 11 HTTP refs — spec covers ~25% of handlers. Status transitions in dues.repo.ts unspecced. |
| m07-communications | PARTIAL | PARTIAL | 55% | WARN | Missing Public API + State Machines. 4 handler dirs: communication/ (84), comms/ (18), email/ (24), notifs/ (13) = 139 handler files total. 9 HTTP refs — significant breadth gap. Message scheduling state logic unspecced. |
| m08-events | PARTIAL | PARTIAL | 65% | WARN | Missing Public API section. events/ (36) + booking/ (40) = 76 handler files. Booking has explicit status-transitions.ts but spec only mentions state machines in body. 10 HTTP refs. |
| m09-training | PARTIAL | PARTIAL | 65% | WARN | Missing Public API section. 33 handler files. 11 HTTP refs. Training lifecycle transitions referenced in association:operations tests but no formal State Machine heading. |
| m10-credit-tracking | PARTIAL | PARTIAL | 70% | WARN | Missing Public API section. Has State Machines heading (one of 3 specs with it). Shares training/ handlers. 12 HTTP refs. |
| m11-documents-credentials | PARTIAL | PARTIAL | 70% | WARN | Missing Public API section. Has State Machines heading. documents/ (36) + certificates/ (15) + storage/ (10) = 61 handler files. 10 HTTP refs. |
| m12-elections-governance | PARTIAL | PARTIAL | 70% | WARN | Missing Public API section. Has State Machines heading. 22 handler files. 11 HTTP refs. Election/nominee transitions in code match spec. |
| m13-professional-feed | PARTIAL | N/A | 60% | WARN | Future module (no handler code). Missing Public API + State Machines. 5/7 sections present. |
| m14-national-dashboard | PARTIAL | PARTIAL | 55% | WARN | Missing Public API + State Machines. 89 handler files in association:operations/. Only 6 HTTP refs — significant breadth gap for large handler dir. |
| m15-job-board | PARTIAL | N/A | 50% | WARN | Future module. Missing Public API + State Machines. 4/7 sections. |
| m16-advertising | PARTIAL | N/A | 50% | WARN | Future module. Missing Public API + State Machines. 4/7 sections. |
| m17-marketplace | PARTIAL | N/A | 50% | WARN | Future module. Missing Public API + State Machines. 4/7 sections. |
| m18-surveys-polls | PARTIAL | N/A | 50% | WARN | Future module. Missing Public API + State Machines. 4/7 sections. |
| m19-committee-management | PARTIAL | N/A | 60% | WARN | Future module. Missing Public API. Has State Machines in body text. 5/7 sections. |

## Coverage Findings

### P0 Findings
None

### P1 Findings

- **EC-m04-orgad-3a1f7c28**: m04-org-admin spec has 8 HTTP refs but maps to association:member/ with 249 handler files. Spec covers <5% of handler surface area. Critical breadth gap for the largest module.

- **EC-m07-comms-5b2e9d14**: m07-communications spec has 9 HTTP refs but spans 4 handler directories with 139 total handler files. Spec covers <10% of handler surface. Largest breadth gap in codebase.

- **EC-m14-natdb-7c4a1e36**: m14-national-dashboard spec has 6 HTTP refs for 89 handler files in association:operations/. Spec covers <10% of handler surface.

- **EC-m06-duepay-9d5b3f48**: m06-dues-payments maps to dues/ + billing/ (47 handler files). Spec has 11 HTTP refs covering ~25%. Stripe webhook handler, merchant onboarding, invoice lifecycle largely unspecced.

### P2 Findings

- **EC-m01-stmac-2e8f5a71**: m01-auth-onboarding has account deletion state machine in code (requestMyAccountDeletion → executeAccountDeletion → cancelMyAccountDeletion) but no State Machines section in spec.

- **EC-m05-stmac-4f1a7b93**: m05-membership has status transition logic (active → grace → lapsed via graceToLapsed job, flow-10 tests) but no formal State Machines section.

- **EC-m08-stmac-6d3c9e15**: m08-events/booking has explicit status-transitions.ts with test coverage but spec only mentions state machines in body text, not as a structured section with transition tables.

- **EC-m07-stmac-8a2d4f37**: m07-communications has message scheduling state logic (scheduleMessage.ts, cancelMessage.ts) and email queue status transitions but no State Machines section.

- **EC-allmod-pubapi-1b5e7d49**: 18 of 19 MODULE_SPECs lack a formal "Public API" section heading. All have inline HTTP method references (6-15 per spec) but no structured endpoint table with request/response schemas. Only m01-auth-onboarding has the section.

- **EC-m06-stmac-3c7f9a51**: m06-dues-payments has invoice lifecycle state transitions in billing/ (createInvoice → finalizeInvoice → capturePayment → voidInvoice → markUncollectible) and dues payment status history schema, but no State Machines section.

### P3 Findings

- **EC-m03-stmac-5e1b8d73**: m03-platform-admin has org status transition handler (transitionOrgStatus.ts) but State Machines only mentioned in body text, not as structured section.

- **EC-m09-stmac-7f3a2c95**: m09-training has training lifecycle transitions tested in association:operations but no formal State Machine section in spec.

- **EC-future-brdth-9a4c6e17**: 6 future modules (m13, m15-m19) have specs but no code. Breadth assessment deferred until implementation. Specs are pre-positioned but may drift before code arrives.
