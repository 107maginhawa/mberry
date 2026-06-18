import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { updateCredentialTemplate } from './updateCredentialTemplate';
import { CredentialTemplateRepository } from '@/handlers/association:member/repos/credentials.repo';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';

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

describe('updateCredentialTemplate', () => {
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
      _body: { name: 'Updated' },
    });
    await expect(updateCredentialTemplate(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('throws NotFoundError when template does not exist', async () => {
    stubRepo(CredentialTemplateRepository, {
      findOneById: async () => undefined,
      updateOneById: async () => fakeTemplate,
    });

    const ctx = makeCtx({
      _params: { templateId: 'no-such' },
      _body: { name: 'Updated' },
    });
    await expect(updateCredentialTemplate(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ForbiddenError when template belongs to different org', async () => {
    stubRepo(CredentialTemplateRepository, {
      findOneById: async () => ({ ...fakeTemplate, organizationId: 'other-org' }),
      updateOneById: async () => fakeTemplate,
    });

    const ctx = makeCtx({
      organizationId: 'tenant-1',
      _params: { templateId: 'tmpl-1' },
      _body: { name: 'Updated' },
    });
    await expect(updateCredentialTemplate(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('happy path — updates template and returns 200', async () => {
    const updated = { ...fakeTemplate, name: 'Updated Certificate' };
    stubRepo(CredentialTemplateRepository, {
      findOneById: async () => fakeTemplate,
      updateOneById: async () => updated,
    });

    const ctx = makeCtx({
      _params: { templateId: 'tmpl-1' },
      _body: { name: 'Updated Certificate' },
    });
    const res = await updateCredentialTemplate(ctx);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Certificate');
    expect(res.body.id).toBe('tmpl-1');
  });

  test('passes body fields to repo.updateOneById', async () => {
    let capturedId: string | undefined;
    let capturedData: any;
    stubRepo(CredentialTemplateRepository, {
      findOneById: async () => fakeTemplate,
      updateOneById: async (id: string, data: any) => {
        capturedId = id;
        capturedData = data;
        return { ...fakeTemplate, ...data };
      },
    });

    const ctx = makeCtx({
      _params: { templateId: 'tmpl-1' },
      _body: { name: 'New Name', status: 'inactive', validityPeriod: 6 },
    });
    await updateCredentialTemplate(ctx);

    expect(capturedId).toBe('tmpl-1');
    expect(capturedData.name).toBe('New Name');
    expect(capturedData.status).toBe('inactive');
    expect(capturedData.validityPeriod).toBe(6);
  });

  test('allows update when org matches template org', async () => {
    const updated = { ...fakeTemplate, name: 'Same Org Update' };
    stubRepo(CredentialTemplateRepository, {
      findOneById: async () => fakeTemplate, // organizationId: 'tenant-1'
      updateOneById: async () => updated,
    });

    const ctx = makeCtx({
      organizationId: 'tenant-1', // matches
      _params: { templateId: 'tmpl-1' },
      _body: { name: 'Same Org Update' },
    });
    const res = await updateCredentialTemplate(ctx);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Same Org Update');
  });

  test('partial update — only provided fields sent to repo', async () => {
    let capturedData: any;
    stubRepo(CredentialTemplateRepository, {
      findOneById: async () => fakeTemplate,
      updateOneById: async (_id: string, data: any) => {
        capturedData = data;
        return { ...fakeTemplate, ...data };
      },
    });

    const ctx = makeCtx({
      _params: { templateId: 'tmpl-1' },
      _body: { status: 'inactive' }, // only status
    });
    await updateCredentialTemplate(ctx);

    expect(capturedData.status).toBe('inactive');
    // name not in body — should not be in capturedData
    expect(capturedData.name).toBeUndefined();
  });
});
