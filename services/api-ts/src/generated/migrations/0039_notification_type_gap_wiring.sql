-- Slice 027: Add notification_type enum values for cross-cutting notification wiring
-- GAP-003: waitlist.promoted
-- GAP-006: event.late-cancellation
-- GAP-012: dunning.escalation
-- GAP-017: task.overdue

ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'waitlist.promoted';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'event.late-cancellation';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'dunning.escalation';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'task.overdue';
