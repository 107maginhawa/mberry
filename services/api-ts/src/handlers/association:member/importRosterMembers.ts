import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { ImportRosterMembersBody } from '@/generated/openapi/validators';
import { MembershipRepository } from './repos/membership.repo';
import type { NewMembership } from './repos/membership.schema';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
import { domainEvents } from '@/core/domain-events';

/**
 * importRosterMembers
 *
 * Path: POST /association/member/roster/import
 * OperationId: importRosterMembers
 */
export async function importRosterMembers(
  ctx: ValidatedContext<ImportRosterMembersBody, never, never>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.SECRETARY, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const body = ctx.req.valid('json');
  const orgId = ctx.get('organizationId') as string;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MembershipRepository(db, logger);

  let imported = 0;
  let failed = 0;
  const errors: Array<{ index: number; error: string }> = [];
  const importedPersonIds: string[] = [];

  for (let i = 0; i < body.members.length; i++) {
    try {
      const created = await repo.createOne({ ...body.members[i], organizationId: orgId } as NewMembership);
      imported++;
      if (created?.personId) importedPersonIds.push(created.personId);
    } catch (err) {
      failed++;
      errors.push({ index: i, error: err instanceof Error ? err.message : String(err) });
    }
  }

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'roster-import',
    resourceId: orgId,
    description: `Roster import: ${imported} imported, ${failed} failed`,
  });

  // Cross-module visibility: imported members need welcome/onboarding follow-up.
  if (imported > 0) {
    domainEvents.emit('membership.imported', {
      organizationId: orgId,
      importedBy: session.user.id,
      importedCount: imported,
      personIds: importedPersonIds,
    }).catch(() => {});
  }

  return ctx.json({ imported, failed, errors }, 200);
}