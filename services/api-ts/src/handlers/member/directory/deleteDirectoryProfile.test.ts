import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { deleteDirectoryProfile } from './deleteDirectoryProfile';
import { DirectoryProfileRepository } from '@/handlers/association:member/repos/directory.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeProfile = {
  id: 'profile-1',
  organizationId: 'tenant-1',
  personId: 'user-1',
  headline: 'Senior Dentist',
  visibility: 'public' as const,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// ─── Tests ──────────────────────────────────────────────

describe('deleteDirectoryProfile', () => {
  afterEach(() => restoreRepo(DirectoryProfileRepository));

  test('happy path — returns 204 with null body', async () => {
    stubRepo(DirectoryProfileRepository, {
      findOneById: async () => fakeProfile,
      deleteOneById: async () => undefined,
    });

    const ctx = makeCtx({ _params: { profileId: 'profile-1' } });
    const res = await deleteDirectoryProfile(ctx);

    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
  });

  test('throws on missing session (unauthorized)', async () => {
    stubRepo(DirectoryProfileRepository, {
      findOneById: async () => fakeProfile,
      deleteOneById: async () => undefined,
    });

    const ctx = makeCtx({ user: null, session: null, _params: { profileId: 'profile-1' } });
    await expect(deleteDirectoryProfile(ctx)).rejects.toThrow();
  });

  test('throws NotFoundError when profile does not exist', async () => {
    stubRepo(DirectoryProfileRepository, {
      findOneById: async () => null,
      deleteOneById: async () => undefined,
    });

    const ctx = makeCtx({ _params: { profileId: 'no-such' } });
    await expect(deleteDirectoryProfile(ctx)).rejects.toThrow();
  });

  test('calls deleteOneById with correct profileId', async () => {
    let capturedId: string | undefined;
    stubRepo(DirectoryProfileRepository, {
      findOneById: async () => fakeProfile,
      deleteOneById: async (id: string) => {
        capturedId = id;
        return undefined;
      },
    });

    const ctx = makeCtx({ _params: { profileId: 'profile-1' } });
    await deleteDirectoryProfile(ctx);

    expect(capturedId).toBe('profile-1');
  });
});
