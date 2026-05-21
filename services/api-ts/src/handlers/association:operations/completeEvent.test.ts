import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { completeEvent } from './completeEvent';
import { EventRepository } from './repos/events.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { NotFoundError, BusinessLogicError } from '@/core/errors';

// ─── Fixtures ────────────────────────────────────────────

function makeEvent(overrides: Record<string, any> = {}) {
  return {
    id: 'event-1',
    title: 'Annual Conference',
    status: 'published',
    organizationId: 'org-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────

describe('completeEvent', () => {
  let eventMocks: ReturnType<typeof stubRepo>;
  let officerMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(EventRepository);
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    if (eventMocks) Object.values(eventMocks).forEach((m) => m.mockRestore());
    if (officerMocks) Object.values(officerMocks).forEach((m) => m.mockRestore());
    restoreRepo(EventRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns 200 and completed event for published event', async () => {
    const event = makeEvent();
    const completed = makeEvent({ status: 'completed' });

    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    eventMocks = stubRepo(EventRepository, {
      findOneById: async () => event,
      complete: async () => completed,
    });

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      _params: { eventId: 'event-1' },
    });

    const response = await completeEvent(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('completed');
  });

  test('returns 403 when user is not an officer', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });

    const ctx = makeCtx({
      user: { id: 'member-1', role: 'user', twoFactorEnabled: true },
      _params: { eventId: 'event-1' },
    });

    const response = await completeEvent(ctx);
    expect(response.status).toBe(403);
  });

  test('throws NotFoundError for non-existent event', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    eventMocks = stubRepo(EventRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      _params: { eventId: 'nonexistent' },
    });

    await expect(completeEvent(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws BusinessLogicError for draft event', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    eventMocks = stubRepo(EventRepository, {
      findOneById: async () => makeEvent({ status: 'draft' }),
    });

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      _params: { eventId: 'event-1' },
    });

    await expect(completeEvent(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('throws BusinessLogicError for cancelled event', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    eventMocks = stubRepo(EventRepository, {
      findOneById: async () => makeEvent({ status: 'cancelled' }),
    });

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      _params: { eventId: 'event-1' },
    });

    await expect(completeEvent(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('returns 401 when no user', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { eventId: 'event-1' },
    });

    const response = await completeEvent(ctx);
    expect(response.status).toBe(401);
  });
});
