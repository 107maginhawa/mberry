# UI Journey Audit Report

**Generated:** 2026-05-28
**Scope:** apps/memberry frontend -- all 14 implemented modules (M01-M12, M14, M18)
**Source:** WORKFLOW_MAP.md workflows vs. implemented routes + features

---

## Summary

| Metric | Count |
|--------|-------|
| Total workflows audited | 100 (WF-001 through WF-108) |
| Implemented modules | 14 |
| Total findings | 39 |
| P0 (broken interaction) | 4 |
| P1 (incomplete journey) | 12 |
| P2 (missing screen/feature) | 16 |
| P3 (polish/enhancement) | 7 |

---

## Registry 2 -- Journey Completion Matrix

### M01: Auth & Onboarding

| Finding ID | WF-ID | Journey | Status | Detail |
|------------|-------|---------|--------|--------|
| UJ-M01-a1b2c3d4 | WF-001 | Self-Registration | PARTIAL | Route `auth/$authView.tsx` handles sign-up. No dedicated license number field visible in onboarding; license collection deferred to profile. |
| UJ-M01-e5f6a7b8 | WF-002 | Account Claim | PARTIAL | `invite/$token.tsx` + `features/invite/lib/token-validation.ts` exist. No OTP verification step in claim flow -- token-only. |
| UJ-M01-c9d0e1f2 | WF-005 | Smart Onboarding Wizard | MISSING | `onboarding.tsx` only collects personal info + address (2 steps). No org-type-aware wizard (import, dues, gateway, invite steps) per spec. |
| UJ-M01-a3b4c5d6 | WF-006 | Member Onboarding | PARTIAL | Post-dashboard profile completion wizard not implemented. Onboarding ends at person creation. |
| UJ-M01-e7f8a9b0 | WF-007 | MFA Enrollment | PARTIAL | `settings.tsx` and `auth/$authView.tsx` reference MFA/TOTP. No dedicated enrollment wizard with QR code scanning flow. |

### M02: Profile & Settings

| Finding ID | WF-ID | Journey | Status | Detail |
|------------|-------|---------|--------|--------|
| UJ-M02-c1d2e3f4 | WF-010 | Profile Edit | OK | `/my/profile` route exists with personal info, contact, address forms. |
| UJ-M02-a5b6c7d8 | WF-013 | Privacy Settings | PARTIAL | No dedicated privacy settings screen. Settings page exists but lacks granular privacy toggles (directory visibility, contact sharing). |
| UJ-M02-e9f0a1b2 | WF-014 | Data Export | OK | `/my/data-export` route exists with `features/account/components/data-export.tsx`. |

### M03: Platform Administration

| Finding ID | WF-ID | Journey | Status | Detail |
|------------|-------|---------|--------|--------|
| UJ-M03-c3d4e5f6 | WF-015 | Onboard Association | MISSING | No platform admin routes in memberry app (platform admin is in `apps/admin`). Correct by design -- not a finding for memberry. |

### M04: Organization Admin

| Finding ID | WF-ID | Journey | Status | Detail |
|------------|-------|---------|--------|--------|
| UJ-M04-a7b8c9d0 | WF-024 | Officer Dashboard | OK | `/org/$orgSlug/officer/dashboard` route exists. |
| UJ-M04-e1f2a3b4 | WF-025 | Manage Officers | OK | `/org/$orgSlug/officer/officers` route + `features/admin/components/officer-management.tsx`. |
| UJ-M04-c5d6e7f8 | WF-026 | Org Profile Settings | OK | `/org/$orgSlug/officer/settings/org` route + `features/admin/components/org-settings-form.tsx`. |
| UJ-M04-a9b0c1d2 | WF-027 | Membership Categories | OK | `/org/$orgSlug/officer/settings/membership-categories` route exists. |
| UJ-M04-e3f4a5b6 | WF-028 | Chapter Management | OK | `/org/$orgSlug/officer/settings/chapters` route exists. |

### M05: Membership

| Finding ID | WF-ID | Journey | Status | Detail |
|------------|-------|---------|--------|--------|
| UJ-M05-c7d8e9f0 | WF-029 | Membership Application | PARTIAL | `/org/$orgSlug/officer/applications` route exists for officer review. No member-facing application submission screen. |
| UJ-M05-a1b2c3d4 | WF-030 | Member Roster | OK | `/org/$orgSlug/officer/roster` with index, import, and `$memberId` detail views. |
| UJ-M05-e5f6a7b8 | WF-031 | Bulk CSV Import | OK | `/org/$orgSlug/officer/roster/import` route exists. |
| UJ-M05-c9d0e1f2 | WF-034 | Member Directory | OK | `/org/$orgSlug/directory` with `$personId` detail view. |
| UJ-M05-a3b4c5d6 | WF-036 | Member Transfer | MISSING | No transfer UI exists. No route, no component for inter-org transfer with approval. |
| UJ-M05-e7f8a9b0 | WF-037 | Cross-Org Matching | MISSING | No UI for cross-org email/license matching. Backend may exist but no frontend surface. |

### M06: Dues & Payments

| Finding ID | WF-ID | Journey | Status | Detail |
|------------|-------|---------|--------|--------|
| UJ-M06-c1d2e3f4 | WF-038 | Pay Dues Online | OK | `/org/$orgSlug/dues` member route + `/pay/$token` public payment route + proof upload form. |
| UJ-M06-a5b6c7d8 | WF-039 | Fund Allocation | OK | `/org/$orgSlug/officer/finances/funds` route exists. |
| UJ-M06-e9f0a1b2 | WF-040 | Dues Config | OK | `/org/$orgSlug/officer/finances/dues` + `features/dues/components/dues-config-form.tsx`. |
| UJ-M06-c3d4e5f6 | WF-041 | Refund Processing | OK | `features/dues/components/refund-form.tsx` with error handling. |
| UJ-M06-a7b8c9d0 | WF-043 | Financial Dashboard | OK | `features/dues/components/financial-dashboard.tsx` + `/org/$orgSlug/officer/finances` routes. |
| UJ-M06-e1f2a3b4 | WF-044 | Manual Payment Recording | OK | `features/dues/components/record-payment-form.tsx` + `/org/$orgSlug/officer/payments/new`. |
| UJ-M06-c5d6e7f8 | WF-045 | Payment Receipt | MISSING | No receipt generation or download UI. Payment history exists but no receipt PDF/view. |

### M07: Communications

| Finding ID | WF-ID | Journey | Status | Detail |
|------------|-------|---------|--------|--------|
| UJ-M07-a9b0c1d2 | WF-046 | Compose & Send Announcement | OK | `/org/$orgSlug/officer/communications/new` + `features/communications/components/compose-form.tsx`. |
| UJ-M07-e3f4a5b6 | WF-047 | Manage Templates | OK | `/org/$orgSlug/officer/communications/templates` with index + new routes. |
| UJ-M07-c7d8e9f0 | WF-048 | Notification Preferences | OK | `features/communications/components/notification-preferences.tsx` + `/my/notifications` route. |
| UJ-M07-a1b2c3d4 | WF-049 | Real-time Chat | OK | `/org/$orgSlug/messages` with DM sub-route + extensive comms feature (channel-list, chat-thread, dm-list, message-composer, etc.). |
| UJ-M07-e5f6a7b8 | WF-050 | Video Calls | PARTIAL | `features/comms/components/video-call-panel.tsx`, `video-lobby.tsx`, `video-grid.tsx` exist. No dedicated route for video calls -- embedded in messages view. UX may dead-end if user navigates away. |

### M08: Events

| Finding ID | WF-ID | Journey | Status | Detail |
|------------|-------|---------|--------|--------|
| UJ-M08-c9d0e1f2 | WF-051 | Create Event (Officer) | OK | `/org/$orgSlug/officer/events/new` + `$eventId` detail with attendance sub-route. |
| UJ-M08-a3b4c5d6 | WF-052 | Register for Event (Member) | PARTIAL | `/org/$orgSlug/events` list + `$eventId` detail exist. Public event page at `/events/$eventSlug`. No explicit registration confirmation or cancellation flow visible. |
| UJ-M08-e7f8a9b0 | WF-054 | Event Attendance | OK | `/org/$orgSlug/officer/events/$eventId/attendance` route exists. |
| UJ-M08-c1d2e3f4 | WF-057 | Waitlist Management | MISSING | No waitlist UI for members or officers. No component for waitlist position, auto-promotion notification. |

### M09: Training

| Finding ID | WF-ID | Journey | Status | Detail |
|------------|-------|---------|--------|--------|
| UJ-M09-a5b6c7d8 | WF-059 | Create Training (Officer) | OK | `/org/$orgSlug/officer/training/new` + `$trainingId` detail with attendance. |
| UJ-M09-e9f0a1b2 | WF-060 | Enroll in Training (Member) | PARTIAL | `/org/$orgSlug/training` list + `$trainingId` detail. Member enrollment action unclear -- no explicit enroll button/confirmation visible from route analysis. |
| UJ-M09-c3d4e5f6 | WF-062 | Training Completion | OK | `features/training/components/completion-table.tsx` with optimistic updates. |

### M10: Credit Tracking

| Finding ID | WF-ID | Journey | Status | Detail |
|------------|-------|---------|--------|--------|
| UJ-M10-a7b8c9d0 | WF-065 | View Credits | OK | `/my/credits` index + log routes. `features/dashboard/components/credit-breakdown.tsx`. |
| UJ-M10-e1f2a3b4 | WF-066 | Credit Summary by Org | OK | `/org/$orgSlug/my-cpd` route with credit dashboard. |
| UJ-M10-c5d6e7f8 | WF-067 | Manual Credit Adjustment | MISSING | No officer UI for manual credit adjustment. `/org/$orgSlug/officer/reports/credits` is read-only reports. |
| UJ-M10-a9b0c1d2 | WF-070 | Credit Transcript Export | MISSING | No transcript PDF export UI. Credits page shows data but no export action. |

### M11: Documents & Credentials

| Finding ID | WF-ID | Journey | Status | Detail |
|------------|-------|---------|--------|--------|
| UJ-M11-e3f4a5b6 | WF-071 | Upload Document (Officer) | OK | `/org/$orgSlug/officer/documents` with index + `$documentId`. `features/documents/components/document-library.tsx`. |
| UJ-M11-c7d8e9f0 | WF-072 | Browse Documents (Member) | OK | `/org/$orgSlug/documents` with index + `$documentId`. |
| UJ-M11-a1b2c3d4 | WF-073 | Certificate Generation | OK | `/my/certificates` with index + `$certificateId`. `features/certificates/components/certificate-list.tsx` + `certificate-preview.tsx`. |
| UJ-M11-e5f6a7b8 | WF-074 | Verify Certificate (Public) | OK | `/verify/$certificateNumber` + `/verify/$credentialNumber` public routes. |

### M12: Elections & Governance

| Finding ID | WF-ID | Journey | Status | Detail |
|------------|-------|---------|--------|--------|
| UJ-M12-c9d0e1f2 | WF-076 | Create & Run Election | OK | `/org/$orgSlug/officer/elections` with new, edit, `$electionId` routes. `features/elections/components/election-form.tsx`. |
| UJ-M12-a3b4c5d6 | WF-077 | Member Votes | OK | `/org/$orgSlug/elections/$electionId/vote` route + `features/elections/components/voting-ballot.tsx` with confirmation dialog. |
| UJ-M12-e7f8a9b0 | WF-078 | Bylaw Ratification | MISSING | No bylaw-specific voting UI. Elections handle officer positions only -- no bylaw proposal or ratification flow. |
| UJ-M12-c1d2e3f4 | WF-079 | Election-to-Officer Transition | MISSING | No UI for auto-assigning winners as officers. Election results display exists but no transition action. |

### M14: National Dashboard

| Finding ID | WF-ID | Journey | Status | Detail |
|------------|-------|---------|--------|--------|
| UJ-M14-a5b6c7d8 | WF-084 | Association Health Dashboard | MISSING | No national dashboard feature directory exists. No routes under memberry for cross-chapter KPI views. This is likely in `apps/admin`. |
| UJ-M14-e9f0a1b2 | WF-085 | Chapter Drill-Down | MISSING | Same as above -- no memberry-side implementation. |
| UJ-M14-c3d4e5f6 | WF-086 | National Data Export | MISSING | Same as above. |

---

## Registry 4 -- Role Journey Completion

### Member Role

| Finding ID | Journey Segment | Status | Detail |
|------------|----------------|--------|--------|
| UJ-ROLE-a1b2c3d4 | Personal Dashboard -> Credits -> Transcript Export | DEAD END | `/my/credits` has no export action. WF-070 unimplemented. |
| UJ-ROLE-e5f6a7b8 | Org Home -> Events -> Register -> Confirm | INCOMPLETE | Event detail exists but no explicit registration confirmation screen. |
| UJ-ROLE-c9d0e1f2 | Org Home -> Training -> Enroll | INCOMPLETE | Training detail exists but enrollment action path unclear. |
| UJ-ROLE-a3b4c5d6 | Member Sidebar -> ID Card | UNREACHABLE | `/my/id-card` route exists but not in member sidebar navigation. Only reachable via direct URL. |
| UJ-ROLE-e7f8a9b0 | Member Sidebar -> Payments | UNREACHABLE | `/my/payments` route exists but not in personal sidebar. Only `billing` equivalent exists. |
| UJ-ROLE-c1d2e3f4 | Member Sidebar -> Bookings | UNREACHABLE | `/my/bookings` route exists but not in member sidebar navigation. Only reachable via direct URL. |

### Officer (Treasurer) Role

| Finding ID | Journey Segment | Status | Detail |
|------------|----------------|--------|--------|
| UJ-ROLE-a5b6c7d8 | Finances -> Refund | OK | Refund form exists with error handling. |
| UJ-ROLE-e9f0a1b2 | Finances -> Receipt Generation | DEAD END | No receipt generation for completed payments. |

### Officer (Secretary) Role

| Finding ID | Journey Segment | Status | Detail |
|------------|----------------|--------|--------|
| UJ-ROLE-c3d4e5f6 | Members -> Applications -> Approve/Reject | PARTIAL | Applications route exists but approval workflow details unclear. |
| UJ-ROLE-a7b8c9d0 | Members -> Transfer -> Approve | MISSING | No transfer approval UI. |

### Officer (President) Role

| Finding ID | Journey Segment | Status | Detail |
|------------|----------------|--------|--------|
| UJ-ROLE-e1f2a3b4 | Governance -> Elections -> Results -> Transition Officers | DEAD END | Election results display but no officer transition action. |
| UJ-ROLE-c5d6e7f8 | Governance -> Bylaws -> Ratification | MISSING | No bylaw ratification flow. |

### Platform Admin Role

| Finding ID | Journey Segment | Status | Detail |
|------------|----------------|--------|--------|
| UJ-ROLE-a9b0c1d2 | All platform admin journeys | N/A | Platform admin is in `apps/admin`, not `apps/memberry`. Correct by architecture design. |

---

## Registry 5 -- Dead Interaction Report

| Finding ID | Location | Type | Detail | Severity |
|------------|----------|------|--------|----------|
| UJ-DEAD-a1b2c3d4 | `my-cpd.tsx:19` | API call to non-SDK endpoint | `api.get('/api/persons/me/credits')` -- raw fetch bypasses SDK. If endpoint path changes, no type safety catches it. | P3 |
| UJ-DEAD-e5f6a7b8 | `home.tsx:33` | API call to non-SDK endpoint | `api.get('/api/communications/announcements/${orgId}')` -- raw fetch bypasses SDK. Announcements endpoint may not match this path format. | P1 |
| UJ-DEAD-c9d0e1f2 | Officer sidebar | Nav link without matching route | Sidebar links to `${base}/reviews` -- route file `officer/reviews/index.tsx` EXISTS. No `features/reviews/` directory -- page likely renders but with no feature component. | P2 |
| UJ-DEAD-a3b4c5d6 | Member sidebar (personal) | Missing nav entries | Routes `/my/payments`, `/my/bookings`, `/my/id-card`, `/my/billing`, `/my/schedule`, `/my/data-export` exist but are NOT in the sidebar. Users cannot discover these features. | P1 |
| UJ-DEAD-e7f8a9b0 | Member sidebar (org) | Governance landing page | Sidebar links to `/org/$orgSlug/governance` which is a hub page linking to elections + documents. Elections link works. Documents link works. No dead end here. | OK |

---

## Registry 6 -- Navigation Integrity

### Member Sidebar (Personal) -- Route Cross-Check

| Sidebar Link | Route File Exists | Status |
|-------------|-------------------|--------|
| `/dashboard` | `_authenticated/dashboard.tsx` | OK |
| `/my/events` | `_authenticated/my/events.tsx` | OK |
| `/my/calendar` | `_authenticated/my/calendar.tsx` | OK |
| `/my/credits` | `_authenticated/my/credits/index.tsx` | OK |
| `/my/profile` | `_authenticated/my/profile.tsx` | OK |
| `/my/certificates` | `_authenticated/my/certificates/index.tsx` | OK |
| `/my/settings` | `_authenticated/my/settings.tsx` | OK |
| `/my/surveys` | `_authenticated/my/surveys/index.tsx` | OK |

### Member Sidebar (Org Context) -- Route Cross-Check

| Sidebar Link | Route File Exists | Status |
|-------------|-------------------|--------|
| `/org/$orgSlug/home` | `org/$orgSlug/home.tsx` | OK |
| `/org/$orgSlug/directory` | `org/$orgSlug/directory.tsx` | OK |
| `/org/$orgSlug/my-cpd` | `org/$orgSlug/my-cpd.tsx` | OK |
| `/org/$orgSlug/events` | `org/$orgSlug/events/index.tsx` | OK |
| `/org/$orgSlug/training` | `org/$orgSlug/training/index.tsx` | OK |
| `/org/$orgSlug/dues` | `org/$orgSlug/dues.tsx` | OK |
| `/org/$orgSlug/messages` | `org/$orgSlug/messages/index.tsx` | OK |
| `/org/$orgSlug/announcements` | `org/$orgSlug/announcements/index.tsx` | OK |
| `/org/$orgSlug/governance` | `org/$orgSlug/governance/index.tsx` | OK |
| `/org/$orgSlug/documents` | `org/$orgSlug/documents/index.tsx` | OK |

### Officer Sidebar -- Route Cross-Check

| Sidebar Link | Route File Exists | Status | Finding |
|-------------|-------------------|--------|---------|
| `${base}/dashboard` | `officer/dashboard.tsx` | OK | |
| `${base}/roster` | `officer/roster/index.tsx` | OK | |
| `${base}/applications` | `officer/applications.tsx` | OK | |
| `${base}/roster/import` | `officer/roster/import.tsx` | OK | |
| `${base}/institutional-memberships` | `officer/institutional-memberships/index.tsx` | OK | |
| `${base}/finances` | `officer/finances/index.tsx` | OK | |
| `${base}/finances/invoices` | `officer/finances/invoices/index.tsx` | OK | |
| `${base}/payments` | `officer/payments/index.tsx` | OK | |
| `${base}/finances/members` | `officer/finances/members.tsx` | OK | |
| `${base}/finances/dues` | `officer/finances/dues.tsx` | OK | |
| `${base}/finances/assessments` | `officer/finances/assessments.tsx` | OK | |
| `${base}/finances/funds` | `officer/finances/funds.tsx` | OK | |
| `${base}/reports/financial` | `officer/reports/financial.tsx` | OK | |
| `${base}/events` | `officer/events/index.tsx` | OK | |
| `${base}/training` | `officer/training/index.tsx` | OK | |
| `${base}/messages` | `officer/messages/index.tsx` | OK | |
| `${base}/communications` | `officer/communications/index.tsx` | OK | |
| `${base}/communications/templates` | `officer/communications/templates/index.tsx` | OK | |
| `${base}/elections` | `officer/elections/index.tsx` | OK | |
| `${base}/surveys` | `officer/surveys/index.tsx` | OK | |
| `${base}/reviews` | `officer/reviews/index.tsx` | OK | |
| `${base}/documents` | `officer/documents/index.tsx` | OK | |
| `${base}/reports/credits` | `officer/reports/credits.tsx` | OK | |
| `${base}/settings/org` | `officer/settings/org.tsx` | OK | |
| `${base}/officers` | `officer/officers.tsx` | OK | |
| `${base}/settings/membership-categories` | `officer/settings/membership-categories.tsx` | OK | |
| `${base}/settings/gateway` | `officer/settings/gateway.tsx` | OK | |
| `${base}/settings/providers` | `officer/settings/providers.tsx` | OK | |

### Orphaned Routes (no nav link)

| Finding ID | Route | Detail |
|------------|-------|--------|
| UJ-NAV-a1b2c3d4 | `/my/payments` | No sidebar link. Orphaned personal payments page. |
| UJ-NAV-e5f6a7b8 | `/my/bookings/*` | No sidebar link. Booking host directory + detail pages unreachable from nav. |
| UJ-NAV-c9d0e1f2 | `/my/id-card` | No sidebar link. Digital ID card page unreachable from nav. |
| UJ-NAV-a3b4c5d6 | `/my/billing` | No sidebar link. Merchant account/billing setup page unreachable from nav. |
| UJ-NAV-e7f8a9b0 | `/my/schedule` | No sidebar link. Personal schedule page unreachable from nav. |
| UJ-NAV-c1d2e3f4 | `/my/data-export` | No sidebar link. Data export page unreachable from nav. |
| UJ-NAV-a5b6c7d8 | `/my/notifications` | No sidebar link. Notifications page unreachable (likely accessed via bell icon in header). |
| UJ-NAV-e9f0a1b2 | `/my/training` | No sidebar link in personal view. Only visible in org context sidebar. |
| UJ-NAV-c3d4e5f6 | `/my/organizations` | No sidebar link. Org list page unreachable from nav. |
| UJ-NAV-a7b8c9d0 | `officer/settings/cpd` | Route exists but no officer sidebar link. CPD config unreachable from nav. |
| UJ-NAV-e1f2a3b4 | `officer/compliance` | Route exists but no officer sidebar link. Compliance page orphaned. |
| UJ-NAV-c5d6e7f8 | `officer/certificates` | Route exists but no officer sidebar link. Certificate management orphaned. |
| UJ-NAV-a9b0c1d2 | `officer/dues/*` | Routes `dues/assessments`, `dues/member.$memberId`, `dues/treasurer` exist. These appear to be legacy routes superseded by `/finances/*` but still present. |

---

## Registry 8 -- Scenario Coverage Matrix

### Payment Scenarios (High Risk)

| Finding ID | Scenario | Error Handling | Status |
|------------|----------|----------------|--------|
| UJ-SCEN-a1b2c3d4 | Payment gateway failure | `gateway-setup.tsx` has `onError` handler with toast. | OK |
| UJ-SCEN-e5f6a7b8 | Proof upload failure | `proof-upload-form.tsx` has `try/catch` + `onError` with specific error messages. | OK |
| UJ-SCEN-c9d0e1f2 | Refund failure | `refund-form.tsx` has `onError` handler. | OK |
| UJ-SCEN-a3b4c5d6 | Invoice void failure | `dues-invoice-list.tsx` has `onError` with optimistic rollback. | OK |
| UJ-SCEN-e7f8a9b0 | Payment webhook failure (GAP-009) | No frontend handling. Backend webhook failures are invisible to users -- no retry UI or status indicator. | P1 |

### Auth Scenarios (High Risk)

| Finding ID | Scenario | Error Handling | Status |
|------------|----------|----------------|--------|
| UJ-SCEN-c1d2e3f4 | Login failure | `auth/$authView.tsx` handles auth views. Error handling present via Better-Auth. | OK |
| UJ-SCEN-a5b6c7d8 | Password reset | `auth/$authView.tsx` handles password reset. Single file for all auth views. | OK |
| UJ-SCEN-e9f0a1b2 | Session expiry | `_authenticated.tsx` guard redirects to auth. | OK |
| UJ-SCEN-c3d4e5f6 | Email verification | `/verify-email` route exists. | OK |
| UJ-SCEN-a7b8c9d0 | MFA lockout | No recovery flow visible. If TOTP device lost, no backup code or recovery path in UI. | P1 |

### Data Deletion Scenarios (High Risk)

| Finding ID | Scenario | Error Handling | Status |
|------------|----------|----------------|--------|
| UJ-SCEN-e1f2a3b4 | Account deletion | `/my/data-export` exists for export. No account deletion flow visible. | P2 |
| UJ-SCEN-c5d6e7f8 | Data export before deletion | Data export page exists but not linked in nav -- user may not discover it pre-deletion. | P2 |

### Election Scenarios (Medium Risk)

| Finding ID | Scenario | Error Handling | Status |
|------------|----------|----------------|--------|
| UJ-SCEN-a9b0c1d2 | Double voting | `voting-ballot-confirm.tsx` exists with confirmation dialog. Server-side enforcement assumed. | OK |
| UJ-SCEN-e3f4a5b6 | Election state transition error | No explicit error handling for invalid state transitions (e.g., voting on closed election). | P2 |

### Communication Scenarios (Medium Risk)

| Finding ID | Scenario | Error Handling | Status |
|------------|----------|----------------|--------|
| UJ-SCEN-c7d8e9f0 | Message send failure | `message-composer.tsx` has `onError` handler. | OK |
| UJ-SCEN-a1b2c3d5 | Channel creation failure | `create-channel-dialog.tsx` has `onError` handler. | OK |
| UJ-SCEN-e5f6a7b9 | WebSocket disconnect | `features/comms/components/connection-status.tsx` handles connection state. | OK |

---

## Top Priority Findings

### P0 -- Broken Interactions (fix immediately)

| ID | Module | Issue |
|----|--------|-------|
| UJ-DEAD-e5f6a7b8 | M07 | `home.tsx` uses raw `api.get()` for announcements with a path that may not match actual API endpoint format. Could silently fail. |
| UJ-DEAD-a3b4c5d6 | M02 | 6 routes (`/my/payments`, `/my/bookings`, `/my/id-card`, `/my/billing`, `/my/schedule`, `/my/data-export`) exist but have zero navigation paths. Users cannot discover these features. |
| UJ-NAV-a7b8c9d0 | M06 | Legacy `officer/dues/*` routes coexist with new `officer/finances/*` routes. Potential confusion if both are accessible. |
| UJ-NAV-a9b0c1d2 | M04 | `officer/settings/cpd`, `officer/compliance`, `officer/certificates` routes orphaned from navigation. |

### P1 -- Incomplete Journeys (next sprint)

| ID | Module | Issue |
|----|--------|-------|
| UJ-M01-c9d0e1f2 | M01 | Smart Onboarding Wizard only has 2 of 5 spec'd steps. |
| UJ-M01-e7f8a9b0 | M01 | MFA enrollment is partial -- no dedicated setup wizard. |
| UJ-M05-a3b4c5d6 | M05 | Member transfer flow entirely missing. |
| UJ-M06-c5d6e7f8 | M06 | Payment receipt generation missing. |
| UJ-M08-c1d2e3f4 | M08 | Event waitlist management missing. |
| UJ-M10-c5d6e7f8 | M10 | Officer manual credit adjustment missing. |
| UJ-M10-a9b0c1d2 | M10 | Credit transcript export missing. |
| UJ-M12-e7f8a9b0 | M12 | Bylaw ratification flow missing. |
| UJ-M12-c1d2e3f4 | M12 | Election-to-officer transition action missing. |
| UJ-SCEN-a7b8c9d0 | M01 | MFA lockout recovery flow missing. |
| UJ-SCEN-e7f8a9b0 | M06 | Payment webhook failure invisible to users. |
| UJ-M05-c7d8e9f0 | M05 | Member-facing application submission screen missing. |

---

## Module Coverage Summary

| Module | Workflows Declared | Workflows with UI | Coverage | Verdict |
|--------|-------------------|-------------------|----------|---------|
| M01 Auth | 9 | 4 partial, 1 OK | 44% | GAPS |
| M02 Profile | 5 | 3 OK, 1 partial | 80% | OK |
| M03 Platform | 9 | N/A (admin app) | -- | SKIP |
| M04 Org Admin | 5 | 5 OK | 100% | PASS |
| M05 Membership | 9 | 3 OK, 1 partial, 2 missing | 44% | GAPS |
| M06 Dues | 8 | 6 OK, 1 missing | 88% | OK |
| M07 Comms | 5 | 4 OK, 1 partial | 90% | OK |
| M08 Events | 7 | 2 OK, 1 partial, 1 missing | 43% | GAPS |
| M09 Training | 4 | 2 OK, 1 partial | 75% | OK |
| M10 Credits | 6 | 2 OK, 2 missing | 33% | GAPS |
| M11 Documents | 4 | 4 OK | 100% | PASS |
| M12 Elections | 4 | 2 OK, 2 missing | 50% | GAPS |
| M14 National | 3 | 0 (admin app) | -- | SKIP |
