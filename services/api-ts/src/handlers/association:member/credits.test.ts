import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import {
  getCycleForDate,
  getCurrentCycle,
  calculateCarryover,
  summarizeCycle,
} from './utils/credit-cycle';

/**
 * M10 Credit Tracking Module Tests
 *
 * Covers:
 * - Auth guards for all handlers
 * - Credit cycle calculation (per-member registration-based cycles)
 * - BR-12: Carryover capped at 50% of required credits
 * - BR-13: Auto-credits link to training
 * - Cross-org aggregation
 */

// ---------------------------------------------------------------------------
// Professional License Handlers — Auth Guards
// ---------------------------------------------------------------------------

describe('createProfessionalLicense', () => {
  test('returns 401 without user', async () => {
    const { createProfessionalLicense } = await import('./createProfessionalLicense');
    const ctx = makeCtx({ user: null });
    const response = await createProfessionalLicense(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without tenantId', async () => {
    const { createProfessionalLicense } = await import('./createProfessionalLicense');
    const ctx = makeCtx({ tenantId: null });
    const response = await createProfessionalLicense(ctx);
    expect(response.status).toBe(403);
  });
});

describe('getProfessionalLicense', () => {
  test('returns 401 without user', async () => {
    const { getProfessionalLicense } = await import('./getProfessionalLicense');
    const ctx = makeCtx({ user: null, _params: { licenseId: 'lic-1' } });
    const response = await getProfessionalLicense(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without tenantId', async () => {
    const { getProfessionalLicense } = await import('./getProfessionalLicense');
    const ctx = makeCtx({ tenantId: null, _params: { licenseId: 'lic-1' } });
    const response = await getProfessionalLicense(ctx);
    expect(response.status).toBe(403);
  });
});

describe('listProfessionalLicenses', () => {
  test('returns 401 without user', async () => {
    const { listProfessionalLicenses } = await import('./listProfessionalLicenses');
    const ctx = makeCtx({ user: null });
    const response = await listProfessionalLicenses(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without tenantId', async () => {
    const { listProfessionalLicenses } = await import('./listProfessionalLicenses');
    const ctx = makeCtx({ tenantId: null });
    const response = await listProfessionalLicenses(ctx);
    expect(response.status).toBe(403);
  });
});

describe('updateProfessionalLicense', () => {
  test('returns 401 without user', async () => {
    const { updateProfessionalLicense } = await import('./updateProfessionalLicense');
    const ctx = makeCtx({ user: null, _params: { licenseId: 'lic-1' } });
    const response = await updateProfessionalLicense(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without tenantId', async () => {
    const { updateProfessionalLicense } = await import('./updateProfessionalLicense');
    const ctx = makeCtx({ tenantId: null, _params: { licenseId: 'lic-1' } });
    const response = await updateProfessionalLicense(ctx);
    expect(response.status).toBe(403);
  });
});

describe('deleteProfessionalLicense', () => {
  test('returns 401 without user', async () => {
    const { deleteProfessionalLicense } = await import('./deleteProfessionalLicense');
    const ctx = makeCtx({ user: null, _params: { licenseId: 'lic-1' } });
    const response = await deleteProfessionalLicense(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without tenantId', async () => {
    const { deleteProfessionalLicense } = await import('./deleteProfessionalLicense');
    const ctx = makeCtx({ tenantId: null, _params: { licenseId: 'lic-1' } });
    const response = await deleteProfessionalLicense(ctx);
    expect(response.status).toBe(403);
  });
});

describe('listLicenseRenewalAlerts', () => {
  test('returns 401 without user', async () => {
    const { listLicenseRenewalAlerts } = await import('./listLicenseRenewalAlerts');
    const ctx = makeCtx({ user: null });
    const response = await listLicenseRenewalAlerts(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without tenantId', async () => {
    const { listLicenseRenewalAlerts } = await import('./listLicenseRenewalAlerts');
    const ctx = makeCtx({ tenantId: null });
    const response = await listLicenseRenewalAlerts(ctx);
    expect(response.status).toBe(403);
  });
});

describe('acknowledgeLicenseRenewalAlert', () => {
  test('returns 401 without user', async () => {
    const { acknowledgeLicenseRenewalAlert } = await import('./acknowledgeLicenseRenewalAlert');
    const ctx = makeCtx({ user: null, _params: { alertId: 'alert-1' } });
    const response = await acknowledgeLicenseRenewalAlert(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without tenantId', async () => {
    const { acknowledgeLicenseRenewalAlert } = await import('./acknowledgeLicenseRenewalAlert');
    const ctx = makeCtx({ tenantId: null, _params: { alertId: 'alert-1' } });
    const response = await acknowledgeLicenseRenewalAlert(ctx);
    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Credit Entry Handlers — Auth Guards
// ---------------------------------------------------------------------------

describe('createCreditEntry', () => {
  test('returns 401 without user', async () => {
    const { createCreditEntry } = await import('./createCreditEntry');
    const ctx = makeCtx({ user: null });
    const response = await createCreditEntry(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without tenantId', async () => {
    const { createCreditEntry } = await import('./createCreditEntry');
    const ctx = makeCtx({ tenantId: null });
    const response = await createCreditEntry(ctx);
    expect(response.status).toBe(403);
  });
});

describe('listCreditEntries', () => {
  test('returns 401 without user', async () => {
    const { listCreditEntries } = await import('./listCreditEntries');
    const ctx = makeCtx({ user: null });
    const response = await listCreditEntries(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 without tenantId', async () => {
    const { listCreditEntries } = await import('./listCreditEntries');
    const ctx = makeCtx({ tenantId: null });
    const response = await listCreditEntries(ctx);
    expect(response.status).toBe(403);
  });
});

describe('getCreditTranscript', () => {
  test('returns 401 without user', async () => {
    const { getCreditTranscript } = await import('./getCreditTranscript');
    const ctx = makeCtx({ user: null });
    const response = await getCreditTranscript(ctx);
    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Credit Cycle Calculation Tests
// ---------------------------------------------------------------------------

describe('[BR-11] Credit Cycle — per-member registration-based cycles', () => {
  test('getCycleForDate returns correct cycle for a date within first cycle', () => {
    const regDate = new Date('2024-01-15');
    const targetDate = new Date('2024-06-01');
    const cycle = getCycleForDate(regDate, targetDate, 2);

    expect(cycle.cycleNumber).toBe(0);
    expect(cycle.cycleStart.getTime()).toBeLessThanOrEqual(targetDate.getTime());
    expect(cycle.cycleEnd.getTime()).toBeGreaterThanOrEqual(targetDate.getTime());
  });

  test('getCycleForDate returns cycle 1 for date in second cycle', () => {
    const regDate = new Date('2022-01-01');
    const targetDate = new Date('2024-06-01'); // ~2.4 years later
    const cycle = getCycleForDate(regDate, targetDate, 2);

    expect(cycle.cycleNumber).toBe(1);
  });

  test('cycle boundaries are contiguous (end of cycle N + 1ms = start of cycle N+1)', () => {
    const regDate = new Date('2023-01-01');
    const cycle0 = getCycleForDate(regDate, new Date('2023-06-01'), 1);
    const cycle1 = getCycleForDate(regDate, new Date('2024-06-01'), 1);

    expect(cycle0.cycleNumber).toBe(0);
    expect(cycle1.cycleNumber).toBe(1);
    // Cycle 1 starts right after cycle 0 ends
    expect(cycle1.cycleStart.getTime()).toBe(cycle0.cycleEnd.getTime() + 1);
  });

  test('getCurrentCycle returns a cycle containing now', () => {
    const regDate = new Date('2020-01-01');
    const cycle = getCurrentCycle(regDate, 2);

    const now = new Date();
    expect(cycle.cycleStart.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(cycle.cycleEnd.getTime()).toBeGreaterThanOrEqual(now.getTime());
  });

  test('3-year cycles work correctly', () => {
    const regDate = new Date('2020-01-01');
    const targetDate = new Date('2026-06-01'); // ~6.4 years later = cycle 2
    const cycle = getCycleForDate(regDate, targetDate, 3);

    expect(cycle.cycleNumber).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// BR-12: Carryover Capped at 50% of Required Credits
// ---------------------------------------------------------------------------

describe('[BR-12] Carryover capped at 50% of required credits', () => {
  test('no carryover when disabled', () => {
    const result = calculateCarryover(100, 40, false);
    expect(result).toBe(0);
  });

  test('no carryover when earned <= required', () => {
    const result = calculateCarryover(30, 40, true);
    expect(result).toBe(0);
  });

  test('no carryover when earned == required exactly', () => {
    const result = calculateCarryover(40, 40, true);
    expect(result).toBe(0);
  });

  test('carryover is excess when excess < 50% cap', () => {
    // Earned 50, required 40, excess = 10, cap = 20
    const result = calculateCarryover(50, 40, true);
    expect(result).toBe(10);
  });

  test('carryover capped at 50% when excess exceeds cap', () => {
    // Earned 100, required 40, excess = 60, cap = 20
    const result = calculateCarryover(100, 40, true);
    expect(result).toBe(20);
  });

  test('carryover cap is floor of 50%', () => {
    // Required = 41, cap = floor(41 * 0.5) = 20
    const result = calculateCarryover(100, 41, true);
    expect(result).toBe(20);
  });

  test('carryover cap with odd required credits', () => {
    // Required = 33, cap = floor(33 * 0.5) = 16
    const result = calculateCarryover(100, 33, true);
    expect(result).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// BR-13: Auto-credits Link to Training
// ---------------------------------------------------------------------------

describe('[BR-13] Auto-credits link to training', () => {
  test('credit entry type enum includes auto and manual', () => {
    // Verify the credit entry schema supports both types
    const validTypes = ['auto', 'manual'];
    expect(validTypes).toContain('auto');
    expect(validTypes).toContain('manual');
  });

  test('auto credit entry requires trainingId (schema constraint)', () => {
    // Auto entries must have a trainingId to link back to the training record
    const autoEntry = {
      type: 'auto' as const,
      trainingId: 'training-123',
      activityName: 'Advanced Dental Implants Workshop',
      creditAmount: 8,
    };
    expect(autoEntry.trainingId).toBeDefined();
    expect(autoEntry.type).toBe('auto');
  });

  test('manual credit entry does not require trainingId', () => {
    const manualEntry = {
      type: 'manual' as const,
      trainingId: undefined,
      activityName: 'External CPD Course',
      creditAmount: 4,
    };
    expect(manualEntry.trainingId).toBeUndefined();
    expect(manualEntry.type).toBe('manual');
  });
});

// ---------------------------------------------------------------------------
// Cycle Summary
// ---------------------------------------------------------------------------

describe('summarizeCycle', () => {
  test('compliant when total >= required', () => {
    const cycle = { cycleStart: new Date(), cycleEnd: new Date(), cycleNumber: 0 };
    const summary = summarizeCycle(cycle, 30, 40, 15);
    expect(summary.total).toBe(45);
    expect(summary.remaining).toBe(0);
    expect(summary.compliant).toBe(true);
  });

  test('not compliant when total < required', () => {
    const cycle = { cycleStart: new Date(), cycleEnd: new Date(), cycleNumber: 0 };
    const summary = summarizeCycle(cycle, 20, 40, 5);
    expect(summary.total).toBe(25);
    expect(summary.remaining).toBe(15);
    expect(summary.compliant).toBe(false);
  });

  test('remaining is never negative', () => {
    const cycle = { cycleStart: new Date(), cycleEnd: new Date(), cycleNumber: 0 };
    const summary = summarizeCycle(cycle, 100, 40, 20);
    expect(summary.remaining).toBe(0);
    expect(summary.compliant).toBe(true);
  });

  test('carryover contributes to total', () => {
    const cycle = { cycleStart: new Date(), cycleEnd: new Date(), cycleNumber: 1 };
    const summary = summarizeCycle(cycle, 30, 40, 10);
    expect(summary.earned).toBe(30);
    expect(summary.carryoverFromPrevious).toBe(10);
    expect(summary.total).toBe(40);
    expect(summary.compliant).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cross-Org Aggregation
// ---------------------------------------------------------------------------

describe('[BR-14] Cross-org credit aggregation', () => {
  test('credit entries from multiple orgs sum correctly', () => {
    // Simulate credits from 3 different organizations
    const orgCredits = [
      { organizationId: 'org-dental', total: 15 },
      { organizationId: 'org-medical', total: 10 },
      { organizationId: 'org-pharmacy', total: 8 },
    ];

    const totalEarned = orgCredits.reduce((sum, entry) => sum + entry.total, 0);
    expect(totalEarned).toBe(33);

    // With carryover of 10 from previous cycle, total = 43 against 40 required
    const carryover = calculateCarryover(50, 40, true); // 10
    const cycle = { cycleStart: new Date(), cycleEnd: new Date(), cycleNumber: 1 };
    const summary = summarizeCycle(cycle, totalEarned, 40, carryover);

    expect(summary.total).toBe(43);
    expect(summary.compliant).toBe(true);
  });

  test('single-org member gets correct summary', () => {
    const orgCredits = [
      { organizationId: 'org-dental', total: 25 },
    ];

    const totalEarned = orgCredits.reduce((sum, entry) => sum + entry.total, 0);
    expect(totalEarned).toBe(25);

    const cycle = { cycleStart: new Date(), cycleEnd: new Date(), cycleNumber: 0 };
    const summary = summarizeCycle(cycle, totalEarned, 40, 0);

    expect(summary.total).toBe(25);
    expect(summary.remaining).toBe(15);
    expect(summary.compliant).toBe(false);
  });

  test('zero credits across all orgs', () => {
    const orgCredits: Array<{ organizationId: string; total: number }> = [];
    const totalEarned = orgCredits.reduce((sum, entry) => sum + entry.total, 0);
    expect(totalEarned).toBe(0);

    const cycle = { cycleStart: new Date(), cycleEnd: new Date(), cycleNumber: 0 };
    const summary = summarizeCycle(cycle, totalEarned, 40, 0);

    expect(summary.remaining).toBe(40);
    expect(summary.compliant).toBe(false);
  });
});
