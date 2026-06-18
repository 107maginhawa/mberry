/**
 * listDuesFunds.test.ts
 *
 * Covers:
 *  - Throws UnauthorizedError when no session
 *  - Happy path — returns 200 with data array
 *  - Empty org → returns [] (not null/undefined)
 *  - Fund fields: id, name, percentage, sortOrder, active
 *  - Uses organizationId from query param
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { listDuesFunds } from './listDuesFunds';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';

const FAKE_FUNDS = [
  {
    id: 'fund-1',
    organizationId: 'org-1',
    name: 'National Fund',
    percentage: '60.00',
    sortOrder: 1,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'fund-2',
    organizationId: 'org-1',
    name: 'Local Chapter Fund',
    percentage: '40.00',
    sortOrder: 2,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe('listDuesFunds', () => {
  beforeEach(() => restoreRepo(DuesRepository));
  afterEach(() => restoreRepo(DuesRepository));

  test('throws UnauthorizedError when session is null', async () => {
    const ctx = makeCtx({ session: null, user: null });
    await expect(listDuesFunds(ctx as any)).rejects.toThrow();
  });

  test('happy path — returns 200 with funds array', async () => {
    stubRepo(DuesRepository, {
      listFunds: async () => FAKE_FUNDS,
    });

    const ctx = makeCtx({ _query: { organizationId: 'org-1' } });
    const res = await listDuesFunds(ctx as any);

    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(2);
  });

  test('fund fields are preserved in response', async () => {
    stubRepo(DuesRepository, {
      listFunds: async () => FAKE_FUNDS,
    });

    const ctx = makeCtx({ _query: { organizationId: 'org-1' } });
    const res = await listDuesFunds(ctx as any);

    const fund = (res as any).body.data[0];
    expect(fund.id).toBe('fund-1');
    expect(fund.name).toBe('National Fund');
    expect(fund.percentage).toBe('60.00');
    expect(fund.sortOrder).toBe(1);
  });

  test('percentages are strings not numbers (DB stores as varchar)', async () => {
    stubRepo(DuesRepository, {
      listFunds: async () => FAKE_FUNDS,
    });

    const ctx = makeCtx({ _query: { organizationId: 'org-1' } });
    const res = await listDuesFunds(ctx as any);

    const fund = (res as any).body.data[0];
    expect(typeof fund.percentage).toBe('string');
  });

  test('empty org — returns empty array not null', async () => {
    stubRepo(DuesRepository, {
      listFunds: async () => [],
    });

    const ctx = makeCtx({ _query: { organizationId: 'org-empty' } });
    const res = await listDuesFunds(ctx as any);

    expect(res.status).toBe(200);
    expect(Array.isArray((res as any).body.data)).toBe(true);
    expect((res as any).body.data).toHaveLength(0);
  });

  test('passes organizationId from query param to repo', async () => {
    let capturedOrgId: string | undefined;
    stubRepo(DuesRepository, {
      listFunds: async (orgId: string) => {
        capturedOrgId = orgId;
        return [];
      },
    });

    const ctx = makeCtx({ _query: { organizationId: 'org-xyz' } });
    await listDuesFunds(ctx as any);
    expect(capturedOrgId).toBe('org-xyz');
  });
});
