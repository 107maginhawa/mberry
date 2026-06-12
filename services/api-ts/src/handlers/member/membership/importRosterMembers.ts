import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { ImportRosterMembersBody } from '@/generated/openapi/validators';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import type { NewMembership } from '@/handlers/association:member/repos/membership.schema';
import { requirePosition } from '@/core/auth/officer-checks';
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

  // FIX-016 / G-13: cap the batch size. A raw unbounded JSON-array insert is an
  // abuse/runaway vector; 500 rows matches the spec §16 import-size target.
  // Larger rosters are split into batches by the caller.
  const MAX_IMPORT_ROWS = 500;
  if (body.members.length > MAX_IMPORT_ROWS) {
    return ctx.json(
      {
        error: `Roster import exceeds the maximum of ${MAX_IMPORT_ROWS} rows per request (received ${body.members.length}). Split the file into smaller batches.`,
      },
      400,
    );
  }

  let imported = 0;
  let failed = 0;
  const errors: Array<{ index: number; error: string }> = [];
  const importedPersonIds: string[] = [];

  for (let i = 0; i < body.members.length; i++) {
    const row = body.members[i];

    // FIX-016 / G-13: validate each row before insert and report a structured
    // error, instead of relying on a raw DB failure message. Required fields
    // mirror the membership insert contract (personId + tierId).
    const rowErrors: string[] = [];
    if (!row?.personId) rowErrors.push('personId is required');
    if (!row?.tierId) rowErrors.push('tierId is required');
    if (rowErrors.length > 0) {
      failed++;
      errors.push({ index: i, error: rowErrors.join('; ') });
      continue;
    }

    try {
      const created = await repo.createOne({ ...row, organizationId: orgId } as NewMembership);
      imported++;
      if (created?.personId) importedPersonIds.push(created.personId);
    } catch (err) {
      failed++;
      errors.push({ index: i, error: err instanceof Error ? err.message : String(err) });
    }
  }

  ctx.set('auditResourceId', orgId);
  ctx.set('auditDescription', `Roster import: ${imported} imported, ${failed} failed`);

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