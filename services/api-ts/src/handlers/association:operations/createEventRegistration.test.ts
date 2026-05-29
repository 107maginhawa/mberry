import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { createEventRegistration } from './createEventRegistration';
import { EventRepository, EventRegistrationRepository, WaitlistEntryRepository } from './repos/events.repo';
import { domainEvents } from '@/core/domain-events';

function makeEvent(overrides: Record<string, any> = {}) {
  return {
    id: 'event-1',
    title: 'Annual Conference',
    status: 'published',
    organizationId: 'tenant-1',
    capacity: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('createEventRegistration', () => {
  let eventMocks: ReturnType<typeof stubRepo>;
  let regMocks: ReturnType<typeof stubRepo>;
  let waitlistMocks: ReturnType<typeof stubRepo>;
  let emitSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    restoreRepo(EventRepository);
    restoreRepo(EventRegistrationRepository);
    restoreRepo(WaitlistEntryRepository);
    emitSpy = spyOn(domainEvents, 'emit');
  });

  afterEach(() => {
    if (eventMocks) Object.values(eventMocks).forEach((m) => m.mockRestore());
    if (regMocks) Object.values(regMocks).forEach((m) => m.mockRestore());
    if (waitlistMocks) Object.values(waitlistMocks).forEach((m) => m.mockRestore());
    emitSpy.mockRestore();
    restoreRepo(EventRepository);
    restoreRepo(EventRegistrationRepository);
    restoreRepo(WaitlistEntryRepository);
  });

  test('emits event.registered with status confirmed for an open published event', async () => {
    eventMocks = stubRepo(EventRepository, {
      findOneById: async () => makeEvent(),
    });
    regMocks = stubRepo(EventRegistrationRepository, {
      count: async () => 0,
      createOne: async () => ({ id: 'reg-1', eventId: 'event-1', personId: 'member-1', status: 'confirmed', organizationId: 'tenant-1' }),
    });

    const ctx = makeCtx({
      user: { id: 'member-1', role: 'user', twoFactorEnabled: true },
      _body: { eventId: 'event-1', personId: 'member-1' },
    });

    const response = await createEventRegistration(ctx);
    expect(response.status).toBe(201);

    const emit = emitSpy.mock.calls.find((c) => c[0] === 'event.registered');
    expect(emit).toBeDefined();
    expect(emit![1]).toMatchObject({
      eventId: 'event-1',
      personId: 'member-1',
      organizationId: 'tenant-1',
      status: 'confirmed',
    });
  });

  test('emits event.registered with status waitlisted when at capacity', async () => {
    eventMocks = stubRepo(EventRepository, {
      findOneById: async () => makeEvent({ capacity: 1 }),
    });
    regMocks = stubRepo(EventRegistrationRepository, {
      // 0 existing for this person (dup-check), 1 confirmed for the event (capacity)
      count: async (f: any) => (f?.personId ? 0 : 1),
    });
    waitlistMocks = stubRepo(WaitlistEntryRepository, {
      nextPosition: async () => 1,
      createOne: async () => ({ id: 'wl-1', eventId: 'event-1', personId: 'member-1', position: 1, organizationId: 'tenant-1' }),
    });

    const ctx = makeCtx({
      user: { id: 'member-1', role: 'user', twoFactorEnabled: true },
      _body: { eventId: 'event-1', personId: 'member-1' },
    });

    const response = await createEventRegistration(ctx);
    expect(response.status).toBe(201);
    expect(response.body.waitlisted).toBe(true);

    const emit = emitSpy.mock.calls.find((c) => c[0] === 'event.registered');
    expect(emit).toBeDefined();
    expect(emit![1]).toMatchObject({
      eventId: 'event-1',
      personId: 'member-1',
      status: 'waitlisted',
    });
  });

  test('rejects duplicate active registration for the same person+event with 409', async () => {
    eventMocks = stubRepo(EventRepository, {
      findOneById: async () => makeEvent(),
    });
    regMocks = stubRepo(EventRegistrationRepository, {
      count: async () => 1, // person already has a confirmed registration
      createOne: async () => ({ id: 'reg-x' }),
    });

    const ctx = makeCtx({
      user: { id: 'member-1', role: 'user', twoFactorEnabled: true },
      _body: { eventId: 'event-1', personId: 'member-1' },
    });

    await expect(createEventRegistration(ctx)).rejects.toThrow();
    expect(emitSpy.mock.calls.some((c) => c[0] === 'event.registered')).toBe(false);
  });

  test('rejects registration for a non-published event without emitting', async () => {
    eventMocks = stubRepo(EventRepository, {
      findOneById: async () => makeEvent({ status: 'completed' }),
    });

    const ctx = makeCtx({
      user: { id: 'member-1', role: 'user', twoFactorEnabled: true },
      _body: { eventId: 'event-1', personId: 'member-1' },
    });

    await expect(createEventRegistration(ctx)).rejects.toThrow();
    expect(emitSpy.mock.calls.some((c) => c[0] === 'event.registered')).toBe(false);
  });
});
