/**
 * Tests for requireOfficerMiddleware (P1.5).
 *
 * Replaces hand-rolled `OfficerTermRepository.findActiveByPersonAndOrg`
 * + "any term" checks in handlers, and `requireOfficerTerm()` from
 * utils/officer-check.ts. No title filter (any active officer term passes).
 */

import { describe, test, expect } from 'bun:test';
import { requireOfficerMiddleware } from './require-officer';
import type { GovernancePort } from '@/core/ports';

function makeCtx(overrides: Record<string, any> = {}) {
  const vars: Record<string, any> = {
    user: { id: 'user-1', twoFactorEnabled: true },
    database: {},
    ...overrides,
  };
  const paramValues: Record<string, string> = overrides['_params'] || { organizationId: 'org-1' };
  return {
    get: (key: string) => vars[key],
    set: (key: string, val: any) => { vars[key] = val; },
    req: { param: (key: string) => paramValues[key] || undefined },
  } as any;
}

function port(impl: GovernancePort['findActiveOfficerTermsByPersonAndOrg']): GovernancePort {
  return { findActiveOfficerTermsByPersonAndOrg: impl } as GovernancePort;
}

describe('requireOfficerMiddleware', () => {
  test('calls next() when any active officer term exists', async () => {
    const mw = requireOfficerMiddleware({
      governancePort: port(async () => [{ id: 't1', positionTitle: 'Member-at-Large' } as any]),
    });
    let called = false;
    await mw(makeCtx(), async () => { called = true; });
    expect(called).toBe(true);
  });

  test('throws ForbiddenError when no active officer terms', async () => {
    const mw = requireOfficerMiddleware({ governancePort: port(async () => []) });
    await expect(mw(makeCtx(), async () => {})).rejects.toThrow('Officer access required');
  });

  test('throws ForbiddenError when authentication missing', async () => {
    const mw = requireOfficerMiddleware({ governancePort: port(async () => []) });
    await expect(mw(makeCtx({ user: null }), async () => {})).rejects.toThrow('Authentication required');
  });

  test('throws ValidationError when organizationId missing', async () => {
    const mw = requireOfficerMiddleware({ governancePort: port(async () => []) });
    await expect(mw(makeCtx({ _params: {} }), async () => {})).rejects.toThrow('Missing organization context');
  });

  test('requires 2FA when officer holds a privileged position (production)', async () => {
    const old = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      const mw = requireOfficerMiddleware({
        governancePort: port(async () => [{ id: 't1', positionTitle: 'President' } as any]),
      });
      await expect(
        mw(makeCtx({ user: { id: 'user-1', twoFactorEnabled: false } }), async () => {}),
      ).rejects.toThrow('Two-factor authentication required');
    } finally {
      process.env['NODE_ENV'] = old;
    }
  });

  test('non-privileged officer position does not gate on 2FA', async () => {
    const old = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      const mw = requireOfficerMiddleware({
        governancePort: port(async () => [{ id: 't1', positionTitle: 'Member-at-Large' } as any]),
      });
      let called = false;
      await mw(makeCtx({ user: { id: 'user-1', twoFactorEnabled: false } }), async () => { called = true; });
      expect(called).toBe(true);
    } finally {
      process.env['NODE_ENV'] = old;
    }
  });

  test('falls back to ctx.organizationId when route lacks :organizationId', async () => {
    const mw = requireOfficerMiddleware({
      governancePort: port(async () => [{ id: 't1', positionTitle: 'Member-at-Large' } as any]),
    });
    let called = false;
    await mw(
      makeCtx({ _params: {}, organizationId: 'org-7' }),
      async () => { called = true; },
    );
    expect(called).toBe(true);
  });
});
