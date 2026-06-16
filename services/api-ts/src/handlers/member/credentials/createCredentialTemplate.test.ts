import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { createCredentialTemplate } from './createCredentialTemplate';
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

describe('createCredentialTemplate', () => {
  beforeEach(() => {
    restoreRepo(CredentialTemplateRepository);
  });

  afterEach(() => {
    restoreRepo(CredentialTemplateRepository);
  });

  test('returns 401 when no user', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _body: { name: 'CPD Cert', type: 'cpd' },
    });
    const res = await createCredentialTemplate(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organizationId', async () => {
    const ctx = makeCtx({
      organizationId: '',
      _body: { name: 'CPD Cert', type: 'cpd' },
    });
    const res = await createCredentialTemplate(ctx);
    expect(res.status).toBe(403);
  });

  test('happy path — creates template and returns 201', async () => {
    stubRepo(CredentialTemplateRepository, {
      createOne: async () => fakeTemplate,
    });

    const ctx = makeCtx({
      _body: { name: 'CPD Certificate', type: 'cpd', validityPeriod: 12 },
    });
    const res = await createCredentialTemplate(ctx);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('tmpl-1');
    expect(res.body.name).toBe('CPD Certificate');
    expect(res.body.type).toBe('cpd');
  });

  test('passes body fields to repo.createOne', async () => {
    let capturedData: any;
    stubRepo(CredentialTemplateRepository, {
      createOne: async (data: any) => {
        capturedData = data;
        return { ...fakeTemplate, ...data };
      },
    });

    const ctx = makeCtx({
      _body: {
        name: 'Board Cert',
        type: 'board',
        design: { template: 'v2' },
        validityPeriod: 24,
        status: 'draft',
      },
    });
    await createCredentialTemplate(ctx);

    expect(capturedData.name).toBe('Board Cert');
    expect(capturedData.type).toBe('board');
    expect(capturedData.design).toEqual({ template: 'v2' });
    expect(capturedData.validityPeriod).toBe(24);
    expect(capturedData.status).toBe('draft');
    expect(capturedData.organizationId).toBe('tenant-1');
  });

  test('defaults status to active when not provided', async () => {
    let capturedData: any;
    stubRepo(CredentialTemplateRepository, {
      createOne: async (data: any) => {
        capturedData = data;
        return fakeTemplate;
      },
    });

    const ctx = makeCtx({
      _body: { name: 'CPD Cert', type: 'cpd' },
    });
    await createCredentialTemplate(ctx);

    expect(capturedData.status).toBe('active');
  });

  test('defaults design to null when not provided', async () => {
    let capturedData: any;
    stubRepo(CredentialTemplateRepository, {
      createOne: async (data: any) => {
        capturedData = data;
        return fakeTemplate;
      },
    });

    const ctx = makeCtx({
      _body: { name: 'CPD Cert', type: 'cpd' },
    });
    await createCredentialTemplate(ctx);

    expect(capturedData.design).toBeNull();
  });

  test('defaults validityPeriod to null when not provided', async () => {
    let capturedData: any;
    stubRepo(CredentialTemplateRepository, {
      createOne: async (data: any) => {
        capturedData = data;
        return { ...fakeTemplate, validityPeriod: null };
      },
    });

    const ctx = makeCtx({
      _body: { name: 'CPD Cert', type: 'cpd' },
    });
    await createCredentialTemplate(ctx);

    expect(capturedData.validityPeriod).toBeNull();
  });
});
