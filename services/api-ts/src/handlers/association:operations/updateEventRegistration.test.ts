import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { updateEventRegistration } from './updateEventRegistration';
import { EventRegistrationRepository } from './repos/events.repo';
import { NotFoundError } from '@/core/errors';

describe('updateEventRegistration — auth guards', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _params: { registrationId: 'reg-1' }, _body: {} });
    const response = await updateEventRegistration(ctx);
    expect(response.status).toBe(401);
  });
});

describe('updateEventRegistration — business logic', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(EventRegistrationRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(EventRegistrationRepository);
  });

  test('returns updated registration on success', async () => {
    const existing = { id: 'reg-1', eventId: 'evt-1', personId: 'p-1', status: 'confirmed' };
    const updated = { ...existing, status: 'cancelled' };
    mocks = stubRepo(EventRegistrationRepository, {
      findOneById: async () => existing,
      updateOneById: async () => updated,
    });

    const ctx = makeCtx({
      _params: { registrationId: 'reg-1' },
      _body: { status: 'cancelled' },
    });
    const response = await updateEventRegistration(ctx);
    expect(response.status).toBe(200);
    expect((response as any).body.status).toBe('cancelled');
    expect((response as any).body.id).toBe('reg-1');
  });

  test('throws NotFoundError when registration not found', async () => {
    mocks = stubRepo(EventRegistrationRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { registrationId: 'no-such-reg' },
      _body: { status: 'cancelled' },
    });
    await expect(updateEventRegistration(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('partial update — only provided fields forwarded to repo', async () => {
    const existing = { id: 'reg-1', eventId: 'evt-1', personId: 'p-1', status: 'confirmed', notes: null };
    let capturedUpdates: Record<string, unknown> = {};
    mocks = stubRepo(EventRegistrationRepository, {
      findOneById: async () => existing,
      updateOneById: async (_id: string, updates: Record<string, unknown>) => {
        capturedUpdates = updates;
        return { ...existing, ...updates };
      },
    });

    const ctx = makeCtx({
      _params: { registrationId: 'reg-1' },
      _body: { notes: 'VIP seat' },
    });
    await updateEventRegistration(ctx);
    expect(capturedUpdates['notes']).toBe('VIP seat');
    expect(capturedUpdates['status']).toBeUndefined();
  });

  test('calls repo with correct registrationId', async () => {
    const existing = { id: 'reg-55', eventId: 'evt-1', personId: 'p-1', status: 'confirmed' };
    let calledWithId = '';
    mocks = stubRepo(EventRegistrationRepository, {
      findOneById: async (id: string) => { calledWithId = id; return existing; },
      updateOneById: async () => existing,
    });

    const ctx = makeCtx({
      _params: { registrationId: 'reg-55' },
      _body: { status: 'confirmed' },
    });
    await updateEventRegistration(ctx);
    expect(calledWithId).toBe('reg-55');
  });
});
