/**
 * CSV Bulk Import for Members
 *
 * Slice 013: Stabilize bulk CSV import with per-row validation,
 * cross-org matching, conflict flagging, and batch performance.
 *
 * Requirements: BR-22 (matching), M5-R3/M5-R8 (row-independent validation),
 * AC-M01-002 (preview), AC-M05-003 (performance), AC-M05-004 (license normalization),
 * GAP-002 (conflict resolution).
 */

import type { Context } from 'hono';
import { sql } from 'drizzle-orm';
import { MembershipRepository } from './repos/membership.repo';
import { DuesConfigRepository } from '../association:member/repos/dues.repo';
import { persons } from '../person/repos/person.schema';
import { importMemberRowSchema, normalizeLicense, type ImportMemberRow } from './import-types';
import type { Session } from '@/types/auth';

// ─── Constants ───────────────────────────────────────────

export const IMPORT_BATCH_SIZE = 100;

// ─── CSV Parsing ─────────────────────────────────────────

export function parseCSV(csvText: string): Record<string, string>[] {
  if (!csvText || !csvText.trim()) return [];

  // Normalize line endings and strip BOM
  const text = csvText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').filter(line => line.trim() !== '');

  if (lines.length < 1) return [];

  const headers = lines[0]!.split(',').map(h => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]!.split(',').map(v => v.trim());
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      if (key) row[key] = values[j] ?? '';
    }
    rows.push(row);
  }

  return rows;
}

// ─── Row Validation (M5-R3, M5-R8) ──────────────────────

export interface RowValidationError {
  rowNumber: number;
  issues: { field: string; message: string }[];
  rawRow: Record<string, string>;
}

export interface ValidatedRow extends ImportMemberRow {
  _normalizedLicense?: string;
}

export interface ValidationResult {
  valid: ValidatedRow[];
  errors: RowValidationError[];
}

export function validateImportRows(rows: Record<string, string>[]): ValidationResult {
  const valid: ValidatedRow[] = [];
  const errors: RowValidationError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]!;
    const issues: { field: string; message: string }[] = [];

    // Check identifier requirement: must have personId, email, or licenseNumber
    const hasIdentifier = !!(raw['personId'] || raw['email'] || raw['licenseNumber']);
    if (!hasIdentifier) {
      issues.push({
        field: 'identifier',
        message: 'Row must have at least one identifier (personId, email, or licenseNumber)',
      });
    }

    // Zod validation for field-level checks
    const parsed = importMemberRowSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path.join('.') || 'unknown';
        // Don't duplicate identifier error
        if (!issues.some(i => i.field === field)) {
          issues.push({ field, message: issue.message });
        }
      }
    }

    if (issues.length > 0) {
      errors.push({ rowNumber: i + 1, issues, rawRow: raw as Record<string, string> });
    } else {
      const validated: ValidatedRow = parsed.data as ValidatedRow;
      // Trim license and store normalized form
      if (validated.licenseNumber) {
        validated.licenseNumber = validated.licenseNumber.trim();
        validated._normalizedLicense = normalizeLicense(validated.licenseNumber);
      }
      valid.push(validated);
    }
  }

  return { valid, errors };
}

// ─── Preview Endpoint (AC-M01-002) ───────────────────────

export async function previewCSVImport(ctx: Context): Promise<Response> {
  const body = await ctx.req.json();
  const csvData = body.csvData as string;

  if (!csvData || !csvData.trim()) {
    return ctx.json({ error: 'CSV data is required' }, 400);
  }

  const rows = parseCSV(csvData);
  const result = validateImportRows(rows);

  return ctx.json({
    data: {
      totalRows: rows.length,
      validRows: result.valid.length,
      errorRows: result.errors.length,
      preview: result.valid.map(r => ({
        email: r.email,
        firstName: r.firstName,
        lastName: r.lastName,
        licenseNumber: r.licenseNumber,
        tierId: r.tierId,
      })),
      errors: result.errors.map(e => ({
        rowNumber: e.rowNumber,
        issues: e.issues,
      })),
    },
  }, 200);
}

// ─── Bulk CSV Import Endpoint (BR-22, M5-R3, AC-M05-003) ──

interface FlaggedMember {
  row: ImportMemberRow;
  reason: 'conflict' | 'name-mismatch';
  emailMatchPersonId?: string;
  licenseMatchPersonId?: string;
}

interface MatchedMember { personId: string; email?: string; licenseNumber?: string; }
interface CreatedMember { personId: string; email?: string; }

export async function bulkCSVImport(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const audit = ctx.get('audit');
  const orgId = ctx.req.param('organizationId');
  const body = await ctx.req.json();
  const csvData = body.csvData as string;

  if (!csvData || !csvData.trim()) {
    return ctx.json({ error: 'CSV data is required' }, 400);
  }

  const rows = parseCSV(csvData);
  const { valid, errors } = validateImportRows(rows);

  const repo = new MembershipRepository(db);
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const nextYear = new Date(new Date().setFullYear(now.getFullYear() + 1)).toISOString().split('T')[0];

  // [BR-02] Read grace period from org dues config
  const duesRepo = new DuesConfigRepository(db);
  const orgDuesConfigs = await duesRepo.findMany({ organizationId: orgId, status: 'active' });
  const orgGracePeriodDays = orgDuesConfigs[0]?.gracePeriodDays ?? 30;

  const matched: MatchedMember[] = [];
  const created: CreatedMember[] = [];
  const flagged: FlaggedMember[] = [];
  const toImport: any[] = [];

  // Process each valid row through matching
  for (const row of valid) {
    let resolvedPersonId = row.personId;

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

  // Batch import for performance (AC-M05-003)
  let totalImported = 0;
  for (let i = 0; i < toImport.length; i += IMPORT_BATCH_SIZE) {
    const batch = toImport.slice(i, i + IMPORT_BATCH_SIZE);
    const imported = await repo.bulkImportMembers(batch);
    totalImported += imported.length;
  }

  // Log import event
  if (audit) {
    audit.log({
      action: 'bulk_csv_import',
      userId: session.user.id,
      organizationId: orgId,
      totalRows: rows.length,
      validRows: valid.length,
      errorRows: errors.length,
      imported: totalImported,
      matched: matched.length,
      created: created.length,
      flagged: flagged.length,
    });
  }

  return ctx.json({
    data: {
      matched,
      created,
      flagged,
      imported: totalImported,
      errors: errors.map(e => ({
        rowNumber: e.rowNumber,
        issues: e.issues,
      })),
    },
  }, 201);
}

// ─── Person Matching Logic (BR-22) ──────────────────────

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

  if (emailMatch && licenseMatch && emailMatch.id !== licenseMatch.id) {
    return { type: 'conflict', emailMatchId: emailMatch.id, licenseMatchId: licenseMatch.id };
  }

  const matchedPerson = emailMatch ?? licenseMatch;
  if (matchedPerson) {
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
