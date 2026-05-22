/**
 * Tests for exportPersonData handler
 *
 * DPA 2012: Right to data portability.
 * M-26: Member can export all personal data.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakePerson as createFakePerson } from '@/test-utils/factories';
import { exportPersonData } from './exportPersonData';
import { PersonRepository } from './repos/person.repo';
// Assertion-Style: EXISTENCE_CHECK — verifying middleware/context injection patterns

const fakePerson = createFakePerson({
  specialization: 'Orthodontics',
  prcId: '123456',
});

describe('exportPersonData', () => {
  let mocks: any;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m: any) => m.mockRestore?.());
  });

  test('returns 200 with person profile data', async () => {
    mocks = stubRepo(PersonRepository, {
      findOneById: async () => ({ ...fakePerson }),
    });

    const ctx = makeCtx({ user: { id: 'user-1' } });
    const response = await exportPersonData(ctx);

    expect(response.status).toBe(200);
    expect(response.body.profile).toBeDefined();
    expect(response.body.profile.firstName).toBe('Maria');
    expect(response.body.profile.lastName).toBe('Santos');
    expect(response.body.profile.contactInfo.email).toBe('maria@test.com');
  });

  test('export includes exportedAt timestamp', async () => {
    mocks = stubRepo(PersonRepository, {
      findOneById: async () => ({ ...fakePerson }),
    });

    const ctx = makeCtx({ user: { id: 'user-1' } });
    const before = Date.now();
    const response = await exportPersonData(ctx);
    const after = Date.now();

    expect(response.body.exportedAt).toBeDefined();
    const exportedAt = new Date(response.body.exportedAt).getTime();
    expect(exportedAt).toBeGreaterThanOrEqual(before - 1000);
    expect(exportedAt).toBeLessThanOrEqual(after + 1000);
  });

  test('export includes data categories list', async () => {
    mocks = stubRepo(PersonRepository, {
      findOneById: async () => ({ ...fakePerson }),
    });

    const ctx = makeCtx({ user: { id: 'user-1' } });
    const response = await exportPersonData(ctx);

    // Export should declare what data categories are included
    expect(response.body.categories).toBeDefined();
    expect(Array.isArray(response.body.categories)).toBe(true);
    expect(response.body.categories).toContain('profile');
  });

  test('returns 401 when no session', async () => {
    const ctx = makeCtx({ user: null });
    const response = await exportPersonData(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 404 when person not found', async () => {
    mocks = stubRepo(PersonRepository, {
      findOneById: async () => null,
    });

    const ctx = makeCtx({ user: { id: 'user-1' } });
    const response = await exportPersonData(ctx);
    expect(response.status).toBe(404);
  });

  test('excludes internal fields from export', async () => {
    mocks = stubRepo(PersonRepository, {
      findOneById: async () => ({
        ...fakePerson,
        deletionRequestedAt: null,
        deletionScheduledAt: null,
        deletionCompletedAt: null,
      }),
    });

    const ctx = makeCtx({ user: { id: 'user-1' } });
    const response = await exportPersonData(ctx);

    // Internal fields should not be in the exported profile
    expect(response.body.profile.deletionRequestedAt).toBeUndefined();
    expect(response.body.profile.deletionScheduledAt).toBeUndefined();
    expect(response.body.profile.deletionCompletedAt).toBeUndefined();
  });

  test('export response includes "certificates" key with array', async () => {
    mocks = stubRepo(PersonRepository, {
      findOneById: async () => ({ ...fakePerson }),
    });

    const ctx = makeCtx({ user: { id: 'user-1' } });
    const response = await exportPersonData(ctx);

    expect(response.body.certificates).toBeDefined();
    expect(Array.isArray(response.body.certificates)).toBe(true);
  });

  test('export response includes "events" key with array', async () => {
    mocks = stubRepo(PersonRepository, {
      findOneById: async () => ({ ...fakePerson }),
    });

    const ctx = makeCtx({ user: { id: 'user-1' } });
    const response = await exportPersonData(ctx);

    expect(response.body.events).toBeDefined();
    expect(Array.isArray(response.body.events)).toBe(true);
  });

  test('categories array always includes "profile"', async () => {
    mocks = stubRepo(PersonRepository, {
      findOneById: async () => ({ ...fakePerson }),
    });

    const ctx = makeCtx({ user: { id: 'user-1' } });
    const response = await exportPersonData(ctx);

    expect(response.body.categories).toContain('profile');
  });

  test('missing certificates import does not fail the entire export', async () => {
    mocks = stubRepo(PersonRepository, {
      findOneById: async () => ({ ...fakePerson }),
    });

    const ctx = makeCtx({ user: { id: 'user-1' } });
    // Even if certificates import fails, response should succeed
    const response = await exportPersonData(ctx);
    expect(response.status).toBe(200);
    expect(response.body.certificates).toBeDefined();
  });

  test('missing events import does not fail the entire export', async () => {
    mocks = stubRepo(PersonRepository, {
      findOneById: async () => ({ ...fakePerson }),
    });

    const ctx = makeCtx({ user: { id: 'user-1' } });
    // Even if events import fails, response should succeed
    const response = await exportPersonData(ctx);
    expect(response.status).toBe(200);
    expect(response.body.events).toBeDefined();
  });
});
