import { describe, test, expect, afterEach } from 'bun:test';
import { createDirectoryProfile } from './createDirectoryProfile';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DirectoryProfileRepository } from '@/handlers/association:member/repos/directory.repo';

// ─── Fixtures ────────────────────────────────────────────

const validBody = {
  personId: 'person-1',
  displayName: 'Dr. Juan dela Cruz',
  title: 'General Dentist',
  organization: 'Health Dental',
  specialty: 'General Dentistry',
  location: 'Cebu, PH',
  photoUrl: null,
  bio: null,
  contactEmail: 'juan@example.com',
  contactPhone: null,
  website: null,
  socialLinks: null,
  visibility: 'public',
};

const createdProfile = {
  id: 'dp-new',
  organizationId: 'tenant-1',
  ...validBody,
  visibility: 'public' as const,
  publishedAt: null,
  lastUpdatedAt: new Date('2024-06-01'),
};

// ─── Tests ───────────────────────────────────────────────

describe('createDirectoryProfile', () => {
  afterEach(() => restoreRepo(DirectoryProfileRepository));

  test('returns 401 without user', async () => {
    const ctx = makeCtx({ user: null, _body: validBody });
    const res = await createDirectoryProfile(ctx) as any;

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'Unauthorized' });
  });

  test('returns 403 without organizationId', async () => {
    const ctx = makeCtx({ _body: validBody, organizationId: null });
    const res = await createDirectoryProfile(ctx) as any;

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'Organization context required' });
  });

  test('happy path — returns 201 with created profile', async () => {
    stubRepo(DirectoryProfileRepository, {
      createOne: async () => createdProfile,
    });

    const ctx = makeCtx({ _body: validBody });
    const res = await createDirectoryProfile(ctx) as any;

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('dp-new');
    expect(res.body.displayName).toBe('Dr. Juan dela Cruz');
    expect(res.body.visibility).toBe('public');
    expect(res.body.personId).toBe('person-1');
  });

  test('passes organizationId from context to repo.createOne', async () => {
    let capturedData: any;
    stubRepo(DirectoryProfileRepository, {
      createOne: async (data: any) => {
        capturedData = data;
        return { id: 'dp-new', ...data };
      },
    });

    const ctx = makeCtx({ _body: validBody, organizationId: 'org-99' });
    await createDirectoryProfile(ctx);

    expect(capturedData.organizationId).toBe('org-99');
    expect(capturedData.displayName).toBe('Dr. Juan dela Cruz');
  });

  test('defaults visibility to hidden when not provided', async () => {
    let capturedData: any;
    stubRepo(DirectoryProfileRepository, {
      createOne: async (data: any) => {
        capturedData = data;
        return { id: 'dp-new', ...data };
      },
    });

    const bodyWithoutVisibility = { personId: 'person-1', displayName: 'Dr. Test' };
    const ctx = makeCtx({ _body: bodyWithoutVisibility });
    await createDirectoryProfile(ctx);

    expect(capturedData.visibility).toBe('hidden');
  });

  test('sets auditResourceId after creation', async () => {
    stubRepo(DirectoryProfileRepository, {
      createOne: async () => createdProfile,
    });

    const ctx = makeCtx({ _body: validBody });
    await createDirectoryProfile(ctx);

    expect((ctx as any).get('auditResourceId')).toBe('dp-new');
  });
});
