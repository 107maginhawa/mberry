import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { DocumentRepository } from '@/handlers/documents/repos/documents.repo';
import { domainEvents } from '@/core/domain-events';
import { createMyCreditEntry } from './createMyCreditEntry';

mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

describe('createMyCreditEntry', () => {
  beforeEach(() => { restoreRepo(CreditEntryRepository); restoreRepo(DocumentRepository); });
  afterEach(() => { restoreRepo(CreditEntryRepository); restoreRepo(DocumentRepository); });

  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(createMyCreditEntry(ctx)).rejects.toThrow('Unauthorized');
  });

  test('throws ValidationError when activityName missing', async () => {
    const ctx = makeCtx({ _body: { activityName: '', creditAmount: -1, activityDate: '2025-01-01' } });
    await expect(createMyCreditEntry(ctx)).rejects.toThrow('activityName required');
  });

  test('returns 201 on happy path', async () => {
    const entry = { id: 'ce-1', personId: 'user-1', activityName: 'CPE Course', creditAmount: 3 };
    stubRepo(CreditEntryRepository, {
      createOne: async () => entry,
    });
    const ctx = makeCtx({
      _body: {
        activityName: 'CPE Course',
        creditAmount: 3,
        activityDate: '2025-01-15',
        organizationId: 'org-1',
        provider: 'Test Provider',
      },
    });
    const res = await createMyCreditEntry(ctx);
    expect(res.status).toBe(201);
  });

  // ── EM-M10-15ad42e8: self-service credit emits credit.awarded ──
  test('emits credit.awarded on success', async () => {
    const entry = { id: 'ce-1', personId: 'user-1', activityName: 'CPE Course', creditAmount: 3 };
    stubRepo(CreditEntryRepository, { createOne: async () => entry });
    const emitSpy = spyOn(domainEvents, 'emit');
    try {
      const ctx = makeCtx({
        _body: {
          activityName: 'CPE Course',
          creditAmount: 3,
          activityDate: '2025-01-15',
          organizationId: 'org-1',
        },
      });
      await createMyCreditEntry(ctx);
      const awardedEmit = emitSpy.mock.calls.find((c) => c[0] === 'credit.awarded');
      expect(awardedEmit).toBeDefined();
      expect(awardedEmit![1]).toMatchObject({
        personId: 'user-1',
        organizationId: 'org-1',
        creditAmount: 3,
        activityName: 'CPE Course',
        creditEntryId: 'ce-1',
      });
    } finally {
      emitSpy.mockRestore();
    }
  });

  // ── EM-M10-d9f14b3e: M10-R5 supporting-document validation ──
  test('rejects supporting document with disallowed mime type', async () => {
    stubRepo(CreditEntryRepository, { createOne: async () => ({ id: 'ce-1' }) });
    stubRepo(DocumentRepository, {
      findOneById: async () => ({ id: 'doc-1', mimeType: 'application/zip', size: 1024 }),
    });
    const ctx = makeCtx({
      _body: {
        activityName: 'CPE Course',
        creditAmount: 3,
        activityDate: '2025-01-15',
        organizationId: 'org-1',
        supportingDocumentId: 'doc-1',
      },
    });
    await expect(createMyCreditEntry(ctx)).rejects.toThrow(/PDF|image/i);
  });

  test('rejects supporting document over 5MB', async () => {
    stubRepo(CreditEntryRepository, { createOne: async () => ({ id: 'ce-1' }) });
    stubRepo(DocumentRepository, {
      findOneById: async () => ({ id: 'doc-1', mimeType: 'application/pdf', size: 6 * 1024 * 1024 }),
    });
    const ctx = makeCtx({
      _body: {
        activityName: 'CPE Course',
        creditAmount: 3,
        activityDate: '2025-01-15',
        organizationId: 'org-1',
        supportingDocumentId: 'doc-1',
      },
    });
    await expect(createMyCreditEntry(ctx)).rejects.toThrow(/5\s*MB|exceeds/i);
  });

  test('accepts a valid PDF supporting document', async () => {
    stubRepo(CreditEntryRepository, { createOne: async () => ({ id: 'ce-1', creditAmount: 3 }) });
    stubRepo(DocumentRepository, {
      findOneById: async () => ({ id: 'doc-1', mimeType: 'application/pdf', size: 1024 }),
    });
    const ctx = makeCtx({
      _body: {
        activityName: 'CPE Course',
        creditAmount: 3,
        activityDate: '2025-01-15',
        organizationId: 'org-1',
        supportingDocumentId: 'doc-1',
      },
    });
    const res = await createMyCreditEntry(ctx);
    expect(res.status).toBe(201);
  });
});
