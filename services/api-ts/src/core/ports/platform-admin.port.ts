/**
 * PlatformAdminPort + ImpersonationPort — minimal slices of platform-admin
 * behavior consumed by core/middleware.
 *
 * Resolves S-C4-014 (audit IC-01) for:
 *   - middleware/platform-admin-auth.ts (PlatformAdminRepository.findByUserId)
 *   - middleware/impersonation-guard.ts (ImpersonationSessionRepository.findByToken)
 *   - middleware/org-context.ts (raw select on platform_admins; folded into port)
 */

/**
 * The middleware itself only needs `id` and `role`, but downstream handlers
 * pull `email`, `name`, etc. via `ctx.get('platformAdmin')`. Until those
 * handlers move to their own injected lookup, the port returns the full
 * record (typed as `Record<string, unknown>` plus the fields middleware
 * inspects). This keeps the boundary explicit while preserving the
 * existing ctx contract.
 */
export interface PlatformAdminRecord extends Record<string, unknown> {
  id: string;
  userId: string;
  role: string;
}

export interface PlatformAdminPort {
  findByUserId(userId: string): Promise<PlatformAdminRecord | undefined>;
}

export interface ImpersonationSessionRecord {
  id: string;
  adminId: string;
  targetUserId: string;
  /** Nullable: cross-org impersonation may not bind to a specific org. */
  targetOrgId: string | null;
  sessionToken: string;
  endedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface ImpersonationPort {
  findByToken(token: string): Promise<ImpersonationSessionRecord | undefined>;
}
