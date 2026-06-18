import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { deleteCredentialTemplate } from './deleteCredentialTemplate';
import { CredentialTemplateRepository } from '@/handlers/association:member/repos/credentials.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeTemplate = {
  id: 'tmpl-1',
  organizationId: 'tenant-1',
  name: 'CPD Certificate',
  type: 'cpd',
  design: null,
  validityPeriod: 12,
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Tests ──────────────────────────────────────────────

describe('deleteCredentialTemplate', () => {
  beforeEach(() => {
    restoreRepo(CredentialTemplateRepository);
  });

  afterEach(() => {
    restoreRepo(CredentialTemplateRepository);
  });

  test('throws UnauthorizedError when no session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { templateId: 'tmpl-1' },
    });
    await expect(deleteCredentialTemplate(ctx as any)).rejects.toThrow();
  });

  test('throws NotFoundError when template does not exist', async () => {
    stubRepo(CredentialTemplateRepository, {
      findOneById: async () => null,
      deleteOneById: async () => {},
    });

    const ctx = makeCtx({ _params: { templateId: 'missing' } });
    await expect(deleteCredentialTemplate(ctx as any)).rejects.toThrow('Credential template');
  });

  test('happy path — deletes template and returns 204', async () => {
    let deletedId: string | undefined;
    stubRepo(CredentialTemplateRepository, {
      findOneById: async () => fakeTemplate,
      deleteOneById: async (id: string) => { deletedId = id; },
    });

    const ctx = makeCtx({ _params: { templateId: 'tmpl-1' } });
    const res = await deleteCredentialTemplate(ctx as any);

    expect(res.status).toBe(204);
    expect((res as any).body).toBeNull();
    expect(deletedId).toBe('tmpl-1');
  });

  test('passes templateId to repo.findOneById', async () => {
    let lookedUpId: string | undefined;
    stubRepo(CredentialTemplateRepository, {
      findOneById: async (id: string) => { lookedUpId = id; return fakeTemplate; },
      deleteOneById: async () => {},
    });

    const ctx = makeCtx({ _params: { templateId: 'tmpl-abc' } });
    await deleteCredentialTemplate(ctx as any);

    expect(lookedUpId).toBe('tmpl-abc');
  });

  test('does not call deleteOneById when template not found', async () => {
    let deleteCalled = false;
    stubRepo(CredentialTemplateRepository, {
      findOneById: async () => null,
      deleteOneById: async () => { deleteCalled = true; },
    });

    const ctx = makeCtx({ _params: { templateId: 'missing' } });
    await expect(deleteCredentialTemplate(ctx as any)).rejects.toThrow();
    expect(deleteCalled).toBe(false);
  });
});
