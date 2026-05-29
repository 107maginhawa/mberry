import type { BaseContext } from '@/types/app';
import { eq, ilike, or, sql } from 'drizzle-orm';
import { MembershipRepository } from './repos/membership.repo';
import { DuesConfigRepository } from '../association:member/repos/dues.repo';
import { persons } from '../person/repos/person.schema';
import type { Session } from '@/types/auth';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
import { auditAction } from '@/utils/audit';
import { importMemberRowSchema, importMembersSchema, normalizeLicense, type ImportMemberRow } from './import-types';

// Re-export shared types/schemas for backward compatibility
export { importMemberRowSchema, importMembersSchema, normalizeLicense, type ImportMemberRow } from './import-types';

// Re-export CSV import utilities for unified API surface
export { parseCSV, previewCSVImport, bulkCSVImport, validateImportRows } from './csvImport';

// ─── Match Result Types ────────────────────────────────────

interface MatchedMember { personId: string; email?: string; licenseNumber?: string; }
interface CreatedMember { personId: string; email?: string; }
interface FlaggedMember {
  row: ImportMemberRow;
  reason: 'conflict' | 'name-mismatch';
  emailMatchPersonId?: string;
  licenseMatchPersonId?: string;
}

// ─── Handler ───────────────────────────────────────────────

export async function importMembers(ctx: BaseContext): Promise<Response> {
  // Position-restricted: PRESIDENT or SECRETARY only (BR-25)
  ctx.set('organizationId', ctx.req.param('organizationId'));
  const denied = await requirePosition(ctx, [POSITION_TITLES.PRESIDENT, POSITION_TITLES.SECRETARY]);
  if (denied) return denied;

  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('organizationId');
  const body = await ctx.req.json();

  const parsed = importMembersSchema.safeParse(body);
  if (!parsed.success) {
    return ctx.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  }

  const { members } = parsed.data;
  if (members.length === 0) {
    return ctx.json({ data: { matched: [], created: [], flagged: [], imported: 0 } }, 201);
  }

  const repo = new MembershipRepository(db);
  const now = new Date();
  const nextYear = new Date(new Date().setFullYear(now.getFullYear() + 1)).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  // [BR-02] Read grace period from org dues config
  const duesRepo = new DuesConfigRepository(db);
  const orgDuesConfigs = await duesRepo.findMany({ organizationId: orgId, status: 'active' });
  const orgGracePeriodDays = orgDuesConfigs[0]?.gracePeriodDays ?? 30;

  const matched: MatchedMember[] = [];
  const created: CreatedMember[] = [];
  const flagged: FlaggedMember[] = [];
  const toImport: any[] = [];

  for (const row of members) {
    let resolvedPersonId = row.personId;

    // If no personId, attempt matching by email/license
    if (!resolvedPersonId && (row.email || row.licenseNumber)) {
      const matchResult = await findPersonMatch(db, row);

      if (matchResult.type === 'conflict') {
        flagged.push({
          row,
          reason: 'conflict',
          emailMatchPersonId: matchResult.emailMatchId,
          licenseMatchPersonId: matchResult.licenseMatchId,
        });
        continue;
      }

      if (matchResult.type === 'name-mismatch') {
        flagged.push({ row, reason: 'name-mismatch', emailMatchPersonId: matchResult.personId });
        continue;
      }

      if (matchResult.type === 'matched') {
        resolvedPersonId = matchResult.personId;
        matched.push({ personId: resolvedPersonId!, email: row.email, licenseNumber: row.licenseNumber });
      }

      if (matchResult.type === 'none') {
        // Create new person
        const [newPerson] = await db.insert(persons).values({
          firstName: row.firstName ?? 'Unknown',
          lastName: row.lastName,
          contactInfo: row.email ? { email: row.email } : undefined,
          licenseNumber: row.licenseNumber,
          createdBy: session.user.id,
          updatedBy: session.user.id,
        }).returning();
        resolvedPersonId = newPerson!.id;
        created.push({ personId: resolvedPersonId!, email: row.email });
      }
    }

    if (!resolvedPersonId) {
      // No personId and no matching fields — skip
      flagged.push({ row, reason: 'conflict' });
      continue;
    }

    toImport.push({
      organizationId: orgId,
      personId: resolvedPersonId,
      tierId: row.tierId,
      categoryId: row.categoryId,
      memberNumber: row.memberNumber ?? row.licenseNumber,
      startDate: row.startDate ?? today,
      duesExpiryDate: row.duesExpiryDate ?? nextYear,
      gracePeriodDays: orgGracePeriodDays,
      status: 'active' as const,
      joinedAt: new Date(),
      createdBy: session.user.id,
      updatedBy: session.user.id,
    });
  }

  const imported = await repo.bulkImportMembers(toImport);

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'membership',
    resourceId: orgId ?? 'unknown',
    description: `Bulk member import: ${imported.length} imported, ${created.length} created, ${flagged.length} flagged`,
    eventSubType: 'membership.bulk-imported',
    details: {
      organizationId: orgId,
      imported: imported.length,
      matched: matched.length,
      created: created.length,
      flagged: flagged.length,
    },
  });

  return ctx.json({
    data: {
      matched,
      created,
      flagged,
      imported: imported.length,
    },
  }, 201);
}

// ─── Person Matching Logic (BR-22) ────────────────────────

type MatchResult =
  | { type: 'matched'; personId: string }
  | { type: 'conflict'; emailMatchId: string; licenseMatchId: string }
  | { type: 'name-mismatch'; personId: string }
  | { type: 'none' };

async function findPersonMatch(db: any, row: ImportMemberRow): Promise<MatchResult> {
  let emailMatch: any = null;
  let licenseMatch: any = null;

  if (row.email) {
    const results = await db
      .select({ id: persons.id, firstName: persons.firstName, lastName: persons.lastName })
      .from(persons)
      .where(sql`lower(${persons.contactInfo}->>'email') = ${row.email.toLowerCase()}`)
      .limit(1);
    emailMatch = results[0] ?? null;
  }

  if (row.licenseNumber) {
    const normalized = normalizeLicense(row.licenseNumber);
    const results = await db
      .select({ id: persons.id, firstName: persons.firstName, lastName: persons.lastName })
      .from(persons)
      .where(sql`regexp_replace(regexp_replace(lower(${persons.licenseNumber}), '[\\s-]', '', 'g'), '^0+', '') = ${normalized}`)
      .limit(1);
    licenseMatch = results[0] ?? null;
  }

  // Both match but different people → conflict
  if (emailMatch && licenseMatch && emailMatch.id !== licenseMatch.id) {
    return { type: 'conflict', emailMatchId: emailMatch.id, licenseMatchId: licenseMatch.id };
  }

  // Single or dual match to same person
  const matchedPerson = emailMatch ?? licenseMatch;
  if (matchedPerson) {
    // Check name mismatch
    if (row.firstName || row.lastName) {
      const firstNameDiffers = row.firstName && matchedPerson.firstName &&
        row.firstName.toLowerCase() !== matchedPerson.firstName.toLowerCase();
      const lastNameDiffers = row.lastName && matchedPerson.lastName &&
        row.lastName.toLowerCase() !== matchedPerson.lastName.toLowerCase();

      if (firstNameDiffers || lastNameDiffers) {
        return { type: 'name-mismatch', personId: matchedPerson.id };
      }
    }
    return { type: 'matched', personId: matchedPerson.id };
  }

  return { type: 'none' };
}
