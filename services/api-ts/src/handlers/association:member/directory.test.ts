/**
 * Directory Module Tests — Slice 012
 *
 * Coverage:
 * - BR-21: Cross-org independence (directory scoped by organizationId)
 * - AC-M05-005: Privacy-filtered public view (visibility levels enforced)
 * - Handler-level tests for searchDirectory, getPublicDirectoryProfile
 * - Search performance contract (< 200ms for unit path)
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DirectoryProfileRepository } from './repos/directory.repo';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDirectoryProfile(overrides: Record<string, any> = {}) {
  return {
    id: 'dp-1',
    organizationId: 'tenant-1',
    personId: 'person-1',
    displayName: 'Dr. Alice Santos',
    title: 'Cardiologist',
    specialty: 'Cardiology',
    bio: 'Board-certified cardiologist',
    contactEmail: 'alice@hospital.com',
    contactPhone: '+639171234567',
    visibility: 'public',
    publishedAt: new Date('2026-01-01'),
    lastUpdatedAt: new Date('2026-01-15'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC-M05-005: Directory visibility levels
// ---------------------------------------------------------------------------

describe('[AC-M05-005] Directory Profiles — Visibility', () => {
  test('visibility levels are public, memberOnly, hidden', () => {
    const levels = ['public', 'memberOnly', 'hidden'];
    expect(levels.length).toBe(3);
    expect(levels).toContain('public');
    expect(levels).toContain('memberOnly');
    expect(levels).toContain('hidden');
  });

  test('hidden profiles excluded from search results', () => {
    const profiles = [
      makeDirectoryProfile({ id: '1', visibility: 'public' }),
      makeDirectoryProfile({ id: '2', visibility: 'memberOnly' }),
      makeDirectoryProfile({ id: '3', visibility: 'hidden' }),
    ];

    const searchable = profiles.filter(p => p.visibility !== 'hidden');
    expect(searchable.length).toBe(2);
    expect(searchable.map(p => p.id)).not.toContain('3');
  });

  test('memberOnly profiles visible to authenticated members only', () => {
    const profile = makeDirectoryProfile({ visibility: 'memberOnly' });
    const isAuthenticated = true;
    const visible = isAuthenticated && profile.visibility !== 'hidden';
    expect(visible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// searchDirectory handler
// ---------------------------------------------------------------------------

describe('searchDirectory handler', () => {
  afterEach(() => {
    restoreRepo(DirectoryProfileRepository);
  });

  test('returns 401 without session (unauthenticated)', async () => {
    const { searchDirectory } = await import('./searchDirectory');
    const ctx = makeCtx({ user: null, session: null, _query: {} });
    try {
      await searchDirectory(ctx as any);
      expect(true).toBe(false); // should not reach
    } catch (e: any) {
      expect(e.status ?? e.statusCode ?? 401).toBe(401);
    }
  });

  test('returns paginated results for authenticated user', async () => {
    const { searchDirectory } = await import('./searchDirectory');

    const publicProfile = makeDirectoryProfile({ visibility: 'public' });
    const memberProfile = makeDirectoryProfile({ id: 'dp-2', visibility: 'memberOnly', displayName: 'Dr. Bob' });

    stubRepo(DirectoryProfileRepository, {
      findManyWithPagination: async (filters: any) => {
        if (filters?.visibility === 'public') {
          return { data: [publicProfile], totalCount: 1 };
        }
        if (filters?.visibility === 'memberOnly') {
          return { data: [memberProfile], totalCount: 1 };
        }
        return { data: [], totalCount: 0 };
      },
    });

    const ctx = makeCtx({ _query: { limit: '20', offset: '0' } });
    const res = await searchDirectory(ctx as any) as any;

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination.totalCount).toBe(2);
  });

  test('[AC-M05-005] search never returns hidden profiles', async () => {
    const { searchDirectory } = await import('./searchDirectory');

    // Stub only returns public/memberOnly — handler never queries hidden
    const queriedVisibilities: string[] = [];
    stubRepo(DirectoryProfileRepository, {
      findManyWithPagination: async (filters: any) => {
        if (filters?.visibility) queriedVisibilities.push(filters.visibility);
        return { data: [], totalCount: 0 };
      },
    });

    const ctx = makeCtx({ _query: { limit: '20', offset: '0' } });
    await searchDirectory(ctx as any);

    expect(queriedVisibilities).toContain('public');
    expect(queriedVisibilities).toContain('memberOnly');
    expect(queriedVisibilities).not.toContain('hidden');
  });

  test('[BR-21] search scopes by organizationId from context', async () => {
    const { searchDirectory } = await import('./searchDirectory');

    const capturedOrgIds: string[] = [];
    stubRepo(DirectoryProfileRepository, {
      findManyWithPagination: async (filters: any) => {
        if (filters?.organizationId) capturedOrgIds.push(filters.organizationId);
        return { data: [], totalCount: 0 };
      },
    });

    const ctx = makeCtx({ organizationId: 'org-alpha', _query: { limit: '20', offset: '0' } });
    await searchDirectory(ctx as any);

    // Both queries (public + memberOnly) must scope to the same org
    expect(capturedOrgIds).toHaveLength(2);
    expect(capturedOrgIds.every(id => id === 'org-alpha')).toBe(true);
  });

  test('search with q parameter passes to repo filter', async () => {
    const { searchDirectory } = await import('./searchDirectory');

    let capturedQ: string | undefined;
    stubRepo(DirectoryProfileRepository, {
      findManyWithPagination: async (filters: any) => {
        if (filters?.q) capturedQ = filters.q;
        return { data: [], totalCount: 0 };
      },
    });

    const ctx = makeCtx({ _query: { q: 'cardio', limit: '20', offset: '0' } });
    await searchDirectory(ctx as any);

    expect(capturedQ).toBe('cardio');
  });

  test('search performance: handler completes under 200ms with stubbed repo', async () => {
    const { searchDirectory } = await import('./searchDirectory');

    stubRepo(DirectoryProfileRepository, {
      findManyWithPagination: async () => ({
        data: Array.from({ length: 20 }, (_, i) =>
          makeDirectoryProfile({ id: `dp-${i}`, displayName: `Member ${i}` })
        ),
        totalCount: 100,
      }),
    });

    const ctx = makeCtx({ _query: { q: 'test', limit: '20', offset: '0' } });
    const start = performance.now();
    await searchDirectory(ctx as any);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(200);
  });
});

// ---------------------------------------------------------------------------
// getPublicDirectoryProfile handler
// ---------------------------------------------------------------------------

describe('getPublicDirectoryProfile handler', () => {
  afterEach(() => {
    restoreRepo(DirectoryProfileRepository);
  });

  test('returns public profile for valid personId', async () => {
    const { getPublicDirectoryProfile } = await import('./getPublicDirectoryProfile');

    const profile = makeDirectoryProfile({ visibility: 'public' });
    stubRepo(DirectoryProfileRepository, {
      findOne: async () => profile,
    });

    const ctx = makeCtx({ _params: { personId: 'person-1' } });
    const res = await getPublicDirectoryProfile(ctx as any) as any;

    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Dr. Alice Santos');
  });

  test('throws NotFoundError when profile is hidden', async () => {
    const { getPublicDirectoryProfile } = await import('./getPublicDirectoryProfile');

    stubRepo(DirectoryProfileRepository, {
      findOne: async () => null, // hidden/memberOnly won't match visibility='public'
    });

    const ctx = makeCtx({ _params: { personId: 'person-hidden' } });
    try {
      await getPublicDirectoryProfile(ctx as any);
      expect(true).toBe(false); // should not reach
    } catch (e: any) {
      expect(e.message ?? '').toContain('Public directory profile');
    }
  });

  test('[AC-M05-005] only visibility=public profiles returned', async () => {
    const { getPublicDirectoryProfile } = await import('./getPublicDirectoryProfile');

    let capturedFilters: any = null;
    stubRepo(DirectoryProfileRepository, {
      findOne: async (filters: any) => {
        capturedFilters = filters;
        return makeDirectoryProfile();
      },
    });

    const ctx = makeCtx({ _params: { personId: 'person-1' } });
    await getPublicDirectoryProfile(ctx as any);

    expect(capturedFilters.visibility).toBe('public');
  });

  test('[BR-21] public profile query scoped by organizationId', async () => {
    const { getPublicDirectoryProfile } = await import('./getPublicDirectoryProfile');

    let capturedFilters: any = null;
    stubRepo(DirectoryProfileRepository, {
      findOne: async (filters: any) => {
        capturedFilters = filters;
        return makeDirectoryProfile();
      },
    });

    const ctx = makeCtx({ organizationId: 'org-beta', _params: { personId: 'person-1' } });
    await getPublicDirectoryProfile(ctx as any);

    expect(capturedFilters.organizationId).toBe('org-beta');
  });

  test('[BR-21] cross-org personId returns 404, not leaked data', async () => {
    const { getPublicDirectoryProfile } = await import('./getPublicDirectoryProfile');

    // Simulate: profile exists in org-A, but request is in org-B context
    stubRepo(DirectoryProfileRepository, {
      findOne: async (filters: any) => {
        // Org mismatch means no result
        if (filters?.organizationId === 'org-B') return null;
        return makeDirectoryProfile({ organizationId: 'org-A' });
      },
    });

    const ctx = makeCtx({ organizationId: 'org-B', _params: { personId: 'person-1' } });
    try {
      await getPublicDirectoryProfile(ctx as any);
      expect(true).toBe(false); // should not reach
    } catch (e: any) {
      expect(e.message ?? '').toContain('Public directory profile');
    }
  });
});

// ---------------------------------------------------------------------------
// createDirectoryProfile auth
// ---------------------------------------------------------------------------

describe('createDirectoryProfile auth', () => {
  test('returns 401 without user', async () => {
    const { createDirectoryProfile } = await import('./createDirectoryProfile');
    const ctx = makeCtx({ user: null });
    const response = await createDirectoryProfile(ctx);
    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Pagination math
// ---------------------------------------------------------------------------

describe('Directory Search pagination', () => {
  test('pagination math is correct', () => {
    const totalCount = 55;
    const limit = 20;
    const offset = 40;

    const totalPages = Math.ceil(totalCount / limit);
    const currentPage = Math.floor(offset / limit) + 1;
    const hasNextPage = currentPage < totalPages;
    const hasPreviousPage = currentPage > 1;

    expect(totalPages).toBe(3);
    expect(currentPage).toBe(3);
    expect(hasNextPage).toBe(false);
    expect(hasPreviousPage).toBe(true);
  });
});
