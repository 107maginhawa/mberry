import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { getCredentialTemplate } from './getCredentialTemplate';
import { CredentialTemplateRepository } from '@/handlers/association:member/repos/credentials.repo';
import { NotFoundError, UnauthorizedError } from '@/core/errors';

describe('getCredentialTemplate', () => {
  afterEach(() => {
    restoreRepo(CredentialTemplateRepository);
  });

  test('returns the template when found', async () => {
    stubRepo(CredentialTemplateRepository, {
      findOneById: async (id: string) => ({ id, name: 'PRC License', organizationId: 'tenant-1' }),
    });

    const ctx = makeCtx({ _params: { templateId: 'tmpl-1' } });
    const response = await getCredentialTemplate(ctx);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe('tmpl-1');
    expect(response.body.name).toBe('PRC License');
  });

  test('throws UnauthorizedError when no session', async () => {
    stubRepo(CredentialTemplateRepository, {
      findOneById: async () => ({ id: 'tmpl-1' }),
    });

    const ctx = makeCtx({ user: null, session: null, _params: { templateId: 'tmpl-1' } });
    await expect(getCredentialTemplate(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('throws NotFoundError when template does not exist', async () => {
    stubRepo(CredentialTemplateRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({ _params: { templateId: 'nonexistent' } });
    await expect(getCredentialTemplate(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('passes the route templateId to the repo', async () => {
    let capturedId: string | null = null;
    stubRepo(CredentialTemplateRepository, {
      findOneById: async (id: string) => { capturedId = id; return { id }; },
    });

    const ctx = makeCtx({ _params: { templateId: 'tmpl-77' } });
    await getCredentialTemplate(ctx);
    expect(capturedId).toBe('tmpl-77');
  });
});
