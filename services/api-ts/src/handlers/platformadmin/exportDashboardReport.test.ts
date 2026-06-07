/**
 * exportDashboardReport — characterization tests
 *
 * Path: POST /admin/national/export/:associationId
 * Auth: platform_admin OR designated national officer
 * BR-36: All exports must be logged.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DashboardRepository } from './repos/dashboard.repo';
import { exportDashboardReport } from './exportDashboardReport';

const fakeExportLog = {
  id: 'export-1',
  exportedBy: 'user-1',
  associationId: 'assoc-1',
  reportType: 'association_summary',
  scope: 'association',
  outputFormat: 'pdf',
  dateRangeStart: new Date('2025-01-01'),
  dateRangeEnd: new Date('2025-12-31'),
  createdAt: new Date(),
};

const PLATFORM_ADMIN = { id: 'user-1', role: 'platform_admin' };

describe('exportDashboardReport (characterization)', () => {
  beforeEach(() => {
    restoreRepo(DashboardRepository);
    stubRepo(DashboardRepository, {
      isDesignatedNationalOfficer: async () => true,
      createExportLog: async () => fakeExportLog,
    });
  });

  afterEach(() => {
    restoreRepo(DashboardRepository);
  });

  test('returns 401 without session', async () => {
    const ctx = makeCtx({
      session: null,
      user: null,
      _params: { associationId: 'assoc-1' },
      _body: { reportType: 'association_summary', outputFormat: 'pdf' },
    });
    const res = await exportDashboardReport(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when not platform admin and not national officer', async () => {
    restoreRepo(DashboardRepository);
    stubRepo(DashboardRepository, {
      isDesignatedNationalOfficer: async () => false,
      createExportLog: async () => fakeExportLog,
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'member' },
      _params: { associationId: 'assoc-1' },
      _body: { reportType: 'association_summary', outputFormat: 'pdf' },
    });
    const res = await exportDashboardReport(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 202 with export metadata for platform admin', async () => {
    const ctx = makeCtx({
      user: PLATFORM_ADMIN,
      platformAdmin: { id: 'pa-1', role: 'super' },
      _params: { associationId: 'assoc-1' },
      _body: { reportType: 'association_summary', outputFormat: 'pdf' },
    });
    const res = await exportDashboardReport(ctx);
    expect(res.status).toBe(202);
    expect((res as any).body?.data?.exportId).toBe('export-1');
    expect((res as any).body?.data?.status).toBe('queued');
  });

  test('returns 400 for invalid reportType', async () => {
    const ctx = makeCtx({
      user: PLATFORM_ADMIN,
      platformAdmin: { id: 'pa-1', role: 'super' },
      _params: { associationId: 'assoc-1' },
      _body: { reportType: 'invalid_type', outputFormat: 'pdf' },
    });
    const res = await exportDashboardReport(ctx);
    expect(res.status).toBe(400);
  });

  test('returns 400 for invalid outputFormat', async () => {
    const ctx = makeCtx({
      user: PLATFORM_ADMIN,
      platformAdmin: { id: 'pa-1', role: 'super' },
      _params: { associationId: 'assoc-1' },
      _body: { reportType: 'association_summary', outputFormat: 'xlsx' },
    });
    const res = await exportDashboardReport(ctx);
    expect(res.status).toBe(400);
  });

  test('returns 400 when dateRangeStart is after dateRangeEnd', async () => {
    const ctx = makeCtx({
      user: PLATFORM_ADMIN,
      platformAdmin: { id: 'pa-1', role: 'super' },
      _params: { associationId: 'assoc-1' },
      _body: {
        reportType: 'association_summary',
        outputFormat: 'pdf',
        dateRangeStart: '2025-12-31',
        dateRangeEnd: '2025-01-01',
      },
    });
    const res = await exportDashboardReport(ctx);
    expect(res.status).toBe(400);
  });

  test('defaults scope to association when not provided', async () => {
    const ctx = makeCtx({
      user: PLATFORM_ADMIN,
      platformAdmin: { id: 'pa-1', role: 'super' },
      _params: { associationId: 'assoc-1' },
      _body: { reportType: 'dues_collection', outputFormat: 'csv' },
    });
    const res = await exportDashboardReport(ctx);
    expect(res.status).toBe(202);
  });
});
