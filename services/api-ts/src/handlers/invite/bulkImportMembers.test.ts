import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { InviteRepository } from './repos/invite.repo';
import { bulkImportMembers } from './bulkImportMembers';
import { hashToken } from './utils/token';
import { getInviteTokenSecret } from '@/core/config';
import { ForbiddenError, ValidationError } from '@/core/errors';

const ORG = '22222222-2222-2222-2222-222222222222';
// Use the same secret the handler hashes with so the token<->hash check holds.
const TEST_SECRET = getInviteTokenSecret();

function asOfficer() {
  // FIX-006: roster import is restricted to President/Secretary — the default
  // authorized officer used by happy-path tests now holds a permitted title.
  return stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ id: 't1', organizationId: ORG, positionTitle: 'President' }],
  });
}

function asOfficerTitled(positionTitle: string) {
  return stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ id: 't1', organizationId: ORG, positionTitle }],
  });
}

describe('bulkImportMembers', () => {
  let mocks: Array<ReturnType<typeof stubRepo>> = [];
  afterEach(() => {
    mocks.forEach((m) => Object.values(m).forEach((x) => x.mockRestore()));
    mocks = [];
  });

  test('preview classifies valid, invalid, and CSV-internal duplicate rows', async () => {
    mocks.push(asOfficer());
    mocks.push(stubRepo(InviteRepository, { findPendingByEmail: async () => undefined }));
    const csv = [
      'email,name,licenseNumber',
      'alice@example.com,Alice,L-1',
      'not-an-email,Bob,L-2',
      'alice@example.com,Alice Dup,L-3',
    ].join('\n');
    const ctx = makeCtx({ _body: { orgId: ORG, csvContent: csv, mode: 'preview' } });
    const res = await bulkImportMembers(ctx);
    expect(res.body.mode).toBe('preview');
    const r = res.body.previewResult;
    expect(r.totalRows).toBe(3);
    expect(r.validRows).toBe(1);
    expect(r.invalidRows).toBe(1);
    expect(r.duplicateRows).toBe(1);
  });

  test('preview flags rows that already have a pending invite', async () => {
    mocks.push(asOfficer());
    mocks.push(stubRepo(InviteRepository, {
      findPendingByEmail: async (email: string) =>
        email === 'taken@example.com' ? ({ id: 'existing' } as any) : undefined,
    }));
    const csv = 'email\ntaken@example.com\nfree@example.com';
    const ctx = makeCtx({ _body: { orgId: ORG, csvContent: csv, mode: 'preview' } });
    const res = await bulkImportMembers(ctx);
    const r = res.body.previewResult;
    expect(r.validRows).toBe(1);
    expect(r.duplicateRows).toBe(1);
  });

  test('import mode creates one claim invite per valid row', async () => {
    mocks.push(asOfficer());
    const created: any[] = [];
    mocks.push(stubRepo(InviteRepository, {
      findPendingByEmail: async () => undefined,
      create: async (d: any) => { created.push(d); return { ...d, id: 'inv' }; },
    }));
    const csv = [
      'email,name,licenseNumber',
      'a@example.com,A,L1',
      'bad,B,L2',
      'b@example.com,B,L3',
    ].join('\n');
    const ctx = makeCtx({ _body: { orgId: ORG, csvContent: csv, mode: 'import' } });
    const res = await bulkImportMembers(ctx);
    expect(res.body.mode).toBe('import');
    expect(res.body.importResult.imported).toBe(2);
    expect(res.body.importResult.skipped).toBe(1);
    expect(res.body.importResult.invitationsSent).toBe(2);
    expect(created).toHaveLength(2);
    expect(created[0].type).toBe('claim');
    expect(created[0].metadata.name).toBe('A');
  });

  test('import mode surfaces a deliverable raw claim token per invite (matching the stored hash)', async () => {
    mocks.push(asOfficer());
    const created: any[] = [];
    mocks.push(stubRepo(InviteRepository, {
      findPendingByEmail: async () => undefined,
      create: async (d: any) => { created.push(d); return { ...d, id: 'inv' }; },
    }));
    const csv = 'email,name\na@example.com,A\nb@example.com,B';
    const ctx = makeCtx({ _body: { orgId: ORG, csvContent: csv, mode: 'import' } });
    const res = await bulkImportMembers(ctx);

    const invitations = res.body.importResult.invitations;
    // One deliverable invitation per imported row (not just a count).
    expect(invitations).toHaveLength(2);
    expect(invitations.map((i: any) => i.email).sort()).toEqual(['a@example.com', 'b@example.com']);

    // Each invite carries a non-empty raw token whose hash is what got persisted —
    // i.e. the token is actually claimable, not discarded.
    for (const inv of invitations) {
      expect(typeof inv.token).toBe('string');
      expect(inv.token.length).toBeGreaterThan(0);
      const stored = created.find((c) => c.email === inv.email);
      expect(stored.tokenHash).toBe(hashToken(inv.token, TEST_SECRET));
    }
  });

  test('handles quoted CSV fields with embedded commas', async () => {
    mocks.push(asOfficer());
    mocks.push(stubRepo(InviteRepository, { findPendingByEmail: async () => undefined }));
    const csv = 'email,name\nc@example.com,"Doe, Jane"';
    const ctx = makeCtx({ _body: { orgId: ORG, csvContent: csv, mode: 'preview' } });
    const res = await bulkImportMembers(ctx);
    expect(res.body.previewResult.preview[0].name).toBe('Doe, Jane');
    expect(res.body.previewResult.validRows).toBe(1);
  });

  test('rejects CSV missing the email column', async () => {
    mocks.push(asOfficer());
    mocks.push(stubRepo(InviteRepository, { findPendingByEmail: async () => undefined }));
    const ctx = makeCtx({ _body: { orgId: ORG, csvContent: 'name\nAlice', mode: 'preview' } });
    await expect(bulkImportMembers(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('403 when caller has no officer term', async () => {
    mocks.push(stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] }));
    const ctx = makeCtx({ _body: { orgId: ORG, csvContent: 'email\na@example.com', mode: 'preview' } });
    await expect(bulkImportMembers(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  // ── FIX-006: title + 2FA gate (m01 §6 — President/Secretary only) ──────────

  test('403 when caller holds a non-import officer title (e.g. Treasurer)', async () => {
    mocks.push(asOfficerTitled('Treasurer'));
    const ctx = makeCtx({ _body: { orgId: ORG, csvContent: 'email\na@example.com', mode: 'preview' } });
    await expect(bulkImportMembers(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('Secretary is permitted to import roster', async () => {
    mocks.push(asOfficerTitled('Secretary'));
    mocks.push(stubRepo(InviteRepository, { findPendingByEmail: async () => undefined }));
    const ctx = makeCtx({ _body: { orgId: ORG, csvContent: 'email\na@example.com', mode: 'preview' } });
    const res = await bulkImportMembers(ctx);
    expect(res.body.mode).toBe('preview');
  });

  test('403 in production when a privileged importer lacks 2FA', async () => {
    const old = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      mocks.push(asOfficerTitled('President'));
      const ctx = makeCtx({
        user: { id: 'user-1', role: 'user', twoFactorEnabled: false },
        _body: { orgId: ORG, csvContent: 'email\na@example.com', mode: 'preview' },
      });
      await expect(bulkImportMembers(ctx)).rejects.toBeInstanceOf(ForbiddenError);
    } finally {
      process.env['NODE_ENV'] = old;
    }
  });
});
