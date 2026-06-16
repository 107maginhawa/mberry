import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { deleteEventRegistration } from './deleteEventRegistration';
import { EventRegistrationRepository } from './repos/events.repo';
import { NotFoundError } from '@/core/errors';

describe('deleteEventRegistration — auth guards', () => {
  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _params: { registrationId: 'reg-1' } });
    const response = await deleteEventRegistration(ctx);
    expect(response.status).toBe(401);
  });
});

describe('deleteEventRegistration — business logic', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(EventRegistrationRepository);
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(EventRegistrationRepository);
  });

  test('returns success on delete', async () => {
    const existing = { id: 'reg-1', eventId: 'evt-1', personId: 'p-1', status: 'confirmed' };
    mocks = stubRepo(EventRegistrationRepository, {
      findOneById: async () => existing,
      deleteOneById: async () => undefined,
    });

    const ctx = makeCtx({ _params: { registrationId: 'reg-1' } });
    const response = await deleteEventRegistration(ctx);
    expect(response.status).toBe(200);
    expect((response as any).body.success).toBe(true);
  });

  test('throws NotFoundError when registration not found', async () => {
    mocks = stubRepo(EventRegistrationRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({ _params: { registrationId: 'no-such-reg' } });
    await expect(deleteEventRegistration(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('calls deleteOneById with correct registrationId', async () => {
    const existing = { id: 'reg-55', eventId: 'evt-1', personId: 'p-1', status: 'confirmed' };
    let deletedId = '';
    mocks = stubRepo(EventRegistrationRepository, {
      findOneById: async () => existing,
      deleteOneById: async (id: string) => { deletedId = id; return undefined; },
    });

    const ctx = makeCtx({ _params: { registrationId: 'reg-55' } });
    await deleteEventRegistration(ctx);
    expect(deletedId).toBe('reg-55');
  });
});
