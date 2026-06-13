/**
 * Auth Gate Coverage — REAL enforcement tests (AHA FIX-007 rewrite).
 *
 * Business Rules: BR-02, BR-04, BR-11, BR-33, BR-34 (RBAC enforcement subset).
 *
 * HISTORY: This file previously defined pure permission functions
 * (`canPublishAnnouncement`, `canApproveInvoice`, `canTransitionOrgStatus`,
 * `canPreviewTemplate`, `isWriteBlocked`, …) *inside the test file itself*
 * and asserted against those local copies. That was fake-green coverage —
 * it proved nothing about `src` (gap plan G7 / FIX-007). The matrix could
 * drift arbitrarily from production and these tests would still pass.
 *
 * It now binds every assertion to the REAL enforcement primitives in `src`:
 *   - core/auth/officer-checks.ts  → requireOfficerTerm / requirePosition
 *   - handlers/platformadmin/*     → super-only platform mutations (FIX-001)
 *   - middleware/impersonation-guard.ts → impersonationWriteBlock
 *
 * If a real gate is weakened or removed, these tests fail.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { requireOfficerTerm, requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';
import { transitionOrgStatus } from '@/handlers/platformadmin/transitionOrgStatus';
import { setFeatureFlag } from '@/handlers/platformadmin/setFeatureFlag';
import { OrganizationRepository, FeatureFlagRepository } from '@/handlers/platformadmin/repos/platform-admin.repo';
import { impersonationWriteBlock } from '@/middleware/impersonation-guard';
import { ForbiddenError } from '@/core/errors';

const SUPER_ADMIN = { id: 'pa-1', userId: 'admin-1', role: 'super' };

// ─── 1. Officer term gate (requireOfficerTerm) ──────────────────────────────
//
// BR-09: officer-only endpoints. The REAL gate is requireOfficerTerm, which
// reads active officer terms from the governance DB (never client role).

describe('[REAL] requireOfficerTerm — officer-only gate', () => {
  let mocks: Record<string, { mockRestore: () => void }>;
  beforeEach(() => restoreRepo(OfficerTermRepository));
  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(OfficerTermRepository);
  });

  test('member with no active officer term → 403', async () => {
    mocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({ user: { id: 'm1', role: 'member', twoFactorEnabled: true } });
    const result = await requireOfficerTerm(ctx as any);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  test('officer with active term → allowed', async () => {
    mocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 't1', positionTitle: POSITION_TITLES.BOARD_MEMBER }],
    });
    const ctx = makeCtx({ user: { id: 'o1', role: 'officer', twoFactorEnabled: true } });
    expect(await requireOfficerTerm(ctx as any)).toBeNull();
  });

  test('unauthenticated caller → 401', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const result = await requireOfficerTerm(ctx as any);
    expect(result!.status).toBe(401);
  });
});

// ─── 2. 2FA enforcement for privileged officer titles (FIX-002) ─────────────
//
// P1-3 / Matrix §4: President/Treasurer/Secretary must have 2FA in production.

describe('[REAL] requireOfficerTerm — 2FA for privileged titles', () => {
  let mocks: Record<string, { mockRestore: () => void }>;
  beforeEach(() => restoreRepo(OfficerTermRepository));
  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(OfficerTermRepository);
  });

  test('President without 2FA in production → 403', async () => {
    const old = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      mocks = stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [{ id: 't1', positionTitle: POSITION_TITLES.PRESIDENT }],
      });
      const ctx = makeCtx({ user: { id: 'p1', role: 'user', twoFactorEnabled: false } });
      const result = await requireOfficerTerm(ctx as any);
      expect(result!.status).toBe(403);
    } finally {
      process.env['NODE_ENV'] = old;
    }
  });

  test('President with 2FA in production → allowed', async () => {
    const old = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      mocks = stubRepo(OfficerTermRepository, {
        findActiveByPersonAndOrg: async () => [{ id: 't1', positionTitle: POSITION_TITLES.PRESIDENT }],
      });
      const ctx = makeCtx({ user: { id: 'p1', role: 'user', twoFactorEnabled: true } });
      expect(await requireOfficerTerm(ctx as any)).toBeNull();
    } finally {
      process.env['NODE_ENV'] = old;
    }
  });
});

// ─── 3. Position-title gate (requirePosition) ───────────────────────────────
//
// Announcement publish (scheduleAnnouncement) is gated to President/Secretary
// via requirePosition. This is the REAL gate the old canPublishAnnouncement
// pure function was faking.

describe('[REAL] requirePosition — announcement publish gate (President/Secretary)', () => {
  let mocks: Record<string, { mockRestore: () => void }>;
  const ALLOWED = [POSITION_TITLES.PRESIDENT, POSITION_TITLES.SECRETARY];
  beforeEach(() => restoreRepo(OfficerTermRepository));
  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(OfficerTermRepository);
  });

  test('Secretary → allowed', async () => {
    mocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 't1', positionTitle: POSITION_TITLES.SECRETARY }],
    });
    const ctx = makeCtx({ user: { id: 's1', role: 'user', twoFactorEnabled: true } });
    expect(await requirePosition(ctx as any, ALLOWED)).toBeNull();
  });

  test('Treasurer (wrong title) → 403', async () => {
    mocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 't1', positionTitle: POSITION_TITLES.TREASURER }],
    });
    const ctx = makeCtx({ user: { id: 't1', role: 'user', twoFactorEnabled: true } });
    const result = await requirePosition(ctx as any, ALLOWED);
    expect(result!.status).toBe(403);
  });

  test('plain member (no term) → 403', async () => {
    mocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({ user: { id: 'm1', role: 'member', twoFactorEnabled: true } });
    const result = await requirePosition(ctx as any, ALLOWED);
    expect(result!.status).toBe(403);
  });

  test('case-insensitive title match (D-08): "secretary" → allowed', async () => {
    mocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 't1', positionTitle: 'secretary' }],
    });
    const ctx = makeCtx({ user: { id: 's1', role: 'user', twoFactorEnabled: true } });
    expect(await requirePosition(ctx as any, ALLOWED)).toBeNull();
  });
});

// ─── 4. Super-only platform mutations (FIX-001) ─────────────────────────────
//
// Matrix §3.7: transition org status / feature flags = super only. The REAL
// gate lives in the handlers (createAssociation-style role check), which the
// old canTransitionOrgStatus pure function was faking.

describe('[REAL] transitionOrgStatus — super-only platform mutation', () => {
  let mocks: ReturnType<typeof stubRepo>;
  afterEach(() => { if (mocks) Object.values(mocks).forEach((m) => m.mockRestore()); });

  function org(status: string) {
    return { id: 'org-1', associationId: 'a1', name: 'Org', slug: 'org', status, orgType: 'chapter', updatedAt: new Date(), createdAt: new Date() };
  }

  test('analyst → 403', async () => {
    mocks = stubRepo(OrganizationRepository, { findById: async () => org('trial'), update: async () => org('active') });
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: { id: 'pa-1', userId: 'admin-1', role: 'analyst' },
      _params: { organizationId: 'org-1' },
      _body: { status: 'active' },
    });
    const res = await transitionOrgStatus(ctx);
    expect(res.status).toBe(403);
  });

  test('super → 200', async () => {
    mocks = stubRepo(OrganizationRepository, { findById: async () => org('trial'), update: async () => org('active') });
    const ctx = makeCtx({ platformAdmin: SUPER_ADMIN, _params: { organizationId: 'org-1' }, _body: { status: 'active' } });
    const res = await transitionOrgStatus(ctx);
    expect(res.status).toBe(200);
  });
});

describe('[REAL] setFeatureFlag — super-only platform mutation', () => {
  let mocks: ReturnType<typeof stubRepo>;
  afterEach(() => { if (mocks) Object.values(mocks).forEach((m) => m.mockRestore()); });

  test('support → 403', async () => {
    mocks = stubRepo(FeatureFlagRepository, { upsert: async () => ({ id: 'f1', moduleName: 'billing', enabled: true }) });
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: { id: 'pa-1', userId: 'admin-1', role: 'support' },
      _body: { targetType: 'org', targetId: 'org-1', moduleName: 'billing', enabled: true },
    });
    const res = await setFeatureFlag(ctx);
    expect(res.status).toBe(403);
  });

  test('super → 200', async () => {
    mocks = stubRepo(FeatureFlagRepository, { upsert: async () => ({ id: 'f1', moduleName: 'billing', enabled: true }) });
    const ctx = makeCtx({ platformAdmin: SUPER_ADMIN, _body: { targetType: 'org', targetId: 'org-1', moduleName: 'billing', enabled: true } });
    const res = await setFeatureFlag(ctx);
    expect(res.status).toBe(200);
  });
});

// ─── 5. Impersonation write-block (real middleware) ─────────────────────────
//
// Replaces the old isWriteBlocked pure function with the real
// impersonationWriteBlock middleware from middleware/impersonation-guard.ts.

describe('[REAL] impersonationWriteBlock — read-only during impersonation', () => {
  function ctxFor(method: string, impersonating: boolean) {
    const vars: Record<string, any> = {
      impersonationSession: impersonating ? { id: 'imp-1', adminId: 'a1', targetUserId: 'u1' } : undefined,
    };
    return {
      get: (k: string) => vars[k],
      set: (k: string, v: any) => { vars[k] = v; },
      req: { method },
    } as any;
  }

  test('POST while impersonating → ForbiddenError', async () => {
    const mw = impersonationWriteBlock();
    await expect(mw(ctxFor('POST', true), async () => {})).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('DELETE while impersonating → ForbiddenError', async () => {
    const mw = impersonationWriteBlock();
    await expect(mw(ctxFor('DELETE', true), async () => {})).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('GET while impersonating → allowed (next called)', async () => {
    const mw = impersonationWriteBlock();
    let called = false;
    await mw(ctxFor('GET', true), async () => { called = true; });
    expect(called).toBe(true);
  });

  test('POST while NOT impersonating → allowed (next called)', async () => {
    const mw = impersonationWriteBlock();
    let called = false;
    await mw(ctxFor('POST', false), async () => { called = true; });
    expect(called).toBe(true);
  });
});
