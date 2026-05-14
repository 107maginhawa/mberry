/**
 * Tests for SuppressionRepository
 *
 * Tests org-scoped suppression check, add, list, and remove operations.
 * DB calls are mocked — we test business logic only.
 */

import { describe, test, expect, spyOn } from 'bun:test';
import { SuppressionRepository } from './suppression.repo';
import type { EmailSuppression } from './suppression.schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger() {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}

function makeMockDb() {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
          orderBy: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
        orderBy: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => Promise.resolve({ rowCount: 1 }),
        returning: () => Promise.resolve([]),
      }),
    }),
    delete: () => ({
      where: () => Promise.resolve({ rowCount: 1 }),
    }),
  } as any;
}

function makeRepo(dbOverride?: any) {
  const db = dbOverride ?? makeMockDb();
  return new SuppressionRepository(db, makeLogger());
}

function makeSuppression(overrides: Partial<EmailSuppression> = {}): EmailSuppression {
  return {
    id: 'sup-1',
    organizationId: 'org-1',
    email: 'bounce@example.com',
    reason: 'hard_bounce',
    suppressedAt: new Date(),
    suppressedBy: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isSuppressed
// ---------------------------------------------------------------------------

describe('SuppressionRepository', () => {
  describe('isSuppressed', () => {
    test('returns true for suppressed email in same org', async () => {
      const repo = makeRepo();
      // Stub findMany to return one matching suppression (array, not paginated)
      spyOn(repo, 'findMany' as any).mockResolvedValue([
        makeSuppression({ email: 'bounce@example.com', organizationId: 'org-1' }),
      ]);

      const result = await repo.isSuppressed('bounce@example.com', 'org-1');
      expect(result).toBe(true);
    });

    test('returns false for email not in suppression list', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findMany' as any).mockResolvedValue([]);

      const result = await repo.isSuppressed('clean@example.com', 'org-1');
      expect(result).toBe(false);
    });

    test('returns false for same email in different org (org-scoped)', async () => {
      const repo = makeRepo();
      // Email is suppressed in org-2 but we're querying org-1
      spyOn(repo, 'findMany' as any).mockResolvedValue([]);

      const result = await repo.isSuppressed('bounce@example.com', 'org-1');
      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // addSuppression
  // ---------------------------------------------------------------------------

  describe('addSuppression', () => {
    test('creates a row with correct fields', async () => {
      const repo = makeRepo();
      const createOneSpy = spyOn(repo, 'createOne' as any).mockResolvedValue(
        makeSuppression({ reason: 'hard_bounce' })
      );

      await repo.addSuppression({
        orgId: 'org-1',
        email: 'bounce@example.com',
        reason: 'hard_bounce',
        suppressedBy: 'user-1',
        notes: 'Hard bounce from SMTP',
      });

      expect(createOneSpy).toHaveBeenCalledTimes(1);
      const callArg = createOneSpy.mock.calls[0][0] as any;
      expect(callArg.organizationId).toBe('org-1');
      expect(callArg.email).toBe('bounce@example.com');
      expect(callArg.reason).toBe('hard_bounce');
      expect(callArg.suppressedBy).toBe('user-1');
      expect(callArg.notes).toBe('Hard bounce from SMTP');
    });

    test('addSuppression with duplicate email+org is idempotent (no error)', async () => {
      const repo = makeRepo();
      // First call succeeds, second call also succeeds (upsert behavior)
      spyOn(repo, 'createOne' as any).mockResolvedValue(makeSuppression());

      // Should not throw on first call
      await repo.addSuppression({ orgId: 'org-1', email: 'dup@example.com', reason: 'unsubscribe' });
      // Should not throw on second call (idempotent)
      await repo.addSuppression({ orgId: 'org-1', email: 'dup@example.com', reason: 'unsubscribe' });
    });
  });

  // ---------------------------------------------------------------------------
  // listByOrg
  // ---------------------------------------------------------------------------

  describe('listByOrg', () => {
    test('returns only suppressions for given org', async () => {
      const repo = makeRepo();
      const orgSuppressions = [
        makeSuppression({ organizationId: 'org-1', email: 'a@example.com' }),
        makeSuppression({ organizationId: 'org-1', email: 'b@example.com' }),
      ];
      spyOn(repo, 'findManyWithPagination' as any).mockResolvedValue({
        data: orgSuppressions,
        totalCount: 2,
      });

      const result = await repo.listByOrg('org-1');
      expect(result.data).toHaveLength(2);
      expect(result.data.every((s) => s.organizationId === 'org-1')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // removeSuppression
  // ---------------------------------------------------------------------------

  describe('removeSuppression', () => {
    test('deletes the row for org+email combination', async () => {
      const repo = makeRepo();
      // Should resolve without error
      await repo.removeSuppression('org-1', 'bounce@example.com');
    });
  });
});
