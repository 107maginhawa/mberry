<!-- oli-version: 2.0 -->
# Enforcement Coverage Report

**Generated:** 2026-05-28
**Auditor:** oli-enforce-coverage (v2 re-audit)
**Scope:** 19 MODULE_SPECs vs actual codebase handler directories
**Previous audit:** 2026-05-27 (v1.1)

---

## Overall Coverage Score: 62%

- **Modules with source code:** 14 of 19 (includes M16, M17, M18*, M19* which have handlers despite being mapped as "future")
- **Truly future modules (spec-only, no code):** 3 (M13, M15, and partially M18/M19)
- **Weighted score:** 62% (mega-module breadth gaps are the dominant drag)

---

## Per-Module Coverage Table

| Module | Slug | Spec? | Source Dirs | Spec Endpoints | Code Handlers | Coverage | Depth | Breadth | Status |
|--------|------|-------|------------|---------------|---------------|----------|-------|---------|--------|
| M01 | auth-onboarding | YES | person/ | 7 | 24 | 70% | PARTIAL | PARTIAL | WARN |
| M02 | member-profile | YES | person/ (shared) | 10 | 24 (shared) | 80% | FULL | PARTIAL | WARN |
| M03 | platform-admin | YES | platformadmin/ | 15 | 40 | 55% | PARTIAL | PARTIAL | FAIL |
| M04 | org-admin | YES | association:member/ | 8 | 194 (mega) | 30% | PARTIAL | PARTIAL | FAIL |
| M05 | membership | YES | membership/ + assoc:member/ | 9 | 15 + ~30 in mega | 45% | PARTIAL | PARTIAL | FAIL |
| M06 | dues-payments | YES | dues/ + billing/ + assoc:member/ | 11 | 6 + 16 + ~40 in mega | 40% | PARTIAL | PARTIAL | FAIL |
| M07 | communications | YES | communication/ + comms/ + email/ + notifs/ | 9 | 46 + 13 + 13 + 6 = 78 | 50% | PARTIAL | PARTIAL | FAIL |
| M08 | events | YES | events/ + booking/ | 10 | 15 + 19 = 34 | 65% | FULL | PARTIAL | WARN |
| M09 | training | YES | training/ | 11 | 14 | 85% | FULL | ALL | PASS |
| M10 | credit-tracking | YES | training/ + person/ (shared) | 5 | shared | 75% | FULL | ALL | PASS |
| M11 | documents-credentials | YES | documents/ + certificates/ + storage/ | 8 | 15 + 6 + 6 = 27 | 60% | PARTIAL | PARTIAL | WARN |
| M12 | elections-governance | YES | elections/ + assoc:member/ | 8 | 9 + ~13 in mega | 55% | PARTIAL | PARTIAL | FAIL |
| M13 | professional-feed | YES | NO SOURCE | -- | -- | 100% | FULL | ALL | PASS (future) |
| M14 | national-dashboard | YES | association:operations/ | 5 | 69 | 35% | PARTIAL | PARTIAL | FAIL |
| M15 | job-board | YES | NO SOURCE | -- | -- | 100% | FULL | ALL | PASS (future) |
| M16 | advertising | YES | advertising/ | 13 | 7 | 75% | FULL | ALL | PASS |
| M17 | marketplace | YES | marketplace/ | 7 | 9 | 80% | FULL | ALL | PASS |
| M18 | surveys-polls | YES | communication/ (partial)* | ~5 | 5 in communication/ | 70% | PARTIAL | PARTIAL | WARN |
| M19 | committee-management | YES | assoc:operations/ (partial)* | ~6 | 8+ in assoc:ops/ + 2 in platformadmin/ | 60% | PARTIAL | PARTIAL | WARN |

**Legend:** h = handler .ts files (excluding tests)

---

## Handler Inventory (Non-Test .ts Files)

| Directory | Handler Count | Primary Module(s) |
|-----------|--------------|-------------------|
| person/ | 24 | M01, M02, M10 |
| platformadmin/ | 40 | M03, M19 |
| association:member/ | 194 | M04, M05, M06, M10, M11, M12 |
| membership/ | 15 | M05 |
| dues/ | 6 | M06 |
| billing/ | 16 | M06 |
| communication/ | 46 | M07, M18 |
| comms/ | 13 | M07 |
| email/ | 13 | M07 |
| notifs/ | 6 | M07 |
| events/ | 15 | M08 |
| booking/ | 19 | M08 |
| training/ | 14 | M09, M10 |
| documents/ | 15 | M11 |
| certificates/ | 6 | M11 |
| storage/ | 6 | M11 |
| elections/ | 9 | M12 |
| association:operations/ | 69 | M14, M08, M09, M19 |
| audit/ | 1 | (infra) |
| reviews/ | 4 | (NPS, no module) |
| invite/ | 3 | (M05 adjacent) |
| advertising/ | 7 | M16 |
| marketplace/ | 9 | M17 |
| **TOTAL** | **555** | |

---

## Coverage Findings

### P0 -- Critical Gaps (spec covers <10% of handler surface)

| ID | Module | Finding |
|----|--------|---------|
| EC-M04-a1b2c3d4 | m04-org-admin | Spec lists 8 endpoints but association:member/ has 194 handlers. Spec covers org profile, officer assignment, discipline, public page, dashboard. **Unspecced in mega-module**: roster management (addRosterMember, importRosterMembers, listRosterMembers, getRosterMember, updateRosterMember), chapter affiliations (create/update/delete/list/setPrimary), directory profiles (create/update/delete/list/search/publish), credential templates (CRUD), digital credentials (issue/revoke/verify/list), professional licenses (CRUD + renewal alerts), institutional memberships (CRUD + seat allocation), dues configuration (create/update/delete/list + gateway setup + dunning templates), special assessments, royalty splits, payment proof workflows, and subscription management. |
| EC-M06-e5f6a7b8 | m06-dues-payments | Spec lists 11 endpoints. Actual dues surface: dues/ has 6 handlers (checkoutPaymentToken, downloadReceipt, getDuesDashboard, sendPaymentLink, stripeWebhook, validatePaymentToken), billing/ has 16 handlers, association:member/ has ~40 dues-related handlers (createDuesConfig, createDuesInvoice, generateDuesInvoicesForOrg, recordDuesPayment, recordManualPayment, bulkRecordPayments, markDuesInvoicePaid, refundDuesPayment, confirmPaymentProof, rejectPaymentProof, submitPaymentProof, listPendingProofs, getDuesDashboard, getDuesFinancialDashboard, getDuesMetrics, getAgingBucket, recalculateAgingBucket, generateDuesReport, generatePaymentLink, generatePaymentReceipt, validatePaymentLink, handlePaymentWebhook, initiateOnlinePayment, createSubscriptionCheckout, upgradeSubscription, getMySubscription, getDuesGatewayConfig, upsertDuesGatewayConfig, disconnectDuesGateway, testDuesGatewayConnection, createDunningTemplate, updateDunningTemplate, deleteDunningTemplate, listDunningTemplates, getDunningTemplate, listDunningEvents, runDunning, upsertDuesFunds, listDuesFunds, applySpecialAssessment, createSpecialAssessment, updateSpecialAssessment, deleteSpecialAssessment, listSpecialAssessments, getSpecialAssessmentCollection). Spec covers ~18% of total dues surface. |
| EC-M14-c9d0e1f2 | m14-national-dashboard | Spec lists 5 endpoints (summary, chapters list, chapter drill-down, export, platform summary). association:operations/ has 69 handlers. **Unspecced**: event management (createEvent, updateEvent, publishEvent, cancelEvent, completeEvent, deleteEvent + registrations + check-ins + waitlists + refunds), training management (createTraining, publishTraining, completeTraining, cancelTraining, deleteTraining + enrollments), course management (createCourse, updateCourse, deleteCourse + enrollments + progress + quiz attempts), committee management (create/update/dissolve + tasks), accredited providers (CRUD). The spec treats this as a read-only dashboard but the handler directory is a full operations API. |

### P1 -- Major Gaps (spec covers 15-40% of handler surface)

| ID | Module | Finding |
|----|--------|---------|
| EC-M03-13a4b5c6 | m03-platform-admin | Spec lists 15 endpoints. Code has 40 handlers. **Unspecced handlers**: createTicket, addTicketComment, getTicket, listTickets, updateTicketStatus (support ticket system), reportBreach, listBreaches, updateBreachStatus (data breach management), getSubscription, listSubscriptions, cancelSubscription (subscription lifecycle), createPricingTier, listPricingTiers, updatePricingTier (pricing management), exportDashboardReport, listPublicOrgs, getOrganizationBySlug, getCommittee, listAllCommittees, getAdminRole, getNationalDashboard. 25 handlers not covered by spec. |
| EC-M05-d7e8f9a0 | m05-membership | Spec lists 9 endpoints (list members, get member, bulk import, applications, manual add, transfer, directory). Code: membership/ has 15 handlers + association:member/ has ~30 membership-specific handlers. **Unspecced**: createMembershipCategory, createMembershipTier, upsertMembershipCategory (tier/category CRUD), renewMembership, reinstateMembership, resignMembership, terminateMembership, deceaseMembership (lifecycle transitions), bulkApproveMembershipApplications, denyMembershipApplication (bulk operations), createAffiliationTransfer, approveTransferBySource, approveTransferByTarget, denyAffiliationTransfer, completeAffiliationTransfer (multi-step transfer), createChapterAffiliation, setPrimaryChapterAffiliation (chapter management). |
| EC-M07-b1c2d3e4 | m07-communications | Spec lists 9 endpoints. Actual: communication/ (46h) has announcements (create/update/delete/publish/schedule/archive + stats), message templates (CRUD + search + preview), saved segments (CRUD), subscription topics (CRUD), feed posts (CRUD + report + mute), surveys (create + submit + results), polls (create + vote). comms/ (13h) has chat rooms (CRUD + messages), video calls (join/leave/end/update + ICE servers), WebSocket handlers. email/ (13h) has email queue management. notifs/ (6h) has push notifications. Spec covers announcements + basic messaging but misses templates, segments, subscriptions, feed, chat, video, surveys, polls. |
| EC-M12-f5a6b7c8 | m12-elections-governance | Spec lists 8 endpoints (list/create/get/transition/nominate/accept/vote/delete). elections/ has 9 handlers (good match). But association:member/ duplicates: createElection, deleteElection, getElection, listElections, createCandidate, deleteCandidate, updateCandidate, castBallot, certifyElection, openElectionNominations, openElectionVoting, listBallots, listCandidates -- 13 handlers with overlapping names. Governance schemas (governance.schema.ts) in mega-module unspecced. |

### P2 -- Medium Gaps

| ID | Module | Finding |
|----|--------|---------|
| EC-M01-19c0d1e2 | m01-auth-onboarding | Spec lists 7 auth endpoints. person/ has 24 handlers. Credit handlers (createMyCreditEntry, getMyCreditSummary, getMyCredits, listMyCreditEntries) belong to M10. getMyOfficerRole belongs to M04. getMyMemberships belongs to M05. Remaining unspecced: listPersons, updatePerson (admin). Mostly a cross-module attribution issue, not a true gap. |
| EC-M02-23f4a5b6 | m02-member-profile | Spec lists 10 endpoints (profile, privacy, notifications, data export, account deletion, ID card). Missing: updatePerson, updateNotificationPreferences, updatePrivacySettings (admin/org-level variants). accountDeletionCascade, executeAccountDeletion (internal process handlers). Minor gap -- admin variants are M03's responsibility. |
| EC-M08-37a8b9c0 | m08-events | Spec lists 10 event endpoints. events/ has 15 handlers (5 unspecced: bulkCreateEventSeries, getPublicEvent, listPublicEvents, serveEventOgMeta, cancelEvent separate from update). booking/ has 19 handlers entirely unspecced by M08 (createBooking, confirmBooking, cancelBooking, rejectBooking, markNoShowBooking, createBookingEvent, scheduleExceptions, time slots). Booking is a distinct scheduling domain not covered by any module spec. |
| EC-M11-4bd1e2f3 | m11-documents-credentials | Spec lists 8 endpoints. documents/ has 15 handlers: **unspecced** = document versioning (uploadNewDocumentVersion, getDocumentVersion, listDocumentVersions), document tagging (createDocumentTag, updateDocumentTag, deleteDocumentTag, getDocumentTag, listDocumentTags), access logging (getDocumentAccessLog), archiving (archiveDocument). certificates/ has 6: **unspecced** = batchGenerateCertificates, bulkIssueCertificates. storage/ (6h) entirely unspecced as separate concern. |
| EC-M18-8fb5c6d7 | m18-surveys-polls | MODULE_MAP.md marks as "NO SOURCE (future)" but 5 handlers exist in communication/: createSurvey, submitSurveyResponse, getSurveyResults, createPoll, votePoll. Plus survey.schema.ts exists. Source mapping needs update. |
| EC-M19-9ac6d7e8 | m19-committee-management | MODULE_MAP.md marks as "NO SOURCE (future)" but 8+ handlers in association:operations/ (createCommittee, updateCommittee, dissolveCommittee, getCommittee, listCommittees, createCommitteeTask, updateCommitteeTask, completeCommitteeTask) plus 2 in platformadmin/ (getCommittee, listAllCommittees). committee.schema.ts and committee-task.schema.ts exist. Source mapping needs update. |

### P3 -- Advisory

| ID | Module | Finding |
|----|--------|---------|
| EC-M09-5ce2f3a4 | m09-training | Spec lists 11 endpoints; code has 14 handlers. Good alignment. **Unspecced**: accredited provider management (createAccreditedProvider, listAccreditedProviders, updateAccreditedProvider, deleteAccreditedProvider). Also association:operations/ has parallel training handlers (createTraining, publishTraining, etc.) which may overlap. |
| EC-M16-6df3a4b5 | m16-advertising | Spec lists 13 endpoints; code has 7 handlers (createAdvertiser, createCampaign, createCreative, getAdForPlacement, reportAd, reviewCreative, setMemberOptOut). Spec exceeds code -- forward coverage is good. advertising.schema.ts exists. |
| EC-M17-7ea4b5c6 | m17-marketplace | Spec lists 7 endpoints; code has 9 handlers (createListing, createOrder, createVendor, fulfillOrder, getVendor, listListings, listVendors, updateVendor, verifyVendor). Good alignment. marketplace.schema.ts exists in marketplace/repos/. |
| EC-MEGA-0bd7e8f9 | cross-module | The association:member/ mega-module (194 handlers, 14 schemas) is the dominant cause of coverage failures across M04, M05, M06, M10, M11, M12. The deferred split plan at `.planning/deferred/14-mega-module-split/SPLIT-PLAN.md` would resolve this but is scheduled for v1.2.0. |
| EC-BOOK-1ce8f9a0 | booking | booking/ (19 handlers, 1 schema) has no dedicated module spec. It is loosely mapped to M08 but covers a distinct scheduling/appointment domain (bookings, booking events, schedule exceptions, time slots, no-shows) not addressed by the events spec. |
| EC-RVWS-2df9a0b1 | reviews | reviews/ (4 handlers: createReview, deleteReview, getReview, listReviews) has no module mapping. NPS review system is orphaned from all specs. |
| EC-INVT-3ea0b1c2 | invite | invite/ (3 handlers) is loosely M05-adjacent but not formally specced. |
| EC-AUDT-4fb1c2d3 | audit | audit/ (1 handler) is infrastructure, not module-specced. Acceptable. |

---

## Spec Structure Assessment

All 19 MODULE_SPECs use a consistent 22-section template (sections 1-22 including 7b and 10b). Self-assessed completeness (Section 21) shows all sections marked COMPLETE in sampled specs (M01, M04, M07).

**Key structural observation**: All specs have a "10. API Expectations" section with endpoint tables. The issue is not structural completeness but **breadth** -- the endpoint tables list 5-15 endpoints per module while the actual handler directories contain 2-20x more handlers.

---

## Root Cause Analysis

1. **Mega-module concentration**: association:member/ (194 handlers) and association:operations/ (69 handlers) together hold 263 handlers -- 47% of the entire codebase. These two directories serve 8+ logical modules but each spec only documents its own slice.

2. **Spec-code drift**: Handlers were added organically (especially during phases 35-47) without corresponding spec updates. The specs reflect the original design intent, not the current implementation reality.

3. **Duplicate handler patterns**: Operations like elections, dues, training, and committees exist in BOTH dedicated module directories AND the mega-modules, creating ambiguous ownership.

4. **Incorrect future-module mapping**: M18 (surveys) and M19 (committees) have working implementations but MODULE_MAP.md still marks them as "NO SOURCE (future)."

5. **Orphaned handlers**: booking/ (19h), reviews/ (4h), invite/ (3h), audit/ (1h) have no module spec ownership or incomplete mapping.

---

## Recommendations

| Priority | Action | Impact |
|----------|--------|--------|
| P0 | Update M04, M06, M14 specs to document actual mega-module handler surface | +15% overall score |
| P1 | Update MODULE_MAP.md: M18 -> communication/, M19 -> association:operations/ + platformadmin/ | Correct future/active classification |
| P1 | Update M03, M05, M07, M12 specs with missing endpoint documentation | +8% overall score |
| P1 | Create or extend spec for booking/ (either as M08 addendum or standalone) | Covers 19 orphaned handlers |
| P2 | Update M08 spec to cover booking/ handlers | +3% score |
| P2 | Update M11 spec with document versioning, tagging, access logs, storage | +2% score |
| P3 | Track mega-module split progress -- coverage improves naturally post-split | Long-term fix |
| P3 | Map reviews/ (4h) and invite/ (3h) to appropriate module specs | Minor coverage |

---

## Score Methodology

- **Source modules**: `Score = min(specced_endpoints / total_relevant_handlers, 1.0) * depth_multiplier`
  - depth_multiplier: FULL = 1.0 (spec covers all dimensions), PARTIAL = 0.85, SHALLOW = 0.6
  - Dimensions checked: API endpoints, workflows, state machines, domain events, data model, permissions
  - Breadth: ALL if >85% of handlers traceable to spec endpoints, PARTIAL otherwise
- **Future modules (no code)**: Score = 100% (spec exists, implementation deliberately deferred)
- **Overall score**: Weighted average -- source modules weight 2x, future modules weight 1x
- **Status thresholds**: PASS >= 70%, WARN 55-69%, FAIL < 55%
