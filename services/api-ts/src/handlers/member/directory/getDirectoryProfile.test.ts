import { describe, test, expect, afterEach } from 'bun:test';
import { getDirectoryProfile } from './getDirectoryProfile';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DirectoryProfileRepository } from '@/handlers/association:member/repos/directory.repo';

// ─── Fixtures ────────────────────────────────────────────

const fakeProfile = {
  id: 'dp-1',
  organizationId: 'tenant-1',
  personId: 'user-1',
  displayName: 'Dr. Maria Santos',
  title: 'Dentist',
  organization: 'Santos Dental Clinic',
  specialty: 'Orthodontics',
  location: 'Manila, PH',
  photoUrl: null,
  bio: 'Experienced orthodontist with 10 years in practice.',
  contactEmail: 'maria@example.com',
  contactPhone: null,
  website: null,
  socialLinks: null,
  visibility: 'public' as const,
  publishedAt: new Date('2024-01-01'),
  lastUpdatedAt: new Date('2024-01-01'),
};

// ─── Tests ───────────────────────────────────────────────

describe('getDirectoryProfile', () => {
  afterEach(() => restoreRepo(DirectoryProfileRepository));

  test('happy path — returns 200 with profile data', async () => {
    stubRepo(DirectoryProfileRepository, {
      findOneById: async () => fakeProfile,
    });

    const ctx = makeCtx({ _params: { profileId: 'dp-1' } });
    const res = await getDirectoryProfile(ctx) as any;

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('dp-1');
    expect(res.body.displayName).toBe('Dr. Maria Santos');
    expect(res.body.visibility).toBe('public');
    expect(res.body.specialty).toBe('Orthodontics');
  });

  test('throws NotFoundError when profile does not exist', async () => {
    stubRepo(DirectoryProfileRepository, {
      findOneById: async () => null,
    });

    const ctx = makeCtx({ _params: { profileId: 'no-such' } });
    await expect(getDirectoryProfile(ctx)).rejects.toThrow();
  });

  test('throws when no session (unauthorized)', async () => {
    stubRepo(DirectoryProfileRepository, {
      findOneById: async () => fakeProfile,
    });

    const ctx = makeCtx({ user: null, session: null, _params: { profileId: 'dp-1' } });
    await expect(getDirectoryProfile(ctx)).rejects.toThrow();
  });

  test('calls findOneById with correct profileId', async () => {
    let capturedId: string | undefined;
    stubRepo(DirectoryProfileRepository, {
      findOneById: async (id: string) => {
        capturedId = id;
        return fakeProfile;
      },
    });

    const ctx = makeCtx({ _params: { profileId: 'dp-1' } });
    await getDirectoryProfile(ctx);

    expect(capturedId).toBe('dp-1');
  });

  test('returns memberOnly profile when session present', async () => {
    stubRepo(DirectoryProfileRepository, {
      findOneById: async () => ({ ...fakeProfile, visibility: 'memberOnly' as const }),
    });

    const ctx = makeCtx({ _params: { profileId: 'dp-1' } });
    const res = await getDirectoryProfile(ctx) as any;

    expect(res.status).toBe(200);
    expect(res.body.visibility).toBe('memberOnly');
  });
});
