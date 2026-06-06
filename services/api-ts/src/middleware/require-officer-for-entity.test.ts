/**
 * Tests for requireOfficerForEntityMiddleware (P1.5 Bucket F).
 *
 * Replaces the dominant hand-rolled Bucket F pattern:
 *   const entity = await repo.findOneById(entityId);
 *   if (!entity) throw new NotFoundError(...);
 *   const denied = await requirePosition(ctx, [...], entity.organizationId);
 *   if (denied) return denied;
 *
 * Middleware runs AFTER path/body validators (loader needs the param) and
 * BEFORE the handler. Same 2FA enforcement as requireOfficerMiddleware.
 */

import { describe, test, expect } from 'bun:test';
import { requireOfficerForEntityMiddleware } from './require-officer-for-entity';
import type { GovernancePort } from '@/core/ports';

function makeCtx(overrides: Record<string, any> = {}) {
  const vars: Record<string, any> = {
    user: { id: 'user-1', twoFactorEnabled: true },
    database: {},
    ...overrides,
  };
  const paramValues: Record<string, string> = overrides['_params'] || { documentId: 'doc-1' };
  return {
    get: (key: string) => vars[key],
    set: (key: string, val: any) => { vars[key] = val; },
    req: { param: (key: string) => paramValues[key] || undefined },
  } as any;
}

function port(impl: GovernancePort['findActiveOfficerTermsByPersonAndOrg']): GovernancePort {
  return { findActiveOfficerTermsByPersonAndOrg: impl } as GovernancePort;
}

describe('requireOfficerForEntityMiddleware', () => {
  test('loads entity, extracts orgId, calls next() when officer term exists', async () => {
    const mw = requireOfficerForEntityMiddleware({
      entityIdParam: 'documentId',
      loadOrgIdFromEntity: async () => 'org-7',
      governancePort: port(async () => [{ id: 't1', positionTitle: 'Member-at-Large' } as any]),
    });
    let called = false;
    await mw(makeCtx(), async () => { called = true; });
    expect(called).toBe(true);
  });

  test('throws NotFoundError when loader returns null', async () => {
    const mw = requireOfficerForEntityMiddleware({
      entityIdParam: 'documentId',
      loadOrgIdFromEntity: async () => null,
      governancePort: port(async () => []),
    });
    await expect(mw(makeCtx(), async () => {})).rejects.toThrow(/not found/i);
  });

  test('throws ForbiddenError when no officer term for derived org', async () => {
    const mw = requireOfficerForEntityMiddleware({
      entityIdParam: 'documentId',
      loadOrgIdFromEntity: async () => 'org-7',
      governancePort: port(async () => []),
    });
    await expect(mw(makeCtx(), async () => {})).rejects.toThrow('Officer access required');
  });

  test('throws ValidationError when entity id param missing', async () => {
    const mw = requireOfficerForEntityMiddleware({
      entityIdParam: 'documentId',
      loadOrgIdFromEntity: async () => null,
      governancePort: port(async () => []),
    });
    await expect(mw(makeCtx({ _params: {} }), async () => {})).rejects.toThrow(/Missing/);
  });

  test('throws ForbiddenError when authentication missing', async () => {
    const mw = requireOfficerForEntityMiddleware({
      entityIdParam: 'documentId',
      loadOrgIdFromEntity: async () => 'org-7',
      governancePort: port(async () => []),
    });
    await expect(mw(makeCtx({ user: null }), async () => {})).rejects.toThrow('Authentication required');
  });

  test('enforces 2FA when officer holds privileged position in production', async () => {
    const old = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      const mw = requireOfficerForEntityMiddleware({
        entityIdParam: 'documentId',
        loadOrgIdFromEntity: async () => 'org-7',
        governancePort: port(async () => [{ id: 't1', positionTitle: 'President' } as any]),
      });
      await expect(
        mw(makeCtx({ user: { id: 'user-1', twoFactorEnabled: false } }), async () => {}),
      ).rejects.toThrow('Two-factor');
    } finally { process.env['NODE_ENV'] = old; }
  });

  test('propagates loader errors', async () => {
    const mw = requireOfficerForEntityMiddleware({
      entityIdParam: 'documentId',
      loadOrgIdFromEntity: async () => { throw new Error('db down'); },
      governancePort: port(async () => []),
    });
    await expect(mw(makeCtx(), async () => {})).rejects.toThrow('db down');
  });

  test('supports custom entity id param name', async () => {
    const mw = requireOfficerForEntityMiddleware({
      entityIdParam: 'trainingId',
      loadOrgIdFromEntity: async () => 'org-7',
      governancePort: port(async () => [{ id: 't1', positionTitle: 'Member-at-Large' } as any]),
    });
    let called = false;
    await mw(makeCtx({ _params: { trainingId: 'tr-1' } }), async () => { called = true; });
    expect(called).toBe(true);
  });

  test('respects dev-mode 2FA bypass for privileged positions', async () => {
    const old = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'development';
    try {
      const mw = requireOfficerForEntityMiddleware({
        entityIdParam: 'documentId',
        loadOrgIdFromEntity: async () => 'org-7',
        governancePort: port(async () => [{ id: 't1', positionTitle: 'Treasurer' } as any]),
      });
      let called = false;
      await mw(makeCtx({ user: { id: 'user-1', twoFactorEnabled: false } }), async () => { called = true; });
      expect(called).toBe(true);
    } finally { process.env['NODE_ENV'] = old; }
  });
});
