import { describe, test, expect } from 'bun:test';
import { generateSlug, ensureUniqueSlug } from './slug';
import type { OrganizationRepository } from '../repos/platform-admin.repo';
// Factory N/A: utility function test — primitive inputs/outputs, no domain entities

describe('generateSlug', () => {
  test('converts name to kebab-case', () => {
    expect(generateSlug('Philippine Dental Association')).toBe('philippine-dental-association');
  });

  test('strips special characters', () => {
    expect(generateSlug("St. Luke's Medical & Health")).toBe('st-lukes-medical-health');
    expect(generateSlug('Test (Chapter 1)')).toBe('test-chapter-1');
  });

  test('collapses multiple hyphens', () => {
    expect(generateSlug('  Hello   World  ')).toBe('hello-world');
  });

  test('handles empty-ish input', () => {
    expect(generateSlug('   ')).toBe('');
  });

  test('preserves numbers', () => {
    expect(generateSlug('Region 7 Chapter')).toBe('region-7-chapter');
  });
});

// ---------------------------------------------------------------------------
// ensureUniqueSlug
// ---------------------------------------------------------------------------

/**
 * Build a stub OrganizationRepository whose findBySlug returns a truthy object
 * for every slug in the `taken` set, and null for all others.
 */
function makeRepo(taken: Set<string>): Pick<OrganizationRepository, 'findBySlug'> {
  return {
    findBySlug: async (slug: string) =>
      taken.has(slug) ? ({ id: 'stub', slug } as never) : null,
  } as Pick<OrganizationRepository, 'findBySlug'>;
}

describe('ensureUniqueSlug', () => {
  test('returns base slug when first candidate is available', async () => {
    const repo = makeRepo(new Set());
    const result = await ensureUniqueSlug('pda', repo as OrganizationRepository);
    expect(result).toBe('pda');
  });

  test('returns base-2 when base is taken', async () => {
    const repo = makeRepo(new Set(['pda']));
    const result = await ensureUniqueSlug('pda', repo as OrganizationRepository);
    expect(result).toBe('pda-2');
  });

  test('increments suffix past multiple collisions', async () => {
    // 'pda', 'pda-2', 'pda-3' are taken — should return 'pda-4'
    const repo = makeRepo(new Set(['pda', 'pda-2', 'pda-3']));
    const result = await ensureUniqueSlug('pda', repo as OrganizationRepository);
    expect(result).toBe('pda-4');
  });

  test('handles empty string base slug', async () => {
    // Empty slug is free — returns '' immediately (no collision loop)
    const repo = makeRepo(new Set());
    const result = await ensureUniqueSlug('', repo as OrganizationRepository);
    expect(result).toBe('');
  });
});
