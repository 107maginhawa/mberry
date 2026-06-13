/**
 * Unit tests for the platform-admin tier guard (AHA FIX-008 / G1).
 *
 * Q1 decision (CONTINUE-48): the canonical admin role taxonomy is the code enum
 * `super | support | analyst`. Q8 decision: `analyst` is read-only.
 *
 * requireAdminTier mirrors requirePosition's return-Response-or-null convention
 * (core/auth/officer-checks.ts): it reads ctx.get('platformAdmin').role and
 * returns a 403 Response when the caller's tier is not in the allowed set, or
 * null when allowed.
 */

import { describe, test, expect } from 'bun:test';
import {
  requireAdminTier,
  SUPER_ONLY,
  SUPPORT_OR_SUPER,
  type AdminRole,
} from './admin-tier';
import { makeCtx } from '@/test-utils/make-ctx';

describe('requireAdminTier', () => {
  test('returns a 403 Response when no platformAdmin is in context', () => {
    const ctx = makeCtx({ platformAdmin: undefined });
    const res = requireAdminTier(ctx, SUPER_ONLY);
    expect(res?.status).toBe(403);
  });

  test('SUPER_ONLY: super is allowed (null)', () => {
    const ctx = makeCtx({ platformAdmin: { role: 'super' } });
    expect(requireAdminTier(ctx, SUPER_ONLY)).toBeNull();
  });

  test('SUPER_ONLY: support is denied (403)', () => {
    const ctx = makeCtx({ platformAdmin: { role: 'support' } });
    expect(requireAdminTier(ctx, SUPER_ONLY)?.status).toBe(403);
  });

  test('SUPER_ONLY: analyst is denied (403)', () => {
    const ctx = makeCtx({ platformAdmin: { role: 'analyst' } });
    expect(requireAdminTier(ctx, SUPER_ONLY)?.status).toBe(403);
  });

  test('SUPPORT_OR_SUPER: support is allowed (null)', () => {
    const ctx = makeCtx({ platformAdmin: { role: 'support' } });
    expect(requireAdminTier(ctx, SUPPORT_OR_SUPER)).toBeNull();
  });

  test('SUPPORT_OR_SUPER: super is allowed (null)', () => {
    const ctx = makeCtx({ platformAdmin: { role: 'super' } });
    expect(requireAdminTier(ctx, SUPPORT_OR_SUPER)).toBeNull();
  });

  test('SUPPORT_OR_SUPER: analyst is denied (403) — Q8 read-only', () => {
    const ctx = makeCtx({ platformAdmin: { role: 'analyst' } });
    expect(requireAdminTier(ctx, SUPPORT_OR_SUPER)?.status).toBe(403);
  });

  test('an unknown/missing role is denied (403)', () => {
    const ctx = makeCtx({ platformAdmin: { id: 'pa-1' } });
    expect(requireAdminTier(ctx, SUPER_ONLY)?.status).toBe(403);
  });

  test('exported tier groups match the Q1 taxonomy', () => {
    const superOnly: AdminRole[] = SUPER_ONLY;
    const supportOrSuper: AdminRole[] = SUPPORT_OR_SUPER;
    expect(superOnly).toEqual(['super']);
    expect(supportOrSuper).toEqual(['super', 'support']);
  });
});
