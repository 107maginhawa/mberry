import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { requireActiveStatus, requireOrgRole, requireTenantAccess } from './org-auth';
// Assertion-Style: EXISTENCE_CHECK — verifying middleware/context injection patterns

// ─── BR-49: requireActiveStatus allows active + grace ────

describe('[BR-49] requireActiveStatus', () => {
  test('allows active membership', () => {
    const ctx = makeCtx({ orgMembership: { status: 'active', organizationId: 'org-1' } });
    const result = requireActiveStatus(ctx);
    expect(result).toBeNull();
  });

  test('allows grace period membership', () => {
    const ctx = makeCtx({ orgMembership: { status: 'grace', organizationId: 'org-1' } });
    const result = requireActiveStatus(ctx);
    expect(result).toBeNull();
  });

  test('rejects suspended membership with 403', () => {
    const ctx = makeCtx({ orgMembership: { status: 'suspended', organizationId: 'org-1' } });
    const result = requireActiveStatus(ctx);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  test('rejects lapsed membership with 403', () => {
    const ctx = makeCtx({ orgMembership: { status: 'lapsed', organizationId: 'org-1' } });
    const result = requireActiveStatus(ctx);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  test('rejects expired membership with 403', () => {
    const ctx = makeCtx({ orgMembership: { status: 'expired', organizationId: 'org-1' } });
    const result = requireActiveStatus(ctx);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  test('rejects missing membership with 403', () => {
    const ctx = makeCtx({ orgMembership: undefined });
    const result = requireActiveStatus(ctx);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });
});

// ─── requireOrgRole ──────────────────────────────────────

describe('requireOrgRole', () => {
  test('allows user with matching role', () => {
    const ctx = makeCtx({ orgMembership: { role: 'president', organizationId: 'org-1' } });
    const result = requireOrgRole(ctx, ['president', 'treasurer']);
    expect(result).toBeNull();
  });

  test('rejects user without matching role', () => {
    const ctx = makeCtx({ orgMembership: { role: 'member', organizationId: 'org-1' } });
    const result = requireOrgRole(ctx, ['president', 'treasurer']);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  test('rejects missing membership', () => {
    const ctx = makeCtx({ orgMembership: undefined });
    const result = requireOrgRole(ctx, ['president']);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });
});

// ─── requireTenantAccess ─────────────────────────────────

describe('requireTenantAccess', () => {
  test('allows matching org', () => {
    const ctx = makeCtx({ organizationId: 'org-1', orgMembership: { organizationId: 'org-1' } });
    const result = requireTenantAccess(ctx);
    expect(result).toBeNull();
  });

  test('rejects mismatched org', () => {
    const ctx = makeCtx({ organizationId: 'org-1', orgMembership: { organizationId: 'org-2' } });
    const result = requireTenantAccess(ctx);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  test('rejects missing org context', () => {
    const ctx = makeCtx({ organizationId: undefined, orgMembership: undefined });
    const result = requireTenantAccess(ctx);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });
});
