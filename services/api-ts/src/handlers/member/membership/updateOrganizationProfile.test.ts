/**
 * Tests for updateOrganizationProfile — EM-M04 Wave 17.
 *
 * Verifies the org.settings.updated domain event is emitted on a successful
 * profile update (EM-M04-u1v2w3x4 / 03g9h8i7).
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { domainEvents } from '@/core/domain-events';

function makeDb() {
  return {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [{ id: 'org-1', name: 'Old Name' }] }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({ returning: async () => [{ id: 'org-1', name: 'New Name' }] }),
      }),
    }),
  };
}

describe('updateOrganizationProfile — domain event', () => {
  afterEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  test('emits org.settings.updated on successful update', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user', twoFactorEnabled: true },
      organizationId: 'org-1',
      database: makeDb(),
      _params: { organizationId: 'org-1' },
      _body: { name: 'New Name', description: 'Updated desc' },
    });

    const emitted: Array<{ e: string; p: any }> = [];
    const origEmit = domainEvents.emit.bind(domainEvents);
    (domainEvents as any).emit = async (e: string, p: any) => { emitted.push({ e, p }); };

    try {
      const { updateOrganizationProfile } = await import('./updateOrganizationProfile');
      const res = await updateOrganizationProfile(ctx);
      expect(res.status).toBe(200);
    } finally {
      (domainEvents as any).emit = origEmit;
    }

    const evt = emitted.find(x => x.e === 'org.settings.updated');
    expect(evt).toBeDefined();
    expect(evt!.p.organizationId).toBe('org-1');
    expect(evt!.p.updatedBy).toBe('user-1');
    expect(evt!.p.updatedFields).toEqual(['name', 'description']);
  });

  test('does not emit when caller lacks President position', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Member' }],
    });

    const ctx = makeCtx({
      user: { id: 'user-2', role: 'user', twoFactorEnabled: true },
      organizationId: 'org-1',
      database: makeDb(),
      _params: { organizationId: 'org-1' },
      _body: { name: 'New Name' },
    });

    const emitted: Array<{ e: string; p: any }> = [];
    const origEmit = domainEvents.emit.bind(domainEvents);
    (domainEvents as any).emit = async (e: string, p: any) => { emitted.push({ e, p }); };

    try {
      const { updateOrganizationProfile } = await import('./updateOrganizationProfile');
      const res = await updateOrganizationProfile(ctx);
      expect(res.status).toBe(403);
    } finally {
      (domainEvents as any).emit = origEmit;
    }

    expect(emitted.find(x => x.e === 'org.settings.updated')).toBeUndefined();
  });
});
