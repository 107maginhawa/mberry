import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';

/**
 * Returns true when `personId` has any membership record (any status) in
 * `organizationId`. Used as a tenant-boundary guard on routes that live
 * outside the /org/:orgSlug tree (e.g. /my/surveys/*) where x-org-id is
 * absent and organizationId comes from the survey itself.
 */
export async function personBelongsToOrg(
  db: DatabaseInstance,
  logger: Logger | null | undefined,
  personId: string,
  organizationId: string,
): Promise<boolean> {
  const repo = new MembershipRepository(db, logger);
  const record = await repo.findByPersonAndOrg(personId, organizationId);
  return record !== null;
}
