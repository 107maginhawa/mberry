/**
 * upsertDuesFunds.test.ts
 *
 * [FIX-005 Batch B] Server-side fund-split validation (BR-05).
 *
 * RED phase: upsertDuesFunds currently calls repo.replaceFunds(...) with ZERO
 * server-side validation — only the client checks the 100% sum. These tests
 * assert that fund percentages must total exactly 100% server-side, wiring the
 * existing validateFundSplits() util. Invalid splits must be rejected with a
 * ValidationError (400) BEFORE any DB write.
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import { ValidationError } from '@/core/errors';
import { upsertDuesFunds } from './upsertDuesFunds';

describe('[FIX-005] upsertDuesFunds — server-side fund-split validation (BR-05)', () => {
  beforeEach(() => {
    restoreRepo(DuesRepository);
  });

  afterEach(() => {
    restoreRepo(DuesRepository);
  });

  test('rejects funds whose percentages sum to less than 100% — no DB write [RED]', async () => {
    let replaceCalled = false;
    stubRepo(DuesRepository, {
      replaceFunds: async () => { replaceCalled = true; },
      listFunds: async () => [],
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: {
        funds: [
          { fundName: 'General', percentage: 50, isLast: false },
          { fundName: 'Scholarship', percentage: 30, isLast: true },
        ], // sums to 80
      },
      organizationId: 'org-1',
    });

    // RED: handler currently performs no validation — replaceFunds runs and returns 200.
    await expect(upsertDuesFunds(ctx as any)).rejects.toThrow(ValidationError);
    expect(replaceCalled).toBe(false);
  });

  test('rejects funds whose percentages sum to more than 100% — no DB write [RED]', async () => {
    let replaceCalled = false;
    stubRepo(DuesRepository, {
      replaceFunds: async () => { replaceCalled = true; },
      listFunds: async () => [],
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: {
        funds: [
          { fundName: 'General', percentage: 70, isLast: false },
          { fundName: 'Scholarship', percentage: 40, isLast: true },
        ], // sums to 110
      },
      organizationId: 'org-1',
    });

    await expect(upsertDuesFunds(ctx as any)).rejects.toThrow(ValidationError);
    expect(replaceCalled).toBe(false);
  });

  test('rejects an empty funds list — no DB write [RED]', async () => {
    let replaceCalled = false;
    stubRepo(DuesRepository, {
      replaceFunds: async () => { replaceCalled = true; },
      listFunds: async () => [],
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { funds: [] },
      organizationId: 'org-1',
    });

    await expect(upsertDuesFunds(ctx as any)).rejects.toThrow(ValidationError);
    expect(replaceCalled).toBe(false);
  });

  test('accepts funds whose percentages sum to exactly 100% — persists + returns 200', async () => {
    let replaceCalled = false;
    let replacedWith: any;
    stubRepo(DuesRepository, {
      replaceFunds: async (_orgId: string, funds: any) => { replaceCalled = true; replacedWith = funds; },
      listFunds: async () => [
        { id: 'f-1', organizationId: 'org-1', name: 'General', percentage: '60', sortOrder: 0, active: true },
        { id: 'f-2', organizationId: 'org-1', name: 'Scholarship', percentage: '40', sortOrder: 1, active: true },
      ],
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: {
        funds: [
          { fundName: 'General', percentage: 60, isLast: false },
          { fundName: 'Scholarship', percentage: 40, isLast: true },
        ], // sums to 100
      },
      organizationId: 'org-1',
    });

    const res = await upsertDuesFunds(ctx as any);
    expect(res.status).toBe(200);
    expect(replaceCalled).toBe(true);
    // Validation must use the numeric percentage, not the stringified DB value.
    expect(replacedWith).toHaveLength(2);
  });
});
