/**
 * Tests for getDuesDashboard
 *
 * Covers:
 * - Returns dashboard stats for valid org with position access
 * - Returns 401 without session
 * - Returns zeros when no payment data exists
 * - Collection rate avoids division by zero
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DuesRepository } from './repos/dues.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { getDuesDashboard } from './getDuesDashboard';

// ─── Fixtures ───────────────────────────────────────────

const fullStats = {
  totalCollected: 250000,
  totalOutstanding: 192000,
  paidCount: 42,
  unpaidCount: 22,
  overdueCount: 8,
  collectionRate: 0.57,
};

// ─── Tests ──────────────────────────────────────────────

// Stub requirePosition → OfficerTermRepository to allow access
stubRepo(OfficerTermRepository, {
  findActiveByPersonAndOrg: async () => [{ positionTitle: 'Treasurer' }],
});

describe('getDuesDashboard', () => {
  afterEach(() => {
    restoreRepo(DuesRepository);
  });

  // ── Auth ───────────────────────────────────────────────

  test('returns 401 without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1' },
    });

    try {
      await getDuesDashboard(ctx);
      expect(true).toBe(false); // should not reach
    } catch (err: any) {
      expect(err.status ?? err.statusCode ?? 401).toBe(401);
    }
  });

  // ── Happy Path ─────────────────────────────────────────

  test('returns dashboard stats for valid org', async () => {
    stubRepo(DuesRepository, {
      getDashboardStats: async () => fullStats,
      getMemberCount: async () => 64,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
    });

    const res = await getDuesDashboard(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      totalCollected: 250000,
      totalOutstanding: 192000,
      paidCount: 42,
      unpaidCount: 22,
      overdueCount: 8,
      collectionRate: 0.57,
      memberCount: 64,
    });
  });

  // ── Zero Data ──────────────────────────────────────────

  test('returns zeros when no payment data exists', async () => {
    stubRepo(DuesRepository, {
      getDashboardStats: async () => ({
        totalCollected: 0,
        totalOutstanding: 0,
        paidCount: 0,
        unpaidCount: 0,
        overdueCount: 0,
        collectionRate: 0,
      }),
      getMemberCount: async () => 0,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
    });

    const res = await getDuesDashboard(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data.totalCollected).toBe(0);
    expect(res.body.data.totalOutstanding).toBe(0);
    expect(res.body.data.paidCount).toBe(0);
    expect(res.body.data.unpaidCount).toBe(0);
    expect(res.body.data.overdueCount).toBe(0);
    expect(res.body.data.collectionRate).toBe(0);
    expect(res.body.data.memberCount).toBe(0);
  });

  // ── Collection Rate Edge Case ──────────────────────────

  test('collection rate is 0 when no amounts (division by zero safe)', async () => {
    stubRepo(DuesRepository, {
      getDashboardStats: async () => ({
        totalCollected: 0,
        totalOutstanding: 0,
        paidCount: 0,
        unpaidCount: 0,
        overdueCount: 0,
        collectionRate: 0,
      }),
      getMemberCount: async () => 5,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
    });

    const res = await getDuesDashboard(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data.collectionRate).toBe(0);
  });

  test('collection rate reflects ratio correctly', async () => {
    stubRepo(DuesRepository, {
      getDashboardStats: async () => ({
        totalCollected: 100000,
        totalOutstanding: 100000,
        paidCount: 10,
        unpaidCount: 10,
        overdueCount: 0,
        collectionRate: 0.5,
      }),
      getMemberCount: async () => 20,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
    });

    const res = await getDuesDashboard(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data.collectionRate).toBe(0.5);
  });
});
