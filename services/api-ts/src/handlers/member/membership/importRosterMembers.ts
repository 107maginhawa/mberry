import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { ImportRosterMembersBody } from '@/generated/openapi/validators';
import {
  MembershipRepository,
  MembershipTierRepository,
} from '@/handlers/association:member/repos/membership.repo';
import type { NewMembership } from '@/handlers/association:member/repos/membership.schema';
import { PersonRepository } from '@/handlers/person/repos/person.repo';
import type { NewPerson } from '@/handlers/person/repos/person.schema';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';
import { domainEvents } from '@/core/domain-events';

/**
 * importRosterMembers
 *
 * Path: POST /association/member/roster/import
 * OperationId: importRosterMembers
 *
 * Match-or-create roster import. For each row: match a person globally by email
 * or license number; create a PII-only person if none exists; then create a
 * membership for this org, skipping anyone already a member.
 *
 * ponytail: imported people are PII-only records with no auth/login account.
 * Linking such a record when the person later signs up (ensurePersonForUser
 * keys by user.id) is a separate account-claiming feature, deliberately out of
 * scope for D1.
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

  const membershipRepo = new MembershipRepository(db, logger);
  const tierRepo = new MembershipTierRepository(db, logger);
  const personRepo = new PersonRepository(db, logger);

  // FIX-016 / G-13: cap the batch size — an unbounded array insert is an
  // abuse/runaway vector. 500 rows matches the spec §16 import-size target.
  const MAX_IMPORT_ROWS = 500;
  if (body.members.length > MAX_IMPORT_ROWS) {
    return ctx.json(
      {
        error: `Roster import exceeds the maximum of ${MAX_IMPORT_ROWS} rows per request (received ${body.members.length}). Split the file into smaller batches.`,
      },
      400,
    );
  }

  // Tier is required and must belong to this org. Validate once up front so a
  // bad tier fails the whole request clearly instead of 500-ing on every row.
  if (!body.tierId) {
    return ctx.json({ error: 'tierId is required' }, 400);
  }
  const tier = await tierRepo.findOneById(body.tierId);
  if (!tier || tier.organizationId !== orgId) {
    return ctx.json({ error: `Tier ${body.tierId} not found for this organization` }, 400);
  }

  // Membership start date defaults to today (no payment data in a CSV; status
  // falls back to the DB default 'pendingPayment').
  const today = new Date().toISOString().slice(0, 10); // plainDate YYYY-MM-DD

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ index: number; error: string }> = [];
  const importedPersonIds: string[] = [];

  for (let i = 0; i < body.members.length; i++) {
    const row = body.members[i];
    try {
      const email = row?.email?.trim() || undefined;
      const licenseNumber = row?.licenseNumber?.trim() || undefined;
      const firstName = row?.firstName?.trim() || undefined;

      if (!email && !licenseNumber) {
        failed++;
        errors.push({ index: i, error: 'email or licenseNumber is required to match or create a member' });
        continue;
      }

      // Match an existing person globally (person is cross-org PII).
      let person = await personRepo.findByEmailOrLicense(email, licenseNumber);

      // No match → create a PII-only record (no auth user).
      if (!person) {
        if (!firstName) {
          failed++;
          errors.push({ index: i, error: 'firstName is required to create a new member' });
          continue;
        }
        person = await personRepo.createOne({
          firstName,
          lastName: row?.lastName?.trim() || null,
          contactInfo: email ? { email } : null,
          licenseNumber: licenseNumber ?? null,
          createdBy: session.user.id,
        } as NewPerson);
      }

      // Dedup via explicit pre-check (not by catching the (org,person) unique
      // violation) so an existing member is a clean "skipped", not a "failed".
      const existing = await membershipRepo.findByPersonAndOrg(person.id, orgId);
      if (existing) {
        skipped++;
        continue;
      }

      await membershipRepo.createOne({
        organizationId: orgId,
        personId: person.id,
        tierId: body.tierId,
        startDate: today,
        memberNumber: row?.memberNumber?.trim() || null,
        createdBy: session.user.id,
      } as NewMembership);

      imported++;
      importedPersonIds.push(person.id);
    } catch (err) {
      failed++;
      errors.push({ index: i, error: err instanceof Error ? err.message : String(err) });
    }
  }

  ctx.set('auditResourceId', orgId);
  ctx.set('auditDescription', `Roster import: ${imported} imported, ${skipped} skipped, ${failed} failed`);

  // Cross-module visibility: imported members need welcome/onboarding follow-up.
  if (imported > 0) {
    domainEvents.emit('membership.imported', {
      organizationId: orgId,
      importedBy: session.user.id,
      importedCount: imported,
      personIds: importedPersonIds,
    }).catch(() => {});
  }

  return ctx.json({ imported, skipped, failed, errors }, 200);
}
