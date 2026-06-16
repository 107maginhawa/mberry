import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { generateDuesReport } from './generateDuesReport';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

function stubOfficerAccess() {
  return stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ positionTitle: 'Treasurer' }],
  });
}

describe('generateDuesReport', () => {
  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesRepository);
  });

  test('throws ForbiddenError when route org param does not match ctx org', async () => {
    stubOfficerAccess();
    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { organizationId: 'other-org' },
      _query: { type: 'collection' },
    });
    await expect(generateDuesReport(ctx)).rejects.toThrow();
  });

  test('returns 403 when caller lacks position', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { organizationId: 'tenant-1' },
      _query: { type: 'collection' },
    });
    const res = await generateDuesReport(ctx);
    expect(res.status).toBe(403);
  });

  test('collection report computes totalCollected summary', async () => {
    stubOfficerAccess();
    stubRepo(DuesRepository, {
      reportCollectionSummary: async () => [{ total: 100 }, { total: 250 }],
    });
    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { organizationId: 'tenant-1' },
      _query: { type: 'collection' },
    });
    const res = await generateDuesReport(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.summary.totalCollected).toBe(350);
    expect(body.summary.rowCount).toBe(2);
    expect(body.meta.type).toBe('collection');
  });

  test('fund_breakdown report', async () => {
    stubOfficerAccess();
    stubRepo(DuesRepository, {
      reportFundBreakdown: async () => [{ fund: 'a' }],
    });
    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { organizationId: 'tenant-1' },
      _query: { type: 'fund_breakdown' },
    });
    const res = await generateDuesReport(ctx);
    expect((res as any).body.summary.fundCount).toBe(1);
  });

  test('dues_status report', async () => {
    stubOfficerAccess();
    stubRepo(DuesRepository, {
      reportDuesStatus: async () => [{ m: 1 }, { m: 2 }, { m: 3 }],
    });
    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { organizationId: 'tenant-1' },
      _query: { type: 'dues_status' },
    });
    const res = await generateDuesReport(ctx);
    expect((res as any).body.summary.memberCount).toBe(3);
  });

  test('aging report', async () => {
    stubOfficerAccess();
    stubRepo(DuesRepository, {
      reportAging: async () => [{ overdue: 1 }],
    });
    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { organizationId: 'tenant-1' },
      _query: { type: 'aging' },
    });
    const res = await generateDuesReport(ctx);
    expect((res as any).body.summary.totalOverdue).toBe(1);
  });

  test('falls back to route org param when no ctx org set', async () => {
    stubOfficerAccess();
    stubRepo(DuesRepository, {
      reportCollectionSummary: async () => [{ total: 10 }],
    });
    const ctx = makeCtx({
      organizationId: null,
      _params: { organizationId: 'tenant-9' },
      _query: { type: 'collection' },
    });
    const res = await generateDuesReport(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.summary.totalCollected).toBe(10);
  });
});
