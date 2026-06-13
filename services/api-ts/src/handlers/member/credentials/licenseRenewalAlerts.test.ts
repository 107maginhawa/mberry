// FIX-008 (Batch D): per-handler unit suite for license-renewal-alert read + acknowledge.
import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { acknowledgeLicenseRenewalAlert } from './acknowledgeLicenseRenewalAlert';
import { listLicenseRenewalAlerts } from './listLicenseRenewalAlerts';
import { LicenseRenewalAlertRepository } from '@/handlers/association:member/repos/credits.repo';

afterEach(() => restoreRepo(LicenseRenewalAlertRepository));

describe('acknowledgeLicenseRenewalAlert', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _params: { alertId: 'a1' } });
    expect((await acknowledgeLicenseRenewalAlert(ctx)).status).toBe(401);
  });

  test('returns 403 without organizationId', async () => {
    const ctx = makeCtx({ organizationId: null, _params: { alertId: 'a1' } });
    expect((await acknowledgeLicenseRenewalAlert(ctx)).status).toBe(403);
  });

  test('throws NotFound for an unknown alert', async () => {
    stubRepo(LicenseRenewalAlertRepository, { findOneById: async () => null });
    const ctx = makeCtx({ _params: { alertId: 'missing' } });
    await expect(acknowledgeLicenseRenewalAlert(ctx)).rejects.toThrow(/LicenseRenewalAlert/i);
  });

  test('throws Conflict when alert already acknowledged', async () => {
    stubRepo(LicenseRenewalAlertRepository, { findOneById: async () => ({ id: 'a1', status: 'acknowledged' }) });
    const ctx = makeCtx({ _params: { alertId: 'a1' } });
    await expect(acknowledgeLicenseRenewalAlert(ctx)).rejects.toThrow(/already acknowledged/i);
  });

  test('sets status=acknowledged on happy path', async () => {
    stubRepo(LicenseRenewalAlertRepository, {
      findOneById: async () => ({ id: 'a1', status: 'pending' }),
      updateOneById: async (_id: string, patch: any) => ({ id: 'a1', ...patch }),
    });
    const ctx = makeCtx({ _params: { alertId: 'a1' } });
    const res = await acknowledgeLicenseRenewalAlert(ctx) as any;
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('acknowledged');
  });
});

describe('listLicenseRenewalAlerts', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _query: {} });
    expect((await listLicenseRenewalAlerts(ctx)).status).toBe(401);
  });

  test('returns paginated alerts scoped to the org with passthrough filters', async () => {
    let filters: any = null;
    stubRepo(LicenseRenewalAlertRepository, {
      findManyWithPagination: async (f: any) => { filters = f; return { data: [{ id: 'a1' }], totalCount: 1 }; },
    });
    const ctx = makeCtx({ _query: { status: 'pending', licenseId: 'lic-1' } });
    const res = await listLicenseRenewalAlerts(ctx) as any;
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(filters.organizationId).toBe('tenant-1');
    expect(filters.status).toBe('pending');
    expect(filters.licenseId).toBe('lic-1');
  });
});
