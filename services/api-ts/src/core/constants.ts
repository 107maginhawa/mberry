/**
 * Core constants for the Monobase API
 */

/**
 * System User ID - A special UUID used for system-generated entries
 * This is used when the system creates or updates records automatically
 * (e.g., scheduled jobs, automated notifications, etc.)
 */
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * System User Identifier for display purposes
 */
export const SYSTEM_USER_NAME = 'System';

/**
 * System Organization ID - A special UUID used for audit entries
 * that occur outside org context (e.g., authentication, system events).
 * The audit_log_entry.organization_id column is NOT NULL, so all entries
 * must have a value. System-level events use this sentinel.
 */
export const SYSTEM_ORG_ID = '00000000-0000-0000-0000-000000000001';