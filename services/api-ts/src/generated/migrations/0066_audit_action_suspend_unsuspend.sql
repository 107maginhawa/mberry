-- 0066: Additive audit_action enum values for the new membership suspend ops.
--
-- AHA membership-lifecycle E2 / FIX-009: suspendMembership + unsuspendMembership
-- declare `x-audit` actions 'suspend' / 'unsuspend'. The audit_action pgEnum is a
-- closed set, so the values must be added before those events can be persisted.
-- Hand-written + additive (mirrors the 'approve'/'deny'/'renew' adds in 0003); a
-- one-time migration, so no IF NOT EXISTS guard is required.

ALTER TYPE "public"."audit_action" ADD VALUE 'suspend';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'unsuspend';
