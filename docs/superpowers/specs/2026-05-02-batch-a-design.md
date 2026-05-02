# Batch A: F3-F7 Combined Design Spec

**Date:** 2026-05-02
**Slices:** F3 Membership (5 screens) + F4 Events (4 screens) + F5 Training (4 screens) + F6 Communications (3 screens) + F7 Documents (2 screens)
**Total:** 18 officer screens + 5 member screens = 23 screens
**Branch:** feature/phase0-foundation

## Architecture

Each module gets its own handler directory under `services/api-ts/src/handlers/` and feature directory under `apps/memberry/src/features/`. Shared patterns:

- **CRUD List/Detail** pattern: list with filters → detail page → create/edit form
- **Attendance/Check-in** pattern: QR scanner + manual search (shared between Events + Training)
- **Rich text editor**: Tiptap (shared between Events, Training, Communications)
- **Stat cards**: reusable StatRow component

## Dependency Order

1. **F3 Membership** FIRST — roster is used by events/training attendance
2. **F6 Communications** — lightweight, independent
3. **F7 Documents** — lightweight, depends on training completion
4. **F4 Events** — needs roster for check-in
5. **F5 Training** — needs roster for attendance, shares check-in component with events

## Module Summaries

### F3: Membership (M05)

**Backend:** `services/api-ts/src/handlers/membership/`
- Schema: `membership_categories` (name, description, dues_amount, billing_cycle, sort_order, active, org_id)
- Handlers: listMembers, getMember, addMember, updateMember, importMembers, listApplications, reviewApplication, listCategories, upsertCategory
- Routes: `/api/membership/...`

**Frontend:** `apps/memberry/src/features/membership/`
- Officer routes: roster, roster/$memberId, roster/import, applications, settings/membership-categories
- Components: member-table, member-detail, import-wizard, application-card, category-editor

### F4: Events (M08)

**Backend:** `services/api-ts/src/handlers/events/`
- Schema: `events` (title, type, description, start_at, end_at, location_type, location_details, cover_image, registration_enabled, fee, capacity, qr_enabled, visibility, status, org_id), `event_registrations` (event_id, person_id, status, payment_status), `event_attendance` (event_id, person_id, checked_in_at, method)
- Handlers: listEvents, getEvent, createEvent, updateEvent, cancelEvent, registerForEvent, listRegistrations, checkIn, listAttendance
- Routes: `/api/events/...`

**Frontend:** `apps/memberry/src/features/events/`
- Officer routes: events, events/new, events/$eventId, events/$eventId/attendance
- Member route: my/events
- Components: event-card, event-form, registration-table, attendance-scanner, qr-display

### F5: Training (M09)

**Backend:** `services/api-ts/src/handlers/training/`
- Schema: `trainings` (title, type, description, schedule fields, location, cover_image, credit_value, regulatory_approval, enrollment_mode, fee, capacity, visibility, status, org_id), `training_enrollments` (training_id, person_id, status, payment_status), `training_attendance` (training_id, person_id, completed_at, method, credits_awarded)
- Handlers: listTrainings, getTraining, createTraining, updateTraining, cancelTraining, enroll, listEnrollments, markAttendance, markComplete, listAttendance
- Routes: `/api/training/...`

**Frontend:** `apps/memberry/src/features/training/`
- Officer routes: training, training/new, training/$trainingId, training/$trainingId/attendance
- Member route: my/training
- Components: training-card, training-form, enrollment-table, attendance-scanner (reuse events), completion-table

### F6: Communications (M07)

**Backend:** `services/api-ts/src/handlers/communications/`
- Schema: `announcements` (title, content, audience_type, audience_categories, channels, visibility, status, scheduled_at, published_at, org_id, author_id), `announcement_stats` (announcement_id, recipients, inapp_views, push_delivered, email_sent, email_opened)
- Handlers: listAnnouncements, getAnnouncement, createAnnouncement, publishAnnouncement, scheduleAnnouncement, archiveAnnouncement, resendAnnouncement
- Routes: `/api/communications/...`

**Frontend:** `apps/memberry/src/features/communications/`
- Officer routes: communications, communications/new, communications/$announcementId
- Member route: my/notifications (notification inbox)
- Components: announcement-card, compose-form, delivery-stats, rich-text-editor

### F7: Documents & Certificates (M11)

**Backend:** `services/api-ts/src/handlers/certificates/`
- Schema: `certificates` (person_id, training_id, certificate_number, issued_at, org_id)
- Handlers: listCertificates, getCertificate, generateCertificatePDF
- Routes: `/api/certificates/...`

**Frontend:** `apps/memberry/src/features/certificates/`
- Member routes: my/certificates, my/certificates/$certificateId
- Components: certificate-card, certificate-preview

## Shared Components (built first)

| Component | Location | Used By |
|-----------|----------|---------|
| StatRow | `features/shared/components/stat-row.tsx` | Events, Training, Communications dashboards |
| AttendanceScanner | `features/shared/components/attendance-scanner.tsx` | Events check-in, Training attendance |
| QRDisplay | `features/shared/components/qr-display.tsx` | Member event/training QR |
| RichTextEditor | `features/shared/components/rich-text-editor.tsx` | Events, Training, Communications compose |
| DataTable (filterable) | `features/shared/components/data-table.tsx` | Roster, Registrations, Enrollments |
| ImportWizard | `features/membership/components/import-wizard.tsx` | Roster import |
| BulkActionBar | `features/shared/components/bulk-action-bar.tsx` | Roster, Applications |

## Implementation Strategy

Given 23 screens across 5 modules, execute in 5 sequential subagent rounds:

1. **Shared components + F3 schema/handlers** (foundation)
2. **F3 frontend** (roster, detail, import, applications, categories)
3. **F6 + F7** (lightweight modules, parallel)
4. **F4 Events** (full CRUD + attendance)
5. **F5 Training** (full CRUD + attendance + certificates)

Each round: backend first, frontend second, E2E tests last.

## Key Domain Rules

- **QR codes**: HMAC-signed, rotate every 60s (TOTP-like), 30s clock skew tolerance
- **Credit award**: automatic on attendance confirmation, locked after first confirmation
- **Certificate generation**: only after training date passed AND attendance confirmed (BR-20)
- **Certificate numbers**: CERT-YYYY-NNNNNN, unique per org per year
- **Attendance offline**: QR validation using cached HMAC secret, sync on reconnect
- **Rich text**: Tiptap editor, sanitized output (no scripts/iframes), max 5MB images
- **Event types**: 8 platform-defined (immutable): General Assembly, Induction, Fellowship, Medical Mission, Board Meeting, Committee Meeting, Fundraiser, Other
- **Training types**: 5 platform-defined (immutable): Seminar, Workshop, Convention, Online Course, Skills Training
- **Enrollment modes**: Open, Approval-required, Invitation-only (locked after first enrollment)
- **Communications channels**: In-app always on (no toggle), Push + Email toggleable
