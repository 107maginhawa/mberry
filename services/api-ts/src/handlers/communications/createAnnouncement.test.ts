import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CommunicationsRepository } from './repos/communications.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { createAnnouncement } from './createAnnouncement';

describe('createAnnouncement', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(CommunicationsRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(CommunicationsRepository);
  });

  test('creates announcement with 201', async () => {
    const ann = { id: 'ann-1', title: 'Test', status: 'draft' };
    const officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
    mocks = { ...officerMocks, ...stubRepo(CommunicationsRepository, {
      create: async () => ann,
    }) };
    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _body: { title: 'Test', content: 'Hello' },
    });
    const res = await createAnnouncement(ctx);
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(ann);
  });

  test('creates stats when status is sent', async () => {
    const ann = { id: 'ann-1', title: 'Test', status: 'sent' };
    let statsCreated = false;
    const officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
    mocks = { ...officerMocks, ...stubRepo(CommunicationsRepository, {
      create: async () => ann,
      createStats: async () => { statsCreated = true; },
    }) };
    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _body: { title: 'Test', content: 'Hello', status: 'sent', recipientCount: 100 },
    });
    await createAnnouncement(ctx);
    expect(statsCreated).toBe(true);
  });

  test('sets authorId from session', async () => {
    let capturedData: any;
    const officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
    mocks = { ...officerMocks, ...stubRepo(CommunicationsRepository, {
      create: async (data: any) => { capturedData = data; return { id: 'ann-1', ...data }; },
    }) };
    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _body: { title: 'Test', content: 'Hello' },
    });
    await createAnnouncement(ctx);
    expect(capturedData.authorId).toBe('user-1');
    expect(capturedData.createdBy).toBe('user-1');
  });

  test('returns 401 without session', async () => {
    const ctx = makeCtx({
      user: null, session: null,
      _params: { orgId: 'org-1' },
      _body: { title: 'Test', content: 'Hello' },
    });
    const res = await createAnnouncement(ctx);
    expect(res.status).toBe(401);
  });
});
