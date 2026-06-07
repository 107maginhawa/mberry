/**
 * Tests for requirePositionMiddleware (P1.5).
 *
 * Replaces hand-called `requirePosition()` from utils/officer-check.ts.
 * Uses an injectable GovernancePort fake instead of stubbing the repo,
 * mirroring the dep-injection style used by officerAuthMiddleware deps.
 */

import { describe, test, expect } from 'bun:test';
import { requirePositionMiddleware } from './require-position';
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

describe('requirePositionMiddleware', () => {
  test('calls next() when officer holds an allowed position title', async () => {
    const mw = requirePositionMiddleware({
      titles: ['Member-at-Large'],
      governancePort: port(async () => [{ id: 't1', positionTitle: 'Member-at-Large' } as any]),
    });
    let called = false;
    await mw(makeCtx(), async () => { called = true; });
    expect(called).toBe(true);
  });

  test('throws ForbiddenError when officer has no matching title', async () => {
    const mw = requirePositionMiddleware({
      titles: ['Treasurer'],
      governancePort: port(async () => [{ id: 't1', positionTitle: 'Secretary' } as any]),
    });
    // Secretary requires 2FA but user has it; expect title mismatch denial, not 2FA.
    await expect(mw(makeCtx(), async () => {})).rejects.toThrow('Position access denied');
  });

  test('throws ForbiddenError when no active officer terms', async () => {
    const mw = requirePositionMiddleware({
      titles: ['Treasurer'],
      governancePort: port(async () => []),
    });
    await expect(mw(makeCtx(), async () => {})).rejects.toThrow('Officer access required');
  });

  test('throws ForbiddenError when authentication missing', async () => {
    const mw = requirePositionMiddleware({
      titles: ['Treasurer'],
      governancePort: port(async () => []),
    });
    await expect(mw(makeCtx({ user: null }), async () => {})).rejects.toThrow('Authentication required');
  });

  test('throws ValidationError when organizationId missing', async () => {
    const mw = requirePositionMiddleware({
      titles: ['Treasurer'],
      governancePort: port(async () => []),
    });
    await expect(mw(makeCtx({ _params: {} }), async () => {})).rejects.toThrow('Missing organization context');
  });

  test('case-insensitive title match', async () => {
    const mw = requirePositionMiddleware({
      titles: ['Treasurer'],
      governancePort: port(async () => [{ id: 't1', positionTitle: 'treasurer' } as any]),
    });
    let called = false;
    await mw(makeCtx(), async () => { called = true; });
    expect(called).toBe(true);
  });

  test('requires 2FA for privileged title in production', async () => {
    const old = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      const mw = requirePositionMiddleware({
        titles: ['Treasurer'],
        governancePort: port(async () => [{ id: 't1', positionTitle: 'Treasurer' } as any]),
      });
      await expect(
        mw(makeCtx({ user: { id: 'user-1', twoFactorEnabled: false } }), async () => {}),
      ).rejects.toThrow('Two-factor authentication required');
    } finally {
      process.env['NODE_ENV'] = old;
    }
  });

  test('skips 2FA gate in non-production', async () => {
    const old = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'development';
    try {
      const mw = requirePositionMiddleware({
        titles: ['Treasurer'],
        governancePort: port(async () => [{ id: 't1', positionTitle: 'Treasurer' } as any]),
      });
      let called = false;
      await mw(makeCtx({ user: { id: 'user-1', twoFactorEnabled: false } }), async () => { called = true; });
      expect(called).toBe(true);
    } finally {
      process.env['NODE_ENV'] = old;
    }
  });

  test('non-privileged title does not gate on 2FA', async () => {
    const old = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      const mw = requirePositionMiddleware({
        titles: ['Member-at-Large'],
        governancePort: port(async () => [{ id: 't1', positionTitle: 'Member-at-Large' } as any]),
      });
      let called = false;
      await mw(makeCtx({ user: { id: 'user-1', twoFactorEnabled: false } }), async () => { called = true; });
      expect(called).toBe(true);
    } finally {
      process.env['NODE_ENV'] = old;
    }
  });

  test('OR semantics: any matching title in allowed list grants access', async () => {
    const mw = requirePositionMiddleware({
      titles: ['Treasurer', 'President'],
      governancePort: port(async () => [
        { id: 't1', positionTitle: 'Secretary' } as any,
        { id: 't2', positionTitle: 'President' } as any,
      ]),
    });
    let called = false;
    await mw(makeCtx(), async () => { called = true; });
    expect(called).toBe(true);
  });

  describe('body-orgId source', () => {
    function makeBodyCtx(orgIdInBody: string | undefined, overrides: Record<string, any> = {}) {
      const vars: Record<string, any> = {
        user: { id: 'user-1', twoFactorEnabled: true },
        database: {},
        ...overrides,
      };
      return {
        get: (key: string) => vars[key],
        set: (key: string, val: any) => { vars[key] = val; },
        req: {
          param: (_key: string) => undefined,
          valid: (kind: string) => (kind === 'json' ? { orgId: orgIdInBody } : undefined),
        },
      } as any;
    }

    test('reads orgId from validated body when orgIdFrom: body', async () => {
      const mw = requirePositionMiddleware({
        titles: ['Member-at-Large'],
        orgIdFrom: 'body',
        bodyField: 'orgId',
        governancePort: port(async () => [{ id: 't1', positionTitle: 'Member-at-Large' } as any]),
      });
      let called = false;
      await mw(makeBodyCtx('org-from-body'), async () => { called = true; });
      expect(called).toBe(true);
    });

    test('throws ValidationError when body field missing in body-mode', async () => {
      const mw = requirePositionMiddleware({
        titles: ['Treasurer'],
        orgIdFrom: 'body',
        bodyField: 'orgId',
        governancePort: port(async () => []),
      });
      await expect(mw(makeBodyCtx(undefined), async () => {})).rejects.toThrow('Missing organization context');
    });
  });
});
