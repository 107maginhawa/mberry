import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { stubRepo } from '@/test-utils/make-ctx';
import { ComplianceRepository } from '@/handlers/association:member/repos/compliance.repo';
import { getComplianceReport } from './getComplianceReport';

const mockGetOrgSummary = mock(() => Promise.resolve({ totalMembers: 10, compliant: 7, atRisk: 2, nonCompliant: 1, complianceRate: 70 }));
const mockGetByOrganization = mock(() => Promise.resolve({
  data: [
    { personId: 'p1', organizationId: 'org-1', totalCredits: 60, complianceStatus: 'compliant', compliancePercent: 100 },
    { personId: 'p2', organizationId: 'org-1', totalCredits: 30, complianceStatus: 'at_risk', compliancePercent: 50 },
  ],
  total: 2,
}));

// stubRepo (not mock.module): mock.module replaces the whole module and leaks the
// fake repo across files (broke compliance.repo.integration.test.ts in the single-
// process coverage run). ComplianceRepository is registered in preload-pristine.ts,
// whose beforeEach restores the prototype before every test — so the stub must be
// (re)installed in THIS file's beforeEach (after the guard's restore), not top-level.

const OFFICER_TERM = { positionTitle: 'President' };

function buildMockDb(selectResults: any[][] = []) {
  let selectIdx = 0;
  const db = {
    select: (..._a: any[]) => ({
      from: (_t: any) => {
        const idx = selectIdx++;
        const result = idx < selectResults.length ? selectResults[idx] : [];
        const chain = {
          limit: (_n: number) => Promise.resolve(result),
          then: (r: any, j?: any) => Promise.resolve(result).then(r, j),
        };
        const whereChain = {
          where: (_c: any) => chain,
          limit: (_n: number) => Promise.resolve(result),
          then: (r: any, j?: any) => Promise.resolve(result).then(r, j),
        };
        return {
          ...whereChain,
          innerJoin: (_t2: any, _c2: any) => whereChain,
          leftJoin: (_t2: any, _c2: any) => whereChain,
        };
      },
    }),
  };
  return { db };
}

function createMockCtx(overrides: {
  session?: any;
  user?: any;
  database?: any;
  params?: Record<string, string>;
  queryParams?: Record<string, string>;
}) {
  const getMap: Record<string, any> = {
    session: 'session' in overrides ? overrides.session : { user: { id: 'user-1' } },
    user: 'user' in overrides ? overrides.user : { id: 'user-1' },
    database: overrides.database ?? {},
    organizationId: 'org-1',
  };
  return {
    get: (key: string) => getMap[key],
    req: {
      param: (key: string) => overrides.params?.[key] ?? 'org-1',
      query: (key: string) => overrides.queryParams?.[key],
    },
    json: (data: any, status?: number) => new Response(JSON.stringify(data), { status: status ?? 200 }),
  } as any;
}

describe('getComplianceReport', () => {
  beforeEach(() => {
    stubRepo(ComplianceRepository, {
      getOrgSummary: mockGetOrgSummary,
      getByOrganization: mockGetByOrganization,
    });
    mockGetOrgSummary.mockReset();
    mockGetOrgSummary.mockImplementation(() => Promise.resolve({ totalMembers: 10, compliant: 7, atRisk: 2, nonCompliant: 1, complianceRate: 70 }));
    mockGetByOrganization.mockReset();
    mockGetByOrganization.mockImplementation(() => Promise.resolve({
      data: [
        { personId: 'p1', organizationId: 'org-1', totalCredits: 60, complianceStatus: 'compliant' },
        { personId: 'p2', organizationId: 'org-1', totalCredits: 30, complianceStatus: 'at_risk' },
      ],
      total: 2,
    }));
  });

  test('returns summary, standings, and pagination', async () => {
    const { db } = buildMockDb([[OFFICER_TERM]]);
    const ctx = createMockCtx({ database: db });
    const res = await getComplianceReport(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.summary.totalMembers).toBe(10);
    expect(body.data.summary.compliant).toBe(7);
    expect(body.data.summary.complianceRate).toBe(70);
    expect(body.data.standings).toHaveLength(2);
    expect(body.data.pagination.total).toBe(2);
    expect(body.data.pagination.limit).toBe(50);
    expect(body.data.pagination.offset).toBe(0);
  });

  test('applies status filter', async () => {
    const { db } = buildMockDb([[OFFICER_TERM]]);
    const ctx = createMockCtx({ database: db, queryParams: { status: 'compliant' } });
    await getComplianceReport(ctx);
    expect(mockGetByOrganization).toHaveBeenCalledTimes(1);
    const callArgs = mockGetByOrganization.mock.calls[0];
    expect(callArgs[1].status).toBe('compliant');
  });

  test('applies limit and offset', async () => {
    const { db } = buildMockDb([[OFFICER_TERM]]);
    const ctx = createMockCtx({ database: db, queryParams: { limit: '10', offset: '20' } });
    await getComplianceReport(ctx);
    expect(mockGetByOrganization).toHaveBeenCalledTimes(1);
    const callArgs = mockGetByOrganization.mock.calls[0];
    expect(callArgs[1].limit).toBe(10);
    expect(callArgs[1].offset).toBe(20);
  });

  test('uses default limit=50 offset=0 when not provided', async () => {
    const { db } = buildMockDb([[OFFICER_TERM]]);
    const ctx = createMockCtx({ database: db });
    await getComplianceReport(ctx);
    const callArgs = mockGetByOrganization.mock.calls[0];
    expect(callArgs[1].limit).toBe(50);
    expect(callArgs[1].offset).toBe(0);
  });

  test('returns 401 when no user', async () => {
    const { db } = buildMockDb();
    const ctx = createMockCtx({ database: db, session: null, user: null });
    const res = await getComplianceReport(ctx);
    expect(res.status).toBe(401);
  });
});
