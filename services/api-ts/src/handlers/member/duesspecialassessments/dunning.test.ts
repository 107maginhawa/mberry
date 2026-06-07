import { describe, test, expect, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, ensurePristine, restoreRepo } from '@/test-utils/make-ctx';
import { DunningTemplateRepository } from '@/handlers/association:member/repos/dunning.repo';
import { DunningEventRepository } from '@/handlers/association:member/repos/dunning.repo';

// Ensure pristine prototypes before any stubbing
ensurePristine(DunningTemplateRepository);
ensurePristine(DunningEventRepository);

// ---------------------------------------------------------------------------
// Dunning Template CRUD
// ---------------------------------------------------------------------------

describe('Dunning Templates', () => {
  beforeEach(() => {
    restoreRepo(DunningTemplateRepository);
    restoreRepo(DunningEventRepository);
  });

  test('createDunningTemplate returns 201 with valid body', async () => {
    stubRepo(DunningTemplateRepository, {
      createOne: async (data: any) => ({
        id: 'tmpl-1',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: null,
        organizationId: 'org-1',
        name: data.name,
        stage: data.stage,
        daysAfterDue: data.daysAfterDue,
        channel: data.channel,
        subject: data.subject ?? null,
        body: data.body,
        status: data.status ?? 'active',
      }),
    });

    const { createDunningTemplate } = await import('./createDunningTemplate');
    const ctx = makeCtx({
      _body: {
        name: 'First Notice',
        stage: 1,
        daysAfterDue: 30,
        channel: 'email',
        subject: 'Payment Overdue',
        body: 'Your dues are overdue.',
        status: 'active',
      },
    });
    const response = await createDunningTemplate(ctx);
    expect(response.status).toBe(201);

    const json = (response as any).body;
    expect(json.name).toBe('First Notice');
    expect(json.stage).toBe(1);
    expect(json.channel).toBe('email');
  });

  test('createDunningTemplate returns 401 without user', async () => {
    const { createDunningTemplate } = await import('./createDunningTemplate');
    const ctx = makeCtx({ user: null, session: null });
    const response = await createDunningTemplate(ctx);
    expect(response.status).toBe(401);
  });

  test('getDunningTemplate returns 200 for existing template', async () => {
    const mockTemplate = {
      id: 'tmpl-1',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
      updatedBy: null,
      organizationId: 'org-1',
      name: 'First Notice',
      stage: 1,
      daysAfterDue: 30,
      channel: 'email' as const,
      subject: 'Overdue',
      body: 'Pay up.',
      status: 'active' as const,
    };

    stubRepo(DunningTemplateRepository, {
      findOneById: async () => mockTemplate,
    });

    const { getDunningTemplate } = await import('./getDunningTemplate');
    const ctx = makeCtx({ organizationId: 'org-1', _params: { templateId: 'tmpl-1' } });
    const response = await getDunningTemplate(ctx);
    expect(response.status).toBe(200);

    const json = (response as any).body;
    expect(json.id).toBe('tmpl-1');
    expect(json.name).toBe('First Notice');
  });

  test('getDunningTemplate returns 404 for missing template', async () => {
    stubRepo(DunningTemplateRepository, {
      findOneById: async () => null,
    });

    const { getDunningTemplate } = await import('./getDunningTemplate');
    const ctx = makeCtx({ _params: { templateId: 'nonexistent' } });
    const response = await getDunningTemplate(ctx);
    expect(response.status).toBe(404);
  });

  test('listDunningTemplates returns paginated results', async () => {
    const templates = [
      { id: 'tmpl-1', name: 'First Notice', stage: 1 },
      { id: 'tmpl-2', name: 'Second Notice', stage: 2 },
    ];

    stubRepo(DunningTemplateRepository, {
      findMany: async () => templates,
      count: async () => 2,
    });

    const { listDunningTemplates } = await import('./listDunningTemplates');
    const ctx = makeCtx({
      _query: { organizationId: 'org-1', offset: '0', limit: '20' },
    });
    const response = await listDunningTemplates(ctx);
    expect(response.status).toBe(200);

    const json = (response as any).body;
    expect(json.data).toHaveLength(2);
    expect(json.pagination).toBeDefined();
    expect(json.pagination.totalCount).toBe(2);
  });

  test('listDunningTemplates filters by stage', async () => {
    stubRepo(DunningTemplateRepository, {
      findMany: async () => [{ id: 'tmpl-1', name: 'First Notice', stage: 1 }],
      count: async () => 1,
    });

    const { listDunningTemplates } = await import('./listDunningTemplates');
    const ctx = makeCtx({
      _query: { organizationId: 'org-1', stage: '1', offset: '0', limit: '20' },
    });
    const response = await listDunningTemplates(ctx);
    expect(response.status).toBe(200);

    const json = (response as any).body;
    expect(json.data).toHaveLength(1);
  });

  test('updateDunningTemplate partial update returns 200', async () => {
    const existing = {
      id: 'tmpl-1',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
      updatedBy: null,
      organizationId: 'org-1',
      name: 'First Notice',
      stage: 1,
      daysAfterDue: 30,
      channel: 'email' as const,
      subject: 'Overdue',
      body: 'Pay up.',
      status: 'active' as const,
    };

    stubRepo(DunningTemplateRepository, {
      findOneById: async () => existing,
      updateOneById: async (_id: string, data: any) => ({
        ...existing,
        ...data,
        updatedAt: new Date(),
      }),
    });

    const { updateDunningTemplate } = await import('./updateDunningTemplate');
    const ctx = makeCtx({
      organizationId: 'org-1',
      _params: { templateId: 'tmpl-1' },
      _body: { name: 'Updated Notice', daysAfterDue: 45 },
    });
    const response = await updateDunningTemplate(ctx);
    expect(response.status).toBe(200);

    const json = (response as any).body;
    expect(json.name).toBe('Updated Notice');
    expect(json.daysAfterDue).toBe(45);
  });

  test('deleteDunningTemplate returns 204', async () => {
    stubRepo(DunningTemplateRepository, {
      findOneById: async () => ({ id: 'tmpl-1', organizationId: 'org-1' }),
      deleteOneById: async () => {},
    });

    const { deleteDunningTemplate } = await import('./deleteDunningTemplate');
    const ctx = makeCtx({ organizationId: 'org-1', _params: { templateId: 'tmpl-1' } });
    const response = await deleteDunningTemplate(ctx);
    expect(response.status).toBe(204);
  });
});

// ---------------------------------------------------------------------------
// Dunning Run + Events
// ---------------------------------------------------------------------------

describe('Dunning Run', () => {
  beforeEach(() => {
    restoreRepo(DunningTemplateRepository);
    restoreRepo(DunningEventRepository);
  });

  test('runDunning returns evaluation results', async () => {
    stubRepo(DunningTemplateRepository, {
      findMany: async () => [
        { id: 'tmpl-1', stage: 1, daysAfterDue: 30, channel: 'email', body: 'Pay', status: 'active' },
      ],
    });

    stubRepo(DunningEventRepository, {
      createOne: async (data: any) => ({ id: 'evt-1', ...data }),
    });

    const { runDunning } = await import('./runDunning');
    const ctx = makeCtx({
      _body: { organizationId: 'org-1', dryRun: true },
    });
    const response = await runDunning(ctx);
    expect(response.status).toBe(200);

    const json = (response as any).body;
    expect(json.evaluated).toBeDefined();
    expect(json.sent).toBeDefined();
    expect(json.dryRun).toBe(true);
  });

  test('runDunning returns 401 without user', async () => {
    const { runDunning } = await import('./runDunning');
    const ctx = makeCtx({ user: null, session: null });
    const response = await runDunning(ctx);
    expect(response.status).toBe(401);
  });
});

describe('Dunning Events', () => {
  beforeEach(() => {
    restoreRepo(DunningEventRepository);
  });

  test('listDunningEvents returns paginated results', async () => {
    const events = [
      { id: 'evt-1', membershipId: 'mem-1', personId: 'p-1', stage: 1, sentAt: new Date() },
    ];

    stubRepo(DunningEventRepository, {
      findMany: async () => events,
      count: async () => 1,
    });

    const { listDunningEvents } = await import('./listDunningEvents');
    const ctx = makeCtx({
      _query: { organizationId: 'org-1', offset: '0', limit: '20' },
    });
    const response = await listDunningEvents(ctx);
    expect(response.status).toBe(200);

    const json = (response as any).body;
    expect(json.data).toHaveLength(1);
    expect(json.pagination).toBeDefined();
  });

  test('listDunningEvents returns 401 without user', async () => {
    const { listDunningEvents } = await import('./listDunningEvents');
    const ctx = makeCtx({ user: null, session: null });
    const response = await listDunningEvents(ctx);
    expect(response.status).toBe(401);
  });
});
