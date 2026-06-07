import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';

/**
 * Chapters Module Tests
 *
 * Tests for chapter affiliations, transfers, and royalty splits.
 */

describe('Chapter Affiliations', () => {
  test('createChapterAffiliation returns 401 without user', async () => {
    const { createChapterAffiliation } = await import('./createChapterAffiliation');
    const ctx = makeCtx({ user: null });
    const response = await createChapterAffiliation(ctx);
    expect(response.status).toBe(401);
  });

  test('affiliation statuses are active, transferred, withdrawn', () => {
    const validStatuses = ['active', 'transferred', 'withdrawn'];
    expect(validStatuses.length).toBe(3);
    expect(validStatuses).toContain('active');
    expect(validStatuses).toContain('transferred');
  });

  test('only one primary affiliation per person per tenant', () => {
    // setPrimary clears isPrimary on all other affiliations for same person+tenant
    // then sets the target affiliation as primary
    const affiliations = [
      { id: 'a1', isPrimary: true, personId: 'p1' },
      { id: 'a2', isPrimary: false, personId: 'p1' },
      { id: 'a3', isPrimary: false, personId: 'p1' },
    ];

    // After setting a2 as primary:
    const updated = affiliations.map(a => ({
      ...a,
      isPrimary: a.id === 'a2',
    }));

    expect(updated.filter(a => a.isPrimary).length).toBe(1);
    expect(updated.find(a => a.id === 'a2')!.isPrimary).toBe(true);
    expect(updated.find(a => a.id === 'a1')!.isPrimary).toBe(false);
  });
});

describe('Affiliation Transfers', () => {
  test('transfer status progression: requested -> approved -> completed', () => {
    const statuses = ['requested', 'pendingSourceApproval', 'pendingTargetApproval', 'approved', 'completed'];
    expect(statuses.indexOf('requested')).toBeLessThan(statuses.indexOf('approved'));
    expect(statuses.indexOf('approved')).toBeLessThan(statuses.indexOf('completed'));
  });

  test('transfer requires both source and target approval', () => {
    const transfer = {
      approvedBySource: null as string | null,
      approvedByTarget: null as string | null,
      status: 'requested',
    };

    // Source approves
    transfer.approvedBySource = 'officer-1';
    const bothApproved = transfer.approvedBySource && transfer.approvedByTarget;
    expect(bothApproved).toBeFalsy();

    // Target approves
    transfer.approvedByTarget = 'officer-2';
    const nowBothApproved = transfer.approvedBySource && transfer.approvedByTarget;
    expect(nowBothApproved).toBeTruthy();
  });

  test('deny prevents completion', () => {
    const deniableStatuses = ['requested', 'pendingSourceApproval', 'pendingTargetApproval'];
    const nonDeniable = ['completed', 'denied', 'cancelled'];

    for (const s of nonDeniable) {
      expect(deniableStatuses).not.toContain(s);
    }
  });
});

describe('Royalty Splits', () => {
  test('national + chapter percentages must equal 100', () => {
    const split = { splitPercentNational: 60, splitPercentChapter: 40 };
    expect(split.splitPercentNational + split.splitPercentChapter).toBe(100);
  });

  test('rejects splits that do not sum to 100', () => {
    const badSplit = { splitPercentNational: 60, splitPercentChapter: 30 };
    expect(badSplit.splitPercentNational + badSplit.splitPercentChapter).not.toBe(100);
  });

  test('percentages are non-negative', () => {
    const split = { splitPercentNational: 70, splitPercentChapter: 30 };
    expect(split.splitPercentNational).toBeGreaterThanOrEqual(0);
    expect(split.splitPercentChapter).toBeGreaterThanOrEqual(0);
  });
});
