/**
 * Derive a valid, short `user_type` for audit log entries from a Better-Auth
 * `user.role` value.
 *
 * Better-Auth (admin plugin) stores roles as a comma-joined string in
 * `user.role` — e.g. `"admin,platform_admin,association:admin,association:member,association:officer"`.
 * The `audit_log_entry.user_type` column is `varchar(20)` and semantically a
 * coarse actor class (`client | service_provider | admin | system`). Writing the
 * raw role list verbatim overflows the column ("value too long for type
 * character varying(20)") and fails the (best-effort) audit insert, which in
 * turn makes audit-presence contract assertions fail. Collapse the role list to
 * a single valid, short category instead.
 */
export type AuditUserType = 'client' | 'admin' | 'system';

export function deriveAuditUserType(role: string | null | undefined): AuditUserType {
  if (!role) return 'client';
  if (role === 'system') return 'system';
  const roles = role.split(',').map((r) => r.trim());
  if (roles.some((r) => r === 'admin' || r === 'platform_admin')) return 'admin';
  return 'client';
}
