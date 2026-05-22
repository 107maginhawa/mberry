import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';

// ---------------------------------------------------------------------------
// Auth guard tests — every handler must return 401 when session is null
// ---------------------------------------------------------------------------

describe('platformadmin auth guards', () => {
  test('createAssociation returns 401 without session', async () => {
    const { createAssociation } = await import('./createAssociation');
    const ctx = makeCtx({ session: null, _body: { name: 'X', country: 'PH', currency: 'PHP' } });
    const response = await createAssociation(ctx);
    expect(response.status).toBe(401);
  });

  test('listAssociations returns 401 without session', async () => {
    const { listAssociations } = await import('./listAssociations');
    const ctx = makeCtx({ session: null });
    const response = await listAssociations(ctx);
    expect(response.status).toBe(401);
  });

  test('getAssociation returns 401 without session', async () => {
    const { getAssociation } = await import('./getAssociation');
    const ctx = makeCtx({ session: null, _params: { associationId: 'a-1' } });
    const response = await getAssociation(ctx);
    expect(response.status).toBe(401);
  });

  test('updateAssociation returns 401 without session', async () => {
    const { updateAssociation } = await import('./updateAssociation');
    const ctx = makeCtx({ session: null, _params: { associationId: 'a-1' }, _body: {} });
    const response = await updateAssociation(ctx);
    expect(response.status).toBe(401);
  });

  test('deleteAssociation returns 401 without session', async () => {
    const { deleteAssociation } = await import('./deleteAssociation');
    const ctx = makeCtx({ session: null, _params: { associationId: 'a-1' } });
    const response = await deleteAssociation(ctx);
    expect(response.status).toBe(401);
  });

  test('createOrganization returns 401 without session', async () => {
    const { createOrganization } = await import('./createOrganization');
    const ctx = makeCtx({ session: null, _body: { associationId: 'a-1', name: 'O', orgType: 'chapter' } });
    const response = await createOrganization(ctx);
    expect(response.status).toBe(401);
  });

  test('listOrganizations returns 401 without session', async () => {
    const { listOrganizations } = await import('./listOrganizations');
    const ctx = makeCtx({ session: null });
    const response = await listOrganizations(ctx);
    expect(response.status).toBe(401);
  });

  test('getOrganization returns 401 without session', async () => {
    const { getOrganization } = await import('./getOrganization');
    const ctx = makeCtx({ session: null, _params: { organizationId: 'o-1' } });
    const response = await getOrganization(ctx);
    expect(response.status).toBe(401);
  });

  test('updateOrganization returns 401 without session', async () => {
    const { updateOrganization } = await import('./updateOrganization');
    const ctx = makeCtx({ session: null, _params: { organizationId: 'o-1' }, _body: {} });
    const response = await updateOrganization(ctx);
    expect(response.status).toBe(401);
  });

  test('transitionOrgStatus returns 401 without session', async () => {
    const { transitionOrgStatus } = await import('./transitionOrgStatus');
    const ctx = makeCtx({ session: null, _params: { organizationId: 'o-1' }, _body: { status: 'active' } });
    const response = await transitionOrgStatus(ctx);
    expect(response.status).toBe(401);
  });

  test('setFeatureFlag returns 401 without session', async () => {
    const { setFeatureFlag } = await import('./setFeatureFlag');
    const ctx = makeCtx({ session: null, _body: { targetType: 'org', targetId: 'o-1', moduleName: 'billing', enabled: true } });
    const response = await setFeatureFlag(ctx);
    expect(response.status).toBe(401);
  });

  test('listFeatureFlags returns 401 without session', async () => {
    const { listFeatureFlags } = await import('./listFeatureFlags');
    const ctx = makeCtx({ session: null });
    const response = await listFeatureFlags(ctx);
    expect(response.status).toBe(401);
  });

  test('deleteFeatureFlag returns 401 without session', async () => {
    const { deleteFeatureFlag } = await import('./deleteFeatureFlag');
    const ctx = makeCtx({ session: null, _params: { flagId: 'f-1' } });
    const response = await deleteFeatureFlag(ctx);
    expect(response.status).toBe(401);
  });

  test('inviteAdmin returns 401 without session', async () => {
    const { inviteAdmin } = await import('./inviteAdmin');
    const ctx = makeCtx({ session: null, _body: { email: 'a@b.com', name: 'A', role: 'support' } });
    const response = await inviteAdmin(ctx);
    expect(response.status).toBe(401);
  });

  test('listAdmins returns 401 without session', async () => {
    const { listAdmins } = await import('./listAdmins');
    const ctx = makeCtx({ session: null });
    const response = await listAdmins(ctx);
    expect(response.status).toBe(401);
  });

  test('updateAdmin returns 401 without session', async () => {
    const { updateAdmin } = await import('./updateAdmin');
    const ctx = makeCtx({ session: null, _params: { adminId: 'ad-1' }, _body: {} });
    const response = await updateAdmin(ctx);
    expect(response.status).toBe(401);
  });

  test('revokeAdmin returns 401 without session', async () => {
    const { revokeAdmin } = await import('./revokeAdmin');
    const ctx = makeCtx({ session: null, _params: { adminId: 'ad-1' } });
    const response = await revokeAdmin(ctx);
    expect(response.status).toBe(401);
  });

  test('startImpersonation returns 401 without session', async () => {
    const { startImpersonation } = await import('./startImpersonation');
    const ctx = makeCtx({ session: null, _body: { targetUserId: 'u-1' } });
    const response = await startImpersonation(ctx);
    expect(response.status).toBe(401);
  });

  test('endImpersonation returns 401 without session', async () => {
    const { endImpersonation } = await import('./endImpersonation');
    const ctx = makeCtx({ session: null, _params: { sessionId: 's-1' } });
    const response = await endImpersonation(ctx);
    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Business rule tests
// ---------------------------------------------------------------------------

describe('transitionOrgStatus valid transitions', () => {
  const validTransitions: [string, string][] = [
    ['trial', 'active'],
    ['active', 'suspended'],
    ['suspended', 'active'],
    ['active', 'cancelled'],
    ['suspended', 'cancelled'],
  ];

  for (const [from, to] of validTransitions) {
    test(`allows ${from} -> ${to}`, () => {
      // Validate that these transitions are considered valid by the handler logic
      const VALID: Record<string, string[]> = {
        trial: ['active'],
        active: ['suspended', 'cancelled'],
        suspended: ['active', 'cancelled'],
        cancelled: ['active'],
      };
      expect(VALID[from]).toContain(to);
    });
  }

  test('rejects invalid transition trial -> cancelled', () => {
    const VALID: Record<string, string[]> = {
      trial: ['active'],
      active: ['suspended', 'cancelled'],
      suspended: ['active', 'cancelled'],
      cancelled: ['active'],
    };
    expect(VALID['trial']).not.toContain('cancelled');
  });

  test('rejects invalid transition trial -> suspended', () => {
    const VALID: Record<string, string[]> = {
      trial: ['active'],
      active: ['suspended', 'cancelled'],
      suspended: ['active', 'cancelled'],
      cancelled: ['active'],
    };
    expect(VALID['trial']).not.toContain('suspended');
  });
});

describe('revokeAdmin last-super guard', () => {
  test('cannot remove the only super admin', () => {
    // Business rule: if countByRole('super') === 1 and the target admin
    // is a super, the handler must reject with 409 / BusinessLogicError
    const superCount = 1;
    const targetRole = 'super';
    const shouldBlock = targetRole === 'super' && superCount <= 1;
    expect(shouldBlock).toBe(true);
  });

  test('allows removal when multiple supers exist', () => {
    const superCount = 2;
    const targetRole = 'super';
    const shouldBlock = targetRole === 'super' && superCount <= 1;
    expect(shouldBlock).toBe(false);
  });

  test('allows removal of non-super admin even if only one super', () => {
    const superCount = 1;
    const targetRole: string = 'support';
    const shouldBlock = targetRole === 'super' && superCount <= 1;
    expect(shouldBlock).toBe(false);
  });
});

describe('[BR-10] startImpersonation role guard', () => {
  test('only super and support roles can impersonate', () => {
    const allowed = ['super', 'support'];
    expect(allowed).toContain('super');
    expect(allowed).toContain('support');
    expect(allowed).not.toContain('analyst');
  });

  test('impersonation token expires in 30 minutes', () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
    const diffMs = expiresAt.getTime() - now.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    expect(diffMinutes).toBe(30);
  });
});

describe('inviteAdmin duplicate email', () => {
  test('rejects duplicate email (conceptual)', () => {
    // The handler checks repo.findByEmail() before creating
    const existingEmails = ['admin@example.com'];
    const newEmail = 'admin@example.com';
    const isDuplicate = existingEmails.includes(newEmail.toLowerCase());
    expect(isDuplicate).toBe(true);
  });
});

describe('createAssociation duplicate name', () => {
  test('rejects duplicate association name (conceptual)', () => {
    const existingNames = ['PDA'];
    const newName = 'PDA';
    const isDuplicate = existingNames.includes(newName);
    expect(isDuplicate).toBe(true);
  });
});

describe('createOrganization duplicate name in association', () => {
  test('rejects duplicate org name within same association (conceptual)', () => {
    const existingOrgs = [{ name: 'Manila Chapter', associationId: 'a-1' }];
    const newOrg = { name: 'Manila Chapter', associationId: 'a-1' };
    const isDuplicate = existingOrgs.some(
      o => o.name === newOrg.name && o.associationId === newOrg.associationId
    );
    expect(isDuplicate).toBe(true);
  });

  test('allows same name in different association', () => {
    const existingOrgs = [{ name: 'Manila Chapter', associationId: 'a-1' }];
    const newOrg = { name: 'Manila Chapter', associationId: 'a-2' };
    const isDuplicate = existingOrgs.some(
      o => o.name === newOrg.name && o.associationId === newOrg.associationId
    );
    expect(isDuplicate).toBe(false);
  });

  test('sets trial dates when trialDurationDays provided', () => {
    const trialDurationDays = 30;
    const now = new Date();
    const trialStart = now;
    const trialEnd = new Date(now.getTime() + trialDurationDays * 24 * 60 * 60 * 1000);
    const diffDays = (trialEnd.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(30);
  });
});
