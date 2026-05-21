import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CommunicationsRepository } from './repos/communication.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';

// Mock audit
mock.module('@/utils/audit', () => ({
  auditAction: async () => {},
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DRAFT_ANNOUNCEMENT = {
  id: 'ann-1',
  organizationId: 'org-1',
  title: 'Test Announcement',
  body: 'Hello world',
  authorId: 'user-1',
  status: 'draft',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const PUBLISHED_ANNOUNCEMENT = {
  ...DRAFT_ANNOUNCEMENT,
  id: 'ann-2',
  status: 'sent',
  publishedAt: new Date(),
};

const ARCHIVED_ANNOUNCEMENT = {
  ...DRAFT_ANNOUNCEMENT,
  id: 'ann-3',
  status: 'archived',
};

const SCHEDULED_ANNOUNCEMENT = {
  ...DRAFT_ANNOUNCEMENT,
  id: 'ann-4',
  status: 'scheduled',
};

// Global officer stub — publishAnnouncement/archiveAnnouncement now require officer role
beforeEach(() => {
  restoreRepo(OfficerTermRepository);
  stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
  });
});
afterEach(() => {
  restoreRepo(OfficerTermRepository);
});

// ---------------------------------------------------------------------------
// Auth guard tests — every handler must throw UnauthorizedError without session
// ---------------------------------------------------------------------------

describe('announcement auth guards', () => {
  test('createAnnouncement throws Unauthorized without session', async () => {
    const { createAnnouncement } = await import('./createAnnouncement');
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1' },
      _body: { title: 'Test', body: 'Hello' },
    });
    await expect(createAnnouncement(ctx as any)).rejects.toThrow('Unauthorized');
  });

  test('getAnnouncement throws Unauthorized without session', async () => {
    const { getAnnouncement } = await import('./getAnnouncement');
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'ann-1' },
    });
    await expect(getAnnouncement(ctx as any)).rejects.toThrow('Unauthorized');
  });

  test('listAnnouncements throws Unauthorized without session', async () => {
    const { listAnnouncements } = await import('./listAnnouncements');
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1' },
      _query: {},
    });
    await expect(listAnnouncements(ctx as any)).rejects.toThrow('Unauthorized');
  });

  test('updateAnnouncement throws Unauthorized without session', async () => {
    const { updateAnnouncement } = await import('./updateAnnouncement');
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'ann-1' },
      _body: { title: 'Updated' },
    });
    await expect(updateAnnouncement(ctx as any)).rejects.toThrow('Unauthorized');
  });

  test('deleteAnnouncement throws Unauthorized without session', async () => {
    const { deleteAnnouncement } = await import('./deleteAnnouncement');
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'ann-1' },
    });
    await expect(deleteAnnouncement(ctx as any)).rejects.toThrow('Unauthorized');
  });

  test('publishAnnouncement throws Unauthorized without session', async () => {
    const { publishAnnouncement } = await import('./publishAnnouncement');
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'ann-1' },
    });
    await expect(publishAnnouncement(ctx as any)).rejects.toThrow('Unauthorized');
  });

  test('archiveAnnouncement throws Unauthorized without session', async () => {
    const { archiveAnnouncement } = await import('./archiveAnnouncement');
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'ann-1' },
    });
    await expect(archiveAnnouncement(ctx as any)).rejects.toThrow('Unauthorized');
  });
});

// ---------------------------------------------------------------------------
// createAnnouncement
// ---------------------------------------------------------------------------

describe('createAnnouncement', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
  });

  test('creates announcement and returns 201', async () => {
    const { createAnnouncement } = await import('./createAnnouncement');
    mocks = stubRepo(CommunicationsRepository, {
      create: async (data: any) => ({ ...DRAFT_ANNOUNCEMENT, ...data }),
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { title: 'Test Announcement', body: 'Hello world' },
    });
    const res = await createAnnouncement(ctx as any);
    expect(res.status).toBe(201);
  });

  test('sets status to draft and authorId from session', async () => {
    const { createAnnouncement } = await import('./createAnnouncement');
    let capturedData: any;
    mocks = stubRepo(CommunicationsRepository, {
      create: async (data: any) => {
        capturedData = data;
        return { ...DRAFT_ANNOUNCEMENT, ...data };
      },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { title: 'New', body: 'Content' },
    });
    await createAnnouncement(ctx as any);
    expect(capturedData.status).toBe('draft');
    expect(capturedData.authorId).toBe('user-1');
    expect(capturedData.organizationId).toBe('org-1');
  });
});

// ---------------------------------------------------------------------------
// getAnnouncement
// ---------------------------------------------------------------------------

describe('getAnnouncement', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
  });

  test('returns announcement with 200', async () => {
    const { getAnnouncement } = await import('./getAnnouncement');
    mocks = stubRepo(CommunicationsRepository, {
      get: async () => DRAFT_ANNOUNCEMENT,
    });

    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    const res = await getAnnouncement(ctx as any);
    expect(res.status).toBe(200);
  });

  test('throws NotFoundError when announcement does not exist', async () => {
    const { getAnnouncement } = await import('./getAnnouncement');
    mocks = stubRepo(CommunicationsRepository, {
      get: async () => undefined,
    });

    const ctx = makeCtx({ _params: { id: 'nonexistent' } });
    await expect(getAnnouncement(ctx as any)).rejects.toThrow('Announcement');
  });
});

// ---------------------------------------------------------------------------
// listAnnouncements
// ---------------------------------------------------------------------------

describe('listAnnouncements', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
  });

  test('returns paginated list with 200', async () => {
    const { listAnnouncements } = await import('./listAnnouncements');
    mocks = stubRepo(CommunicationsRepository, {
      list: async () => ({ data: [DRAFT_ANNOUNCEMENT], total: 1 }),
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _query: { page: '1', pageSize: '20' },
    });
    const res = await listAnnouncements(ctx as any);
    expect(res.status).toBe(200);
  });

  test('defaults to page 1 and pageSize 20', async () => {
    const { listAnnouncements } = await import('./listAnnouncements');
    let capturedOpts: any;
    mocks = stubRepo(CommunicationsRepository, {
      list: async (_orgId: string, opts: any) => {
        capturedOpts = opts;
        return { data: [], total: 0 };
      },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _query: {},
    });
    await listAnnouncements(ctx as any);
    expect(capturedOpts.limit).toBe(20);
    expect(capturedOpts.offset).toBe(0);
  });

  test('passes status and search filters to repo', async () => {
    const { listAnnouncements } = await import('./listAnnouncements');
    let capturedOpts: any;
    mocks = stubRepo(CommunicationsRepository, {
      list: async (_orgId: string, opts: any) => {
        capturedOpts = opts;
        return { data: [], total: 0 };
      },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _query: { status: 'draft', search: 'test', page: '2', pageSize: '10' },
    });
    await listAnnouncements(ctx as any);
    expect(capturedOpts.status).toBe('draft');
    expect(capturedOpts.search).toBe('test');
    expect(capturedOpts.offset).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// updateAnnouncement
// ---------------------------------------------------------------------------

describe('updateAnnouncement', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
  });

  test('updates draft announcement and returns 200', async () => {
    const { updateAnnouncement } = await import('./updateAnnouncement');
    mocks = stubRepo(CommunicationsRepository, {
      get: async () => DRAFT_ANNOUNCEMENT,
      update: async (_id: string, data: any) => ({ ...DRAFT_ANNOUNCEMENT, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'ann-1' },
      _body: { title: 'Updated Title' },
    });
    const res = await updateAnnouncement(ctx as any);
    expect(res.status).toBe(200);
  });

  test('throws NotFoundError when announcement does not exist', async () => {
    const { updateAnnouncement } = await import('./updateAnnouncement');
    mocks = stubRepo(CommunicationsRepository, {
      get: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { id: 'nonexistent' },
      _body: { title: 'Updated' },
    });
    await expect(updateAnnouncement(ctx as any)).rejects.toThrow('Announcement');
  });

  test('throws BusinessLogicError when announcement is not draft', async () => {
    const { updateAnnouncement } = await import('./updateAnnouncement');
    mocks = stubRepo(CommunicationsRepository, {
      get: async () => PUBLISHED_ANNOUNCEMENT,
    });

    const ctx = makeCtx({
      _params: { id: 'ann-2' },
      _body: { title: 'Updated' },
    });
    await expect(updateAnnouncement(ctx as any)).rejects.toThrow('Only draft announcements can be updated');
  });
});

// ---------------------------------------------------------------------------
// deleteAnnouncement
// ---------------------------------------------------------------------------

describe('deleteAnnouncement', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
  });

  test('deletes draft announcement and returns 200', async () => {
    const { deleteAnnouncement } = await import('./deleteAnnouncement');
    mocks = stubRepo(CommunicationsRepository, {
      get: async () => DRAFT_ANNOUNCEMENT,
      delete: async () => undefined,
    });

    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    const res = await deleteAnnouncement(ctx as any);
    expect(res.status).toBe(200);
  });

  test('throws NotFoundError when announcement does not exist', async () => {
    const { deleteAnnouncement } = await import('./deleteAnnouncement');
    mocks = stubRepo(CommunicationsRepository, {
      get: async () => undefined,
    });

    const ctx = makeCtx({ _params: { id: 'nonexistent' } });
    await expect(deleteAnnouncement(ctx as any)).rejects.toThrow('Announcement');
  });

  test('throws BusinessLogicError when announcement is not draft', async () => {
    const { deleteAnnouncement } = await import('./deleteAnnouncement');
    mocks = stubRepo(CommunicationsRepository, {
      get: async () => PUBLISHED_ANNOUNCEMENT,
    });

    const ctx = makeCtx({ _params: { id: 'ann-2' } });
    await expect(deleteAnnouncement(ctx as any)).rejects.toThrow('Only draft announcements can be deleted');
  });
});

// ---------------------------------------------------------------------------
// publishAnnouncement
// ---------------------------------------------------------------------------

describe('publishAnnouncement', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
  });

  test('publishes draft announcement and returns 200', async () => {
    const { publishAnnouncement } = await import('./publishAnnouncement');
    mocks = stubRepo(CommunicationsRepository, {
      get: async () => DRAFT_ANNOUNCEMENT,
      updateStatus: async (_id: string, status: string, extra: any) => ({
        ...DRAFT_ANNOUNCEMENT,
        status,
        ...extra,
      }),
    });

    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    const res = await publishAnnouncement(ctx as any);
    expect(res.status).toBe(200);
  });

  test('publishes scheduled announcement and returns 200', async () => {
    const { publishAnnouncement } = await import('./publishAnnouncement');
    mocks = stubRepo(CommunicationsRepository, {
      get: async () => SCHEDULED_ANNOUNCEMENT,
      updateStatus: async (_id: string, status: string, extra: any) => ({
        ...SCHEDULED_ANNOUNCEMENT,
        status,
        ...extra,
      }),
    });

    const ctx = makeCtx({ _params: { id: 'ann-4' } });
    const res = await publishAnnouncement(ctx as any);
    expect(res.status).toBe(200);
  });

  test('throws NotFoundError when announcement does not exist', async () => {
    const { publishAnnouncement } = await import('./publishAnnouncement');
    mocks = stubRepo(CommunicationsRepository, {
      get: async () => undefined,
    });

    const ctx = makeCtx({ _params: { id: 'nonexistent' } });
    await expect(publishAnnouncement(ctx as any)).rejects.toThrow('Announcement');
  });

  test('throws BusinessLogicError when announcement is already published', async () => {
    const { publishAnnouncement } = await import('./publishAnnouncement');
    mocks = stubRepo(CommunicationsRepository, {
      get: async () => PUBLISHED_ANNOUNCEMENT,
    });

    const ctx = makeCtx({ _params: { id: 'ann-2' } });
    await expect(publishAnnouncement(ctx as any)).rejects.toThrow('Only draft or scheduled announcements can be published');
  });

  test('throws BusinessLogicError when announcement is archived', async () => {
    const { publishAnnouncement } = await import('./publishAnnouncement');
    mocks = stubRepo(CommunicationsRepository, {
      get: async () => ARCHIVED_ANNOUNCEMENT,
    });

    const ctx = makeCtx({ _params: { id: 'ann-3' } });
    await expect(publishAnnouncement(ctx as any)).rejects.toThrow('Only draft or scheduled announcements can be published');
  });
});

// ---------------------------------------------------------------------------
// archiveAnnouncement
// ---------------------------------------------------------------------------

describe('archiveAnnouncement', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
  });

  test('archives announcement and returns 200', async () => {
    const { archiveAnnouncement } = await import('./archiveAnnouncement');
    mocks = stubRepo(CommunicationsRepository, {
      get: async () => PUBLISHED_ANNOUNCEMENT,
      updateStatus: async (_id: string, status: string) => ({
        ...PUBLISHED_ANNOUNCEMENT,
        status,
      }),
    });

    const ctx = makeCtx({ _params: { id: 'ann-2' } });
    const res = await archiveAnnouncement(ctx as any);
    expect(res.status).toBe(200);
  });

  test('rejects archiving draft announcement (only sent→archived)', async () => {
    const { archiveAnnouncement } = await import('./archiveAnnouncement');
    mocks = stubRepo(CommunicationsRepository, {
      get: async () => DRAFT_ANNOUNCEMENT,
    });

    const ctx = makeCtx({ _params: { id: 'ann-1' } });
    await expect(archiveAnnouncement(ctx as any)).rejects.toThrow('Only sent announcements can be archived');
  });

  test('throws NotFoundError when announcement does not exist', async () => {
    const { archiveAnnouncement } = await import('./archiveAnnouncement');
    mocks = stubRepo(CommunicationsRepository, {
      get: async () => undefined,
    });

    const ctx = makeCtx({ _params: { id: 'nonexistent' } });
    await expect(archiveAnnouncement(ctx as any)).rejects.toThrow('Announcement');
  });

  test('throws BusinessLogicError when announcement is already archived', async () => {
    const { archiveAnnouncement } = await import('./archiveAnnouncement');
    mocks = stubRepo(CommunicationsRepository, {
      get: async () => ARCHIVED_ANNOUNCEMENT,
    });

    const ctx = makeCtx({ _params: { id: 'ann-3' } });
    await expect(archiveAnnouncement(ctx as any)).rejects.toThrow('Only sent announcements can be archived');
  });

  // ─── M7: Officer role enforcement ───────────────────────
  test('returns 403 when non-officer tries to archive', async () => {
    const { archiveAnnouncement } = await import('./archiveAnnouncement');
    restoreRepo(OfficerTermRepository);
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });

    const ctx = makeCtx({ _params: { id: 'ann-2' } });
    const res = await archiveAnnouncement(ctx as any);
    expect(res.status).toBe(403);
  });
});
