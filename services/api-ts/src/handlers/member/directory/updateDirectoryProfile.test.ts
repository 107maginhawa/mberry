import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { updateDirectoryProfile } from './updateDirectoryProfile';
import { DirectoryProfileRepository } from '@/handlers/association:member/repos/directory.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeProfile = {
  id: 'profile-1',
  organizationId: 'tenant-1',
  personId: 'user-1',
  headline: 'Senior Dentist',
  bio: 'Experienced dental surgeon',
  visibility: 'public' as const,
  lastUpdatedAt: new Date('2024-01-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// ─── Tests ──────────────────────────────────────────────

describe('updateDirectoryProfile', () => {
  afterEach(() => restoreRepo(DirectoryProfileRepository));

  test('happy path — updates profile and returns updated data', async () => {
    const updated = { ...fakeProfile, headline: 'Chief Dental Officer' };
    stubRepo(DirectoryProfileRepository, {
      findOneById: async () => fakeProfile,
      updateOneById: async () => updated,
    });

    const ctx = makeCtx({
      _params: { profileId: 'profile-1' },
      _body: { headline: 'Chief Dental Officer' },
    });
    const res = await updateDirectoryProfile(ctx);

    expect(res.status).toBe(200);
    expect(res.body.headline).toBe('Chief Dental Officer');
    expect(res.body.id).toBe('profile-1');
  });

  test('throws on missing session (unauthorized)', async () => {
    stubRepo(DirectoryProfileRepository, {
      findOneById: async () => fakeProfile,
      updateOneById: async () => fakeProfile,
    });

    const ctx = makeCtx({ user: null, session: null, _params: { profileId: 'profile-1' }, _body: {} });
    await expect(updateDirectoryProfile(ctx)).rejects.toThrow();
  });

  test('throws NotFoundError when profile does not exist', async () => {
    stubRepo(DirectoryProfileRepository, {
      findOneById: async () => null,
      updateOneById: async () => fakeProfile,
    });

    const ctx = makeCtx({ _params: { profileId: 'no-such' }, _body: { headline: 'X' } });
    await expect(updateDirectoryProfile(ctx)).rejects.toThrow();
  });

  test('merges body with lastUpdatedAt in update call', async () => {
    let capturedData: any;
    stubRepo(DirectoryProfileRepository, {
      findOneById: async () => fakeProfile,
      updateOneById: async (_id: string, data: any) => {
        capturedData = data;
        return { ...fakeProfile, ...data };
      },
    });

    const ctx = makeCtx({
      _params: { profileId: 'profile-1' },
      _body: { bio: 'New bio text' },
    });
    await updateDirectoryProfile(ctx);

    expect(capturedData.bio).toBe('New bio text');
    // lastUpdatedAt should be set to a Date by the handler
    expect(capturedData.lastUpdatedAt).toBeInstanceOf(Date);
  });

  test('passes correct profileId to updateOneById', async () => {
    let capturedId: string | undefined;
    stubRepo(DirectoryProfileRepository, {
      findOneById: async () => fakeProfile,
      updateOneById: async (id: string, data: any) => {
        capturedId = id;
        return { ...fakeProfile, ...data };
      },
    });

    const ctx = makeCtx({
      _params: { profileId: 'profile-1' },
      _body: { headline: 'Updated' },
    });
    await updateDirectoryProfile(ctx);

    expect(capturedId).toBe('profile-1');
  });
});
