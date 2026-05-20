import type { BaseContext } from '@/types/app';
import { z } from 'zod';
import { eq, ilike, or, sql } from 'drizzle-orm';
import { MembershipRepository } from './repos/membership.repo';
import { persons } from '../person/repos/person.schema';
import type { Session } from '@/types/auth';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

// Re-export CSV import utilities for unified API surface
export { parseCSV, previewCSVImport, bulkCSVImport, validateImportRows } from './csvImport';

// ─── Zod Validation Schema (V-08) ─────────────────────────

export const importMemberRowSchema = z.object({
  personId: z.string().min(1).optional(),
  email: z.string().email().optional(),
  licenseNumber: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  tierId: z.string().min(1),
  categoryId: z.string().min(1).optional(),
  memberNumber: z.string().optional(),
  startDate: z.string().optional(),
  duesExpiryDate: z.string().optional(),
});

export const importMembersSchema = z.object({
  members: z.array(importMemberRowSchema).min(0),
});

export type ImportMemberRow = z.infer<typeof importMemberRowSchema>;

// ─── License Normalization (BR-23) ─────────────────────────

export function normalizeLicense(license: string): string {
  return license.toLowerCase().replace(/[\s-]/g, '').replace(/^0+/, '');
}

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
      gracePeriodDays: 30,
      status: 'active' as const,
      joinedAt: new Date(),
      createdBy: session.user.id,
      updatedBy: session.user.id,
    });
  }

  const imported = await repo.bulkImportMembers(toImport);

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
