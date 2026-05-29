import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { cancelEvent } from './cancelEvent';
import { EventRepository } from './repos/events.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { domainEvents } from '@/core/domain-events';
import { NotFoundError, BusinessLogicError } from '@/core/errors';

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

describe('cancelEvent', () => {
  let eventMocks: ReturnType<typeof stubRepo>;
  let officerMocks: ReturnType<typeof stubRepo>;
  let emitSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    restoreRepo(EventRepository);
    restoreRepo(OfficerTermRepository);
    emitSpy = spyOn(domainEvents, 'emit');
  });

  afterEach(() => {
    if (eventMocks) Object.values(eventMocks).forEach((m) => m.mockRestore());
    if (officerMocks) Object.values(officerMocks).forEach((m) => m.mockRestore());
    emitSpy.mockRestore();
    restoreRepo(EventRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('emits event.cancelled when a published event is cancelled', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    eventMocks = stubRepo(EventRepository, {
      findOneById: async () => makeEvent(),
      cancel: async () => makeEvent({ status: 'cancelled' }),
    });

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      _params: { eventId: 'event-1' },
    });

    const response = await cancelEvent(ctx);
    expect(response.status).toBe(200);

    const cancelledEmit = emitSpy.mock.calls.find((c) => c[0] === 'event.cancelled');
    expect(cancelledEmit).toBeDefined();
    expect(cancelledEmit![1]).toMatchObject({
      eventId: 'event-1',
      organizationId: 'org-1',
      cancelledBy: 'officer-1',
    });
  });

  test('returns 403 and does not emit when caller is not an officer', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });

    const ctx = makeCtx({
      user: { id: 'member-1', role: 'user', twoFactorEnabled: true },
      _params: { eventId: 'event-1' },
    });

    const response = await cancelEvent(ctx);
    expect(response.status).toBe(403);
    expect(emitSpy.mock.calls.some((c) => c[0] === 'event.cancelled')).toBe(false);
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

    await expect(cancelEvent(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws BusinessLogicError for already-completed event', async () => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Society Officer' }],
    });
    eventMocks = stubRepo(EventRepository, {
      findOneById: async () => makeEvent({ status: 'completed' }),
    });

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user', twoFactorEnabled: true },
      _params: { eventId: 'event-1' },
    });

    await expect(cancelEvent(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });
});
