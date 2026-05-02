import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { CommunicationsRepository } from './repos/communications.repo';
import { createAnnouncement } from './createAnnouncement';

describe('createAnnouncement', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
  });

  test('creates announcement with 201', async () => {
    const ann = { id: 'ann-1', title: 'Test', status: 'draft' };
    mocks = stubRepo(CommunicationsRepository, {
      create: async () => ann,
    });
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
    mocks = stubRepo(CommunicationsRepository, {
      create: async () => ann,
      createStats: async () => { statsCreated = true; },
    });
    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _body: { title: 'Test', content: 'Hello', status: 'sent', recipientCount: 100 },
    });
    await createAnnouncement(ctx);
    expect(statsCreated).toBe(true);
  });

  test('sets authorId from session', async () => {
    let capturedData: any;
    mocks = stubRepo(CommunicationsRepository, {
      create: async (data: any) => { capturedData = data; return { id: 'ann-1', ...data }; },
    });
    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
      _body: { title: 'Test', content: 'Hello' },
    });
    await createAnnouncement(ctx);
    expect(capturedData.authorId).toBe('user-1');
    expect(capturedData.createdBy).toBe('user-1');
  });

  test('crashes without session', async () => {
    mocks = stubRepo(CommunicationsRepository, {
      create: async () => ({}),
    });
    const ctx = makeCtx({
      user: null, session: null,
      _params: { orgId: 'org-1' },
      _body: { title: 'Test', content: 'Hello' },
    });
    await expect(createAnnouncement(ctx)).rejects.toThrow();
  });
});
