import { randomUUID } from 'crypto';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError, ValidationError } from '@/core/errors';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { InviteRepository } from './repos/invite.repo';
import { generateInviteToken, defaultExpiryDate } from './utils/token';
import type { BulkImportMembersBody } from '@/generated/openapi/validators';
import { getInviteTokenSecret } from '@/core/config';

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

interface ParsedRow {
  row: number;
  email?: string;
  name?: string;
  licenseNumber?: string;
  status: 'valid' | 'invalid' | 'duplicate';
  reason?: string;
}

/**
 * Minimal RFC-4180-ish CSV parser. Handles double-quoted fields with
 * embedded commas and escaped quotes (""). Good enough for member import.
 */
function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && content[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      field = '';
      row = [];
    } else {
      field += ch;
    }
  }
  // Trailing field/row (no terminating newline)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * bulkImportMembers
 *
 * Path: POST /invitations/bulk-import
 *
 * Parses CSV member data (columns: email, name, licenseNumber), validates
 * each row, and flags duplicates (within the CSV and against existing pending
 * invitations). In preview mode nothing is persisted; in import mode an
 * HMAC-signed claim invitation is created for each valid, non-duplicate row.
 */
export async function bulkImportMembers(
  ctx: ValidatedContext<BulkImportMembersBody, never, never>,
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError();

  const { orgId, csvContent, mode = 'preview' } = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const officerRepo = new OfficerTermRepository(db);
  const terms = await officerRepo.findActiveByPersonAndOrg(user.id, orgId);
  if (terms.length === 0) {
    throw new ForbiddenError('Officer access required for this organization');
  }

  // FIX-006 (m01 §6): roster import is a high-impact bulk mutation restricted
  // to President / Secretary, and those privileged positions require 2FA (parity
  // with requirePosition / P1-3). Titles are sourced from the DB term, never the
  // request. NB: this handler scopes by the request-body `orgId`, so the gate is
  // applied inline against the already-fetched terms rather than via
  // requirePosition (which reads ctx organizationId).
  const ALLOWED_IMPORT_TITLES = new Set(['president', 'secretary']);
  const holdsAllowedTitle = terms.some(t =>
    ALLOWED_IMPORT_TITLES.has(((t.positionTitle as string) ?? '').toLowerCase()),
  );
  if (!holdsAllowedTitle) {
    throw new ForbiddenError('Roster import requires a President or Secretary position');
  }
  const isDev = process.env['NODE_ENV'] !== 'production';
  if (!user.twoFactorEnabled && !isDev) {
    throw new ForbiddenError(
      'Two-factor authentication required for roster import. Please enable 2FA in your account settings.',
    );
  }

  const inviteRepo = new InviteRepository(db, logger);

  const grid = parseCsv(csvContent);
  if (grid.length === 0) {
    throw new ValidationError('CSV content is empty');
  }

  // Map header columns (case-insensitive) to indices.
  const header = grid[0]!.map((h) => h.trim().toLowerCase());
  const emailIdx = header.indexOf('email');
  const nameIdx = header.indexOf('name');
  const licenseIdx = header.indexOf('licensenumber');
  if (emailIdx === -1) {
    throw new ValidationError('CSV must include an "email" column');
  }

  const dataRows = grid.slice(1);
  const preview: ParsedRow[] = [];
  const errors: string[] = [];
  const seenEmails = new Set<string>();

  for (let i = 0; i < dataRows.length; i++) {
    const cols = dataRows[i]!;
    const rowNum = i + 1;

    // Skip fully blank lines.
    if (cols.every((c) => c.trim() === '')) continue;

    const email = (cols[emailIdx] ?? '').trim().toLowerCase();
    const name = nameIdx !== -1 ? (cols[nameIdx] ?? '').trim() : undefined;
    const licenseNumber = licenseIdx !== -1 ? (cols[licenseIdx] ?? '').trim() : undefined;

    const base: ParsedRow = { row: rowNum, email, name, licenseNumber, status: 'valid' };

    if (!email || !EMAIL_RE.test(email)) {
      base.status = 'invalid';
      base.reason = 'Invalid or missing email';
      errors.push(`Row ${rowNum}: invalid or missing email`);
      preview.push(base);
      continue;
    }

    if (seenEmails.has(email)) {
      base.status = 'duplicate';
      base.reason = 'Duplicate email within CSV';
      preview.push(base);
      continue;
    }
    seenEmails.add(email);

    const existing = await inviteRepo.findPendingByEmail(email, orgId);
    if (existing) {
      base.status = 'duplicate';
      base.reason = 'Active invitation already exists';
      preview.push(base);
      continue;
    }

    preview.push(base);
  }

  const totalRows = preview.length;
  const validRows = preview.filter((r) => r.status === 'valid').length;
  const invalidRows = preview.filter((r) => r.status === 'invalid').length;
  const duplicateRows = preview.filter((r) => r.status === 'duplicate').length;

  if (mode === 'preview') {
    return ctx.json({
      mode: 'preview',
      previewResult: {
        totalRows,
        validRows,
        invalidRows,
        duplicateRows,
        preview,
        errors,
      },
    });
  }

  // import mode — persist invitations + issue claim tokens for valid rows.
  const importId = randomUUID();
  const secret = getInviteTokenSecret();
  let imported = 0;

  for (const r of preview) {
    if (r.status !== 'valid' || !r.email) continue;
    const { hash } = generateInviteToken(secret);
    await inviteRepo.create({
      organizationId: orgId,
      personId: null,
      tokenHash: hash,
      type: 'claim',
      expiresAt: defaultExpiryDate(),
      createdByOfficer: user.id,
      email: r.email,
      message: null,
      metadata: {
        name: r.name || undefined,
        licenseNumber: r.licenseNumber || undefined,
      },
    });
    imported++;
  }

  ctx.set('auditResourceId', importId);
  ctx.set('auditDescription', `Bulk import ${importId}: ${imported} invitations created for organization ${orgId}`);

  return ctx.json({
    mode: 'import',
    importResult: {
      importId,
      imported,
      skipped: totalRows - imported,
      invitationsSent: imported,
    },
  });
}
