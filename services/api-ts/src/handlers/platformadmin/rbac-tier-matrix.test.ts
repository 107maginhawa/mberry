/**
 * RBAC tier matrix (AHA FIX-008 / G1) — drives the REAL platform-admin handlers
 * (not a test-local helper) to prove the Q1/Q8 permission matrix is enforced:
 *
 *   SUPER_ONLY      mutations: super ✓ / support ✗ / analyst ✗
 *   SUPPORT_OR_SUPER mutations: super ✓ / support ✓ / analyst ✗
 *   reads (analyst read-only, Q8): analyst ✓
 *
 * Denial is asserted as a 403 returned BEFORE any repo/DB work (the tier guard
 * short-circuits). "Allowed" is asserted as "not 403" — the handler proceeds
 * past the guard into its normal (stubbed) path.
 *
 * These representative handlers stand in for the full matrix listed in the
 * CONTINUE-48 plan; each handler shares the same `requireAdminTier` gate.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { AssociationRepository, FeatureFlagRepository } from './repos/platform-admin.repo';
import { createAssociation } from './createAssociation';
import { setFeatureFlag } from './setFeatureFlag';
import { updateAssociation } from './updateAssociation';
import { cancelSubscription } from './cancelSubscription';
import { updateTicketStatus } from './updateTicketStatus';
import { reportBreach } from './reportBreach';
import { getAdminRole } from './getAdminRole';

const FAKE_LOGGER = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, child: () => FAKE_LOGGER };

function ctxFor(role: string, extra: Record<string, any> = {}) {
  return makeCtx({
    user: { id: 'admin-1', role: 'platform_admin' },
    platformAdmin: { id: 'pa-1', userId: 'admin-1', role },
    logger: FAKE_LOGGER,
    ...extra,
  });
}

const PAST = new Date(Date.now() - 60 * 60 * 1000).toISOString();

afterEach(() => {
  restoreRepo(AssociationRepository);
  restoreRepo(FeatureFlagRepository);
});

// ── SUPER_ONLY ────────────────────────────────────────────────────────────

describe('RBAC matrix — SUPER_ONLY mutations', () => {
  function stubAssoc() {
    return stubRepo(AssociationRepository, {
      findByName: async () => undefined,
      create: async () => ({ id: 'a-1', name: 'X' }),
      findById: async () => ({ id: 'a-1', name: 'X' }),
      update: async () => ({ id: 'a-1', name: 'Y' }),
    });
  }
  function stubFlag() {
    return stubRepo(FeatureFlagRepository, { upsert: async () => ({ id: 'f-1' }) });
  }

  test('createAssociation: analyst denied (403)', async () => {
    stubAssoc();
    const res = await createAssociation(ctxFor('analyst', { _body: { name: 'X', country: 'PH', currency: 'PHP' } }));
    expect(res.status).toBe(403);
  });

  test('createAssociation: support denied (403)', async () => {
    stubAssoc();
    const res = await createAssociation(ctxFor('support', { _body: { name: 'X', country: 'PH', currency: 'PHP' } }));
    expect(res.status).toBe(403);
  });

  test('createAssociation: super allowed (not 403)', async () => {
    stubAssoc();
    const res = await createAssociation(ctxFor('super', { _body: { name: 'X', country: 'PH', currency: 'PHP' } }));
    expect(res.status).not.toBe(403);
  });

  test('setFeatureFlag: analyst denied (403)', async () => {
    stubFlag();
    const res = await setFeatureFlag(ctxFor('analyst', { _body: { targetType: 'organization', targetId: 'o-1', moduleName: 'events', enabled: true } }));
    expect(res.status).toBe(403);
  });

  test('setFeatureFlag: support denied (403)', async () => {
    stubFlag();
    const res = await setFeatureFlag(ctxFor('support', { _body: { targetType: 'organization', targetId: 'o-1', moduleName: 'events', enabled: true } }));
    expect(res.status).toBe(403);
  });

  test('setFeatureFlag: super allowed (200)', async () => {
    stubFlag();
    const res = await setFeatureFlag(ctxFor('super', { _body: { targetType: 'organization', targetId: 'o-1', moduleName: 'events', enabled: true } }));
    expect(res.status).toBe(200);
  });

  test('updateAssociation: analyst denied (403)', async () => {
    stubAssoc();
    const res = await updateAssociation(ctxFor('analyst', { _params: { associationId: 'a-1' }, _body: { name: 'Y' } }));
    expect(res.status).toBe(403);
  });

  test('updateAssociation: support denied (403)', async () => {
    stubAssoc();
    const res = await updateAssociation(ctxFor('support', { _params: { associationId: 'a-1' }, _body: { name: 'Y' } }));
    expect(res.status).toBe(403);
  });

  test('cancelSubscription: analyst denied (403)', async () => {
    const res = await cancelSubscription(ctxFor('analyst', { _params: { id: 's-1' }, _body: { reason: 'x' } }));
    expect(res.status).toBe(403);
  });

  test('cancelSubscription: support denied (403)', async () => {
    const res = await cancelSubscription(ctxFor('support', { _params: { id: 's-1' }, _body: { reason: 'x' } }));
    expect(res.status).toBe(403);
  });
});

// ── SUPPORT_OR_SUPER ──────────────────────────────────────────────────────

describe('RBAC matrix — SUPPORT_OR_SUPER mutations', () => {
  test('updateTicketStatus: analyst denied (403)', async () => {
    const res = await updateTicketStatus(ctxFor('analyst', { _params: { id: 't-1' }, _body: { status: 'in_progress' } }));
    expect(res.status).toBe(403);
  });

  test('updateTicketStatus: support allowed (not 403)', async () => {
    const res = await updateTicketStatus(ctxFor('support', { _params: { id: 't-1' }, _body: { status: 'in_progress' } }));
    expect(res.status).not.toBe(403);
  });

  test('reportBreach: analyst denied (403)', async () => {
    const res = await reportBreach(ctxFor('analyst', { _body: { discoveredAt: PAST, description: 'leak' } }));
    expect(res.status).toBe(403);
  });

  test('reportBreach: support allowed (not 403)', async () => {
    const res = await reportBreach(ctxFor('support', { _body: { discoveredAt: PAST, description: 'leak' } }));
    expect(res.status).not.toBe(403);
  });
});

// ── reads (Q8 analyst read-only) ──────────────────────────────────────────

describe('RBAC matrix — reads stay open to analyst', () => {
  test('getAdminRole: analyst allowed (not 403)', async () => {
    const res = await getAdminRole(ctxFor('analyst'));
    expect(res.status).not.toBe(403);
  });
});
