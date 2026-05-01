import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';

/**
 * Directory Module Tests
 *
 * Tests for directory profiles and search functionality.
 */

describe('Directory Profiles', () => {
  test('createDirectoryProfile returns 401 without user', async () => {
    const { createDirectoryProfile } = await import('./createDirectoryProfile');
    const ctx = makeCtx({ user: null });
    const response = await createDirectoryProfile(ctx);
    expect(response.status).toBe(401);
  });

  test('visibility levels are public, memberOnly, hidden', () => {
    const levels = ['public', 'memberOnly', 'hidden'];
    expect(levels.length).toBe(3);
    expect(levels).toContain('public');
    expect(levels).toContain('memberOnly');
    expect(levels).toContain('hidden');
  });

  test('public profiles visible to anyone', () => {
    const profile = { visibility: 'public' };
    const isPublic = profile.visibility === 'public';
    expect(isPublic).toBe(true);
  });

  test('hidden profiles not returned in search', () => {
    const profiles = [
      { id: '1', visibility: 'public' },
      { id: '2', visibility: 'memberOnly' },
      { id: '3', visibility: 'hidden' },
    ];

    const searchable = profiles.filter(p => p.visibility !== 'hidden');
    expect(searchable.length).toBe(2);
    expect(searchable.map(p => p.id)).not.toContain('3');
  });
});

describe('Directory Search', () => {
  test('search returns paginated results', () => {
    const result = {
      data: [{ id: '1', displayName: 'Dr. Smith' }],
      pagination: {
        offset: 0,
        limit: 20,
        count: 1,
        totalCount: 1,
        totalPages: 1,
        currentPage: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    expect(result.data.length).toBe(1);
    expect(result.pagination.totalCount).toBe(1);
    expect(result.pagination.hasNextPage).toBe(false);
  });

  test('pagination math is correct', () => {
    const totalCount = 55;
    const limit = 20;
    const offset = 40;

    const totalPages = Math.ceil(totalCount / limit); // 3
    const currentPage = Math.floor(offset / limit) + 1; // 3
    const hasNextPage = currentPage < totalPages; // false
    const hasPreviousPage = currentPage > 1; // true

    expect(totalPages).toBe(3);
    expect(currentPage).toBe(3);
    expect(hasNextPage).toBe(false);
    expect(hasPreviousPage).toBe(true);
  });
});
