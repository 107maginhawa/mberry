/**
 * exportNationalDashboard handler tests — RED phase
 *
 * Business rules (BR-36):
 * - Returns chapter snapshot data as CSV for download
 * - Only platform admin or designated national officers
 * - PII columns blocked
 * - Export logged for audit
 * - Small chapters (<5 members) anonymized
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DashboardRepository } from '../platformadmin/repos/dashboard.repo';

mock.module('@/utils/audit', () => ({ auditAction: async () => {} }));

// ─── Fixtures ───────────────────────────────────────────

const chapterSnapshots = [
  {
    id: 'snap-1',
    orgId: 'org-1',
    associationId: 'assoc-1',
    chapterName: 'Metro Manila Chapter',
    snapshotMonth: '2026-05',
    totalMembers: 45,
    activeMembers: 40,
    graceMembers: 3,
    lapsedMembers: 2,
    suspendedMembers: 0,
    collectionRate: 0.89,
    totalCollected: 450000,
    totalExpected: 505000,
    cpdComplianceRate: 0.82,
    avgCreditsPerMember: 22,
    activityCount90d: 12,
  },
  {
    id: 'snap-2',
    orgId: 'org-2',
    associationId: 'assoc-1',
    chapterName: 'Cebu Chapter',
    snapshotMonth: '2026-05',
    totalMembers: 30,
    activeMembers: 25,
    graceMembers: 3,
    lapsedMembers: 2,
    suspendedMembers: 0,
    collectionRate: 0.83,
    totalCollected: 150000,
    totalExpected: 180000,
    cpdComplianceRate: 0.77,
    avgCreditsPerMember: 18,
    activityCount90d: 8,
  },
];

// ─── Tests ──────────────────────────────────────────────

describe('exportNationalDashboard', () => {
  let exportNationalDashboard: typeof import('./exportNationalDashboard').exportNationalDashboard;

  beforeEach(async () => {
    restoreRepo(DashboardRepository);
    exportNationalDashboard = (await import('./exportNationalDashboard')).exportNationalDashboard;
  });

  afterEach(() => {
    restoreRepo(DashboardRepository);
  });

  test('returns CSV data for chapter snapshots with 200', async () => {
    stubRepo(DashboardRepository, {
      listChapterSnapshots: async () => chapterSnapshots,
      createExportLog: async (data: any) => ({ id: 'log-1', ...data, createdAt: new Date() }),
      isDesignatedNationalOfficer: async () => true,
    });

    const ctx = makeCtx({
      _params: { associationId: 'assoc-1' },
      _body: { snapshotMonth: '2026-05', format: 'csv' },
    });
    const response = await exportNationalDashboard(ctx);

    expect(response.status).toBe(200);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.format).toBe('csv');
    expect(response.body.data.csv).toContain('Metro Manila Chapter');
  });

  test('returns JSON format when requested', async () => {
    stubRepo(DashboardRepository, {
      listChapterSnapshots: async () => chapterSnapshots,
      createExportLog: async (data: any) => ({ id: 'log-1', ...data, createdAt: new Date() }),
      isDesignatedNationalOfficer: async () => true,
    });

    const ctx = makeCtx({
      _params: { associationId: 'assoc-1' },
      _body: { snapshotMonth: '2026-05', format: 'json' },
    });
    const response = await exportNationalDashboard(ctx);

    expect(response.status).toBe(200);
    expect(response.body.data.chapters).toHaveLength(2);
  });

  test('returns 403 when user is not admin or national officer', async () => {
    stubRepo(DashboardRepository, {
      isDesignatedNationalOfficer: async () => false,
    });

    const ctx = makeCtx({
      _params: { associationId: 'assoc-1' },
      _body: { snapshotMonth: '2026-05' },
    });
    const response = await exportNationalDashboard(ctx);
    expect(response.status).toBe(403);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { associationId: 'assoc-1' },
      _body: { snapshotMonth: '2026-05' },
    });
    await expect(exportNationalDashboard(ctx)).rejects.toThrow('Unauthorized');
  });
});
