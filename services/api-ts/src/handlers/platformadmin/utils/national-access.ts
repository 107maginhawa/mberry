import { ForbiddenError, ValidationError } from '@/core/errors';
import type { DashboardRepository } from '../repos/dashboard.repo';

export interface SessionUser {
  id?: string;
  role?: string;
}

export function isPlatformAdmin(user: SessionUser | undefined): boolean {
  // `role` is a comma-separated list (e.g. "admin,platform_admin,association:admin"),
  // so membership-test the segments rather than exact-equality — the seed super
  // admin carries a multi-role string and exact-equality wrongly 403'd them from
  // the national chapter drill-down + platform summary. Mirrors getNationalDashboard.ts.
  const userRoles = (user?.role ?? '').split(',').map((r) => r.trim());
  return userRoles.includes('platform_admin') || userRoles.includes('super');
}

/**
 * Resolve the association a national-dashboard request targets and enforce BR-36.
 * Platform admins must pass associationId explicitly. National officers may omit it
 * when they hold exactly one active grant; otherwise it is required.
 */
export async function resolveAssociationAccess(
  repo: DashboardRepository,
  user: SessionUser | undefined,
  requestedAssociationId: string | undefined,
): Promise<string> {
  if (isPlatformAdmin(user)) {
    if (!requestedAssociationId) {
      throw new ValidationError('associationId is required for platform admins');
    }
    return requestedAssociationId;
  }

  const memberId = user?.id;
  if (!memberId) throw new ForbiddenError('National dashboard access requires authentication');

  let associationId = requestedAssociationId;
  if (!associationId) {
    const grants = await repo.getOfficerAssociationIds(memberId);
    if (grants.length === 1) {
      associationId = grants[0];
    } else {
      throw new ValidationError('associationId is required');
    }
  }

  const isOfficer = await repo.isDesignatedNationalOfficer(memberId, associationId!);
  if (!isOfficer) {
    throw new ForbiddenError(
      'National dashboard access requires platform admin or designated national officer role',
    );
  }
  return associationId!;
}

const SMALL_CHAPTER_THRESHOLD = 5;

export function isSuppressed(totalMembers: number): boolean {
  return totalMembers < SMALL_CHAPTER_THRESHOLD;
}

export function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}
