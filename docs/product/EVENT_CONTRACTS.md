# Event Contracts
Generated from job handler code and schema definitions. Source of truth for async behavior.

---

## 1. Overview

| Metric | Value |
|--------|-------|
| Total active jobs | 10 |
| Total event/status enums | 30+ |
| Job technology | **pg-boss** (PostgreSQL-backed job queue) |
| Scheduler abstraction | `JobScheduler` interface (`services/api-ts/src/core/jobs.ts`) |
| Default retry limit | 3 (configurable per job) |
| Retry backoff | Exponential (`retryBackoff: true`) |
| Job expiration | 5 minutes (`expireInMinutes`) |
| Completed job cleanup | `deleteAfterDays: 1`, archive after 300s |

### Job Registration Types

| Type | Method | pg-boss mapping |
|------|--------|-----------------|
| Cron | `scheduler.registerCron(name, pattern, handler)` | `boss.schedule()` with cron pattern |
| Interval (>= 1 min) | `scheduler.registerInterval(name, ms, handler)` | `boss.schedule()` at minute granularity |
| Interval (< 1 min) | `scheduler.registerInterval(name, ms, handler)` | `setInterval` (in-process timer) |
| Delayed | `scheduler.registerDelayed(name, ms, handler)` | One-shot delayed execution |

### JobContext (passed to every handler)

```typescript
interface JobContext {
  db: DatabaseInstance;
  logger: Logger;
  jobId: string;
  jobName: string;
  data?: any;
}
```

---

## 2. Job Contracts

### 2.1 `dues.reminderProcessor`

| Field | Value |
|-------|-------|
| **Queue name** | `dues.reminderProcessor` |
| **Module** | M06 (Dues & Payments) |
| **Schedule** | Cron: `0 0 * * *` (daily at midnight) |
| **Trigger** | Cron schedule |
| **Source file** | `handlers/dues/jobs/reminderProcessor.ts` |

**Payload schema:**
```typescript
// No external payload -- job queries DB directly
// Context passed to processor:
interface ReminderContext {
  db: DatabaseInstance;
  logger: any;
  createNotification?: (params: {
    organizationId: string;
    recipient: string;
    type: 'billing';
    channel: 'in-app' | 'email' | 'push';
    title: string;
    message: string;
  }) => Promise<{ id: string }>;
}

// Return type:
interface ReminderResult {
  processed: number;
  sent: number;
  skipped: number;
  errors: number;
}
```

**Processing logic:**
1. Fetch all `duesOrgConfigs`
2. For each config, fetch enabled `duesReminderSchedules`
3. For each schedule, find members whose membership expiry matches the `daysOffset`
4. Check `duesReminderLogs` for idempotency (skip already-sent)
5. Create notification via `notificationService`
6. Insert reminder log to prevent duplicates

**Error handling:** Per-record try/catch. One failure does not halt the batch. Errors counted in `result.errors`. pg-boss retries up to 3 times on unhandled throw.

---

### 2.2 `booking.slotGenerator`

| Field | Value |
|-------|-------|
| **Queue name** | `booking.slotGenerator` |
| **Module** | M08 (Events) / Booking subsystem |
| **Schedule** | Cron: `0 2 * * *` (daily at 2 AM) |
| **Trigger** | Cron schedule; can also be triggered manually via `scheduler.trigger()` |
| **Source file** | `handlers/booking/jobs/slotGenerator.ts` |

**Payload schema:**
```typescript
// No external payload -- uses standard JobContext
// Queries active BookingEvents from DB and generates TimeSlots
```

**Processing logic:**
1. Query all active `BookingEvent` records
2. For each event, calculate upcoming time slots based on recurrence rules
3. Insert new `TimeSlot` records with status `available`
4. Skip slots that already exist (idempotent)

**Error handling:** Errors logged and re-thrown. pg-boss retries up to 3 times with exponential backoff.

---

### 2.3 `booking.confirmationTimer`

| Field | Value |
|-------|-------|
| **Queue name** | `booking.confirmationTimer` |
| **Module** | M08 (Events) / Booking subsystem |
| **Schedule** | Interval: 60,000ms (every 1 minute) |
| **Trigger** | Interval timer; runs continuously |
| **Source file** | `handlers/booking/jobs/confirmationTimer.ts` |

**Payload schema:**
```typescript
// Extended context:
interface ExtendedJobContext extends JobContext {
  notificationService: NotificationService;
}

interface ConfirmationTimerConfig {
  confirmationWindowMinutes: number; // default: 15
  batchSize: number;                 // default: 50
  includeNotifications: boolean;     // default: true
}
```

**Processing logic:**
1. Calculate cutoff time (`now - 15 minutes`)
2. Query all `bookings` with status `pending` where `bookedAt < cutoffTime`
3. For each expired booking:
   a. Update booking status to `rejected`
   b. Release the associated `TimeSlot` (set back to `available`)
   c. Send notification to client (`booking_auto_rejected`, channels: in-app, email, sms, priority: high)
   d. Send notification to host (`booking_expired`, channels: in-app, email, priority: normal)

**Error handling:** Per-booking try/catch. Notification failures are caught separately and logged but do not prevent the booking status update. pg-boss retries up to 3 times.

---

### 2.4 `booking.slotCleanup`

| Field | Value |
|-------|-------|
| **Queue name** | `booking.slotCleanup` |
| **Module** | M08 (Events) / Booking subsystem |
| **Schedule** | Cron: `0 3 * * *` (daily at 3 AM) |
| **Trigger** | Cron schedule |
| **Source file** | `handlers/booking/jobs/slotCleanup.ts` |

**Payload schema:**
```typescript
interface SlotCleanupConfig {
  availableSlotRetentionDays: number;      // default: 7
  completedBookingArchiveDays: number;     // default: 90
  batchSize: number;                       // default: 1000
  vacuumDatabase: boolean;                 // default: true
}
```

**Processing logic:**
1. Delete available slots older than 7 days
2. Archive completed bookings older than 90 days
3. Clean up blocked slots that are past their date
4. Optionally run `VACUUM` on database for performance
5. Process in batches of 1000 records

**Error handling:** Errors logged and re-thrown. pg-boss retries up to 3 times with exponential backoff.

---

### 2.5 `person.deletionProcessor`

| Field | Value |
|-------|-------|
| **Queue name** | `person.deletionProcessor` |
| **Module** | M02 (Member Profile) |
| **Schedule** | Cron: `0 0 * * *` (daily at midnight) |
| **Trigger** | Cron schedule; processes accounts past their `deletionScheduledAt` date |
| **Source file** | `handlers/person/jobs/deletionProcessor.ts` |

**Payload schema:**
```typescript
interface DeletionContext {
  db: DatabaseInstance;
  logger: any;
  audit?: {
    logEvent: (args: any) => Promise<void>;
  };
}

interface DeletionResult {
  processed: number;
  succeeded: number;
  errors: number;
}
```

**Processing logic (DPA 2012 compliance):**
1. Query all `persons` where `deletionScheduledAt < now()` AND `deletionCompletedAt IS NULL`
2. For each person:
   a. Kill all active sessions (`schema.session`)
   b. Anonymize PII fields:
      - `firstName` / `lastName` -> `'DELETED'`
      - `contactInfo` -> `{ email: 'deleted@deleted.invalid' }`
      - Null out: `middleName`, `primaryAddress`, `avatar`, `licenseNumber`, `specialization`, `prcId`, `dateOfBirth`, `languagesSpoken`, `timezone`
   c. Set `deletionCompletedAt` timestamp
   d. Log audit event (if audit service provided)

**Error handling:** Per-record try/catch. One failure does not halt the batch. Idempotent via `deletionCompletedAt IS NULL` guard. Compliant with DPA-02, DPA-05, DPA-06.

---

### 2.6 `email.processor`

| Field | Value |
|-------|-------|
| **Queue name** | `email.processor` |
| **Module** | M07 (Communications) |
| **Schedule** | Interval: 30,000ms (every 30 seconds), override via `EMAIL_PROCESSOR_INTERVAL_MS` env var |
| **Trigger** | Interval timer; runs continuously |
| **Source file** | `handlers/email/jobs/processor.ts` |

**Payload schema:**
```typescript
// Thin adapter -- delegates to EmailService
// No custom payload; uses standard JobContext + injected EmailService
```

**Processing logic:**
1. Call `emailService.processPendingEmails()`
2. The email service handles dequeuing, sending, and status updates internally

**Error handling:** Errors logged with `jobId` context and re-thrown. pg-boss retries on failure. The scheduler can override interval for tests via env var.

---

### 2.7 `email.cleanup`

| Field | Value |
|-------|-------|
| **Queue name** | `email.cleanup` |
| **Module** | M07 (Communications) |
| **Schedule** | Cron: `0 4 * * *` (daily at 4 AM) |
| **Trigger** | Cron schedule |
| **Source file** | `handlers/email/jobs/index.ts` (inline handler) |

**Processing logic:**
1. Instantiate `EmailQueueRepository`
2. Call `queueRepo.cleanupOldEmails(30)` -- deletes emails older than 30 days

**Error handling:** Errors logged and re-thrown. pg-boss retries up to 3 times.

---

### 2.8 `audit.retention`

| Field | Value |
|-------|-------|
| **Queue name** | `audit.retention` |
| **Module** | Audit (cross-cutting) |
| **Schedule** | Cron: `0 3 * * *` (daily at 3 AM) |
| **Trigger** | Cron schedule |
| **Source file** | `handlers/audit/jobs/index.ts` |

**Processing logic:**
1. Instantiate `AuditRepository`
2. Archive audit logs older than 365 days (1 year)
3. Purge archived logs older than 2,555 days (7 years, HIPAA compliance)

**Error handling:** Errors logged and re-thrown. pg-boss retries up to 3 times.

---

### 2.9 `notifs.processScheduled`

| Field | Value |
|-------|-------|
| **Queue name** | `notifs.processScheduled` |
| **Module** | Notifications (cross-cutting) |
| **Schedule** | Cron: `*/5 * * * *` (every 5 minutes) |
| **Trigger** | Cron schedule |
| **Source file** | `handlers/notifs/jobs/index.ts` |

**Processing logic:**
1. Delegates to `notifsService.processScheduledNotifications()`
2. Processes queued notifications that have reached their scheduled send time

**Error handling:** Delegates to NotificationService error handling. pg-boss retries up to 3 times.

---

### 2.10 `notifs.cleanup`

| Field | Value |
|-------|-------|
| **Queue name** | `notifs.cleanup` |
| **Module** | Notifications (cross-cutting) |
| **Schedule** | Cron: `0 0 * * *` (daily at midnight) |
| **Trigger** | Cron schedule |
| **Source file** | `handlers/notifs/jobs/index.ts` |

**Processing logic:**
1. Delegates to `notifsService.cleanupExpiredNotifications(90)`
2. Removes notifications older than 90 days

**Error handling:** Delegates to NotificationService error handling. pg-boss retries up to 3 times.

---

### Disabled/Optional Jobs (commented out in code)

| Job | Location | Description |
|-----|----------|-------------|
| `booking.reminderSender` | `handlers/booking/jobs/index.ts` | Send booking reminders every 15 min |
| `booking.noShowEligibility` | `handlers/booking/jobs/index.ts` | Mark no-show eligible bookings every 1 min |

---

## 3. Event Enums

### Booking Module (`handlers/booking/repos/booking.schema.ts`)

| Enum | DB name | Values |
|------|---------|--------|
| `bookingStatusEnum` | `booking_status` | `pending`, `confirmed`, `rejected`, `cancelled`, `completed`, `no_show_client`, `no_show_host` |
| `slotStatusEnum` | `slot_status` | `available`, `booked`, `blocked` |
| `bookingEventStatusEnum` | `booking_event_status` | `draft`, `active`, `paused`, `archived` |
| `locationTypeEnum` | `location_type` | `video`, `phone`, `in-person` |
| `recurrenceTypeEnum` | `recurrence_type` | `daily`, `weekly`, `monthly`, `yearly` |

### Events Module (`handlers/association:operations/repos/events.schema.ts`)

| Enum | DB name | Values |
|------|---------|--------|
| `eventStatusEnum` | `event_status` | `draft`, `published`, `cancelled`, `completed` |
| `registrationStatusEnum` | `registration_status` | `confirmed`, `waitlisted`, `cancelled`, `refunded`, `noShow` |
| `checkInMethodEnum` | `check_in_method` | `qr`, `manual` |
| `eventVisibilityEnum` | `event_visibility` | `internal`, `network` |
| `eventTypeEnum` | `event_type` | `generalAssembly`, `inductionCeremony`, `fellowship`, `medicalMission`, `boardMeeting`, `committeeMeeting`, `fundraiser`, `other` |

### Dues Module (`handlers/association:member/repos/dues.schema.ts`)

| Enum | DB name | Values |
|------|---------|--------|
| `duesConfigStatusEnum` | `dues_config_status` | `active`, `retired` |
| `duesInvoiceStatusEnum` | `dues_invoice_status` | `generated`, `sent`, `paid`, `overdue`, `cancelled`, `writtenOff` |

### Dunning Module (`handlers/association:member/repos/dunning.schema.ts`)

| Enum | DB name | Values |
|------|---------|--------|
| `dunningChannelEnum` | `dunning_channel` | `email`, `sms`, `letter` |
| `dunningTemplateStatusEnum` | `dunning_template_status` | `active`, `inactive` |
| `dunningDeliveryStatusEnum` | `dunning_delivery_status` | `pending`, `sent`, `delivered`, `failed` |

### Notification Module (`handlers/notifs/repos/notification.schema.ts`)

| Enum | DB name | Values |
|------|---------|--------|
| `notificationTypeEnum` | `notification_type` | `billing`, `security`, `system`, `booking.created`, `booking.confirmed`, `booking.rejected`, `booking.cancelled`, `booking.no-show-client`, `booking.no-show-host` |
| `notificationChannelEnum` | `notification_channel` | `email`, `push`, `in-app` |
| `notificationStatusEnum` | `notification_status` | `queued`, `sent`, `delivered`, `read`, `failed`, `expired` |

### Audit Module (`handlers/audit/repos/audit.schema.ts`)

| Enum | DB name | Values |
|------|---------|--------|
| `auditEventTypeEnum` | `audit_event_type` | `authentication`, `data-access`, `data-modification`, `data-deletion`, `system-config`, `security`, `compliance` |
| `auditCategoryEnum` | `audit_category` | `hipaa`, `security`, `privacy`, `administrative`, `clinical`, `financial`, `association` |
| `auditActionEnum` | `audit_action` | `create`, `read`, ... (additional values in schema) |

### Person Module (`handlers/person/repos/person.schema.ts`)

| Enum | DB name | Values |
|------|---------|--------|
| `genderEnum` | `gender` | `male`, `female`, `non-binary`, `other`, `prefer-not-to-say` |

### Credentials Module (`handlers/association:member/repos/credentials.schema.ts`)

| Enum | DB name | Values |
|------|---------|--------|
| `licenseStatusEnum` | `license_status` | *(see schema file)* |
| `renewalAlertStatusEnum` | `renewal_alert_status` | *(see schema file)* |
| `credentialTypeEnum` | `credential_type` | *(see schema file)* |
| `credentialTemplateStatusEnum` | `credential_template_status` | *(see schema file)* |
| `credentialStatusEnum` | `credential_status` | *(see schema file)* |

### Credits Module (`handlers/association:member/repos/credits.schema.ts`)

| Enum | DB name | Values |
|------|---------|--------|
| `creditEntryTypeEnum` | `credit_entry_type` | *(see schema file)* |
| `cpdCategoryEnum` | `credit_cpd_category` | `General`, `Major`, `Self-Directed` |
| `verificationStatusEnum` | `credit_verification_status` | `pending`, `verified`, `rejected` |

### Chapters Module (`handlers/association:member/repos/chapters.schema.ts`)

| Enum | DB name | Values |
|------|---------|--------|
| `affiliationStatusEnum` | `affiliation_status` | *(see schema file)* |
| `transferStatusEnum` | `transfer_status` | *(see schema file)* |

### Directory Module (`handlers/association:member/repos/directory.schema.ts`)

| Enum | DB name | Values |
|------|---------|--------|
| `directoryVisibilityEnum` | `directory_visibility` | *(see schema file)* |

### Platform Admin Module (`handlers/platformadmin/repos/platform-admin.schema.ts`)

| Enum | DB name | Values |
|------|---------|--------|
| `orgLifecycleStatusEnum` | `org_lifecycle_status` | *(see schema file)* |

---

## 4. Async Flow Maps

### Flow 1: When a dues payment is recorded

```
[Dues payment recorded]
    |
    v
[duesInvoiceStatus -> 'paid']
    |
    v
(No immediate job fires -- reminder processor runs on schedule)
    |
    v
[dues.reminderProcessor] (daily at midnight)
    |-- Checks all org configs and reminder schedules
    |-- Finds members whose expiry date matches offset
    |-- Skips members already reminded (idempotency via duesReminderLogs)
    |-- Creates notification via notificationService
    |
    v
[notifs.processScheduled] (every 5 min)
    |-- Delivers queued notifications
    |
    v
[email.processor] (every 30s)
    |-- Sends email notifications from queue
```

### Flow 2: When a booking event is created

```
[BookingEvent created with status 'active']
    |
    v
[booking.slotGenerator] (daily at 2 AM)
    |-- Scans all active BookingEvents
    |-- Generates TimeSlot records based on recurrence rules
    |-- Slots created with status 'available'
    |
    v
[Client books a slot]
    |-- Booking created with status 'pending'
    |-- TimeSlot status -> 'booked'
    |
    v
[booking.confirmationTimer] (every 1 min)
    |-- Checks for pending bookings older than 15 minutes
    |-- If host hasn't confirmed:
    |   |-- Booking status -> 'rejected'
    |   |-- TimeSlot status -> 'available' (released)
    |   |-- Notification to client (booking_auto_rejected)
    |   |-- Notification to host (booking_expired)
    |
    v
[booking.slotCleanup] (daily at 3 AM)
    |-- Archives available slots older than 7 days
    |-- Archives completed bookings older than 90 days
    |-- VACUUM database
```

### Flow 3: When a member deletes their account

```
[Member requests account deletion]
    |
    v
[persons.deletionScheduledAt = now() + 30 days (grace period)]
    |
    v
(30-day grace period -- member can cancel)
    |
    v
[person.deletionProcessor] (daily at midnight)
    |-- Finds persons where deletionScheduledAt < now() AND deletionCompletedAt IS NULL
    |-- For each person:
    |   |-- Kill all active sessions
    |   |-- Anonymize PII (name -> 'DELETED', email -> 'deleted@deleted.invalid')
    |   |-- Null out: address, avatar, license, specialization, DOB, etc.
    |   |-- Set deletionCompletedAt = now()
    |   |-- Log audit event
    |
    v
[audit.retention] (daily at 3 AM, long-term)
    |-- Archives audit logs after 1 year
    |-- Purges after 7 years (HIPAA)
```

### Flow 4: When an email is queued

```
[Any module queues an email]
    |
    v
[Email inserted into queue table with status 'pending']
    |
    v
[email.processor] (every 30s)
    |-- Calls emailService.processPendingEmails()
    |-- Dequeues pending emails
    |-- Sends via configured SMTP/provider
    |-- Updates status on success/failure
    |
    v
[email.cleanup] (daily at 4 AM)
    |-- Deletes emails older than 30 days from queue
```

### Flow 5: Notification lifecycle

```
[Any module creates a notification]
    |
    v
[Notification inserted with status 'queued']
    |
    v
[notifs.processScheduled] (every 5 min)
    |-- Processes scheduled notifications that are ready
    |-- Delivers via channels: email, push, in-app
    |-- Updates status: queued -> sent -> delivered -> read
    |
    v
[notifs.cleanup] (daily at midnight)
    |-- Removes notifications older than 90 days
```

---

## 5. Module Mapping

| Job Queue Name | Module | Module Code | Handler Directory |
|----------------|--------|-------------|-------------------|
| `dues.reminderProcessor` | Dues & Payments | M06 | `handlers/dues/jobs/` |
| `booking.slotGenerator` | Events / Booking | M08 | `handlers/booking/jobs/` |
| `booking.confirmationTimer` | Events / Booking | M08 | `handlers/booking/jobs/` |
| `booking.slotCleanup` | Events / Booking | M08 | `handlers/booking/jobs/` |
| `person.deletionProcessor` | Member Profile | M02 | `handlers/person/jobs/` |
| `email.processor` | Communications | M07 | `handlers/email/jobs/` |
| `email.cleanup` | Communications | M07 | `handlers/email/jobs/` |
| `audit.retention` | Audit (cross-cutting) | -- | `handlers/audit/jobs/` |
| `notifs.processScheduled` | Notifications (cross-cutting) | -- | `handlers/notifs/jobs/` |
| `notifs.cleanup` | Notifications (cross-cutting) | -- | `handlers/notifs/jobs/` |

### Modules with no active jobs

| Module | Notes |
|--------|-------|
| M01 Auth & Onboarding | No background jobs |
| M03 Platform Admin | No background jobs |
| M04 Org Admin | No background jobs |
| M05 Membership | No background jobs |
| M09 Training | No background jobs |
| M10 Credit Tracking | No background jobs |
| M11 Documents & Credentials | No background jobs |
| M12 Elections & Governance | No background jobs |
| M13 Professional Feed | No background jobs |
| M14 National Dashboard | No background jobs |
| M15 Job Board | No background jobs |
| M16 Advertising | No background jobs |
| M17 Marketplace | No background jobs |
| M18 Surveys & Polls | No background jobs |
| M19 Committee Management | No background jobs |

---

## 6. Job Schedule Summary (Cron/Interval Reference)

| Time | Jobs |
|------|------|
| Every 30 seconds | `email.processor` |
| Every 1 minute | `booking.confirmationTimer` |
| Every 5 minutes | `notifs.processScheduled` |
| Midnight (0:00) | `dues.reminderProcessor`, `person.deletionProcessor`, `notifs.cleanup` |
| 2:00 AM | `booking.slotGenerator` |
| 3:00 AM | `booking.slotCleanup`, `audit.retention` |
| 4:00 AM | `email.cleanup` |

---

## 7. Error Handling Summary

All jobs share a common error handling pattern via pg-boss:

| Parameter | Default | Notes |
|-----------|---------|-------|
| `retryLimit` | 3 | Configurable per job via `CronJobConfig.retryLimit` |
| `retryBackoff` | `true` | Exponential backoff between retries |
| `retryDelay` | 5 seconds | Base delay before exponential calculation |
| `expireInMinutes` | 5 | Job expires if not completed in time |
| `deleteAfterDays` | 1 | Completed jobs cleaned up after 1 day |
| Dead Letter Queue | pg-boss built-in | Failed jobs after all retries are archived by pg-boss |

**Per-record isolation:** Jobs processing batches (`dues.reminderProcessor`, `person.deletionProcessor`, `booking.confirmationTimer`) use per-record try/catch to prevent one failure from halting the entire batch.
