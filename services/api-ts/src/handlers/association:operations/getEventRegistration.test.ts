import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { NotFoundError } from '@/core/errors';
import { getEventRegistration } from './getEventRegistration';
import { EventRegistrationRepository } from './repos/events.repo';

describe('getEventRegistration', () => {
  afterEach(() => restoreRepo(EventRegistrationRepository));

  test('returns 401 when unauthorized', async () => {
    const ctx = makeCtx({ user: null, _params: { registrationId: 'reg-1' } });
    const response = await getEventRegistration(ctx);
    expect(response.status).toBe(401);
  });

  test('throws NotFoundError when registration missing', async () => {
    stubRepo(EventRegistrationRepository, { findOneById: async () => null });
    const ctx = makeCtx({ _params: { registrationId: 'missing' } });
    await expect(getEventRegistration(ctx)).rejects.toThrow(NotFoundError);
  });

  test('returns 200 with registration on happy path', async () => {
    const registration = { id: 'reg-1', eventId: 'evt-1', personId: 'person-1' };
    stubRepo(EventRegistrationRepository, { findOneById: async () => registration });
    const ctx = makeCtx({ _params: { registrationId: 'reg-1' } });
    const response = await getEventRegistration(ctx);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(registration);
  });
});
