import { describe, test, expect } from 'bun:test';
import { generateEventSlug, ensureUniqueEventSlug } from './event-slug';

describe('generateEventSlug', () => {
  test('converts title to URL-safe slug', () => {
    expect(generateEventSlug('Annual CPD Seminar 2026')).toBe('annual-cpd-seminar-2026');
  });

  test('strips special characters', () => {
    expect(generateEventSlug('PDA NCR — Dental Mission!')).toBe('pda-ncr-dental-mission');
    expect(generateEventSlug('Test@#$%Event')).toBe('testevent');
  });

  test('collapses multiple hyphens', () => {
    expect(generateEventSlug('hello---world')).toBe('hello-world');
  });

  test('trims leading/trailing hyphens', () => {
    expect(generateEventSlug('-hello-')).toBe('hello');
  });

  test('handles empty string', () => {
    expect(generateEventSlug('')).toBe('');
  });

  test('handles all-special-character title', () => {
    expect(generateEventSlug('!@#$%')).toBe('');
  });
});

describe('ensureUniqueEventSlug', () => {
  test('returns base slug when no collision', async () => {
    const mockRepo = { findBySlug: async () => undefined } as any;
    const slug = await ensureUniqueEventSlug('cpd-seminar', mockRepo);
    expect(slug).toBe('cpd-seminar');
  });

  test('appends numeric suffix on collision', async () => {
    let callCount = 0;
    const mockRepo = {
      findBySlug: async (slug: string) => {
        callCount++;
        // First two calls find existing slugs
        if (slug === 'cpd-seminar' || slug === 'cpd-seminar-2') return { id: 'existing' };
        return undefined;
      },
    } as any;
    const slug = await ensureUniqueEventSlug('cpd-seminar', mockRepo);
    expect(slug).toBe('cpd-seminar-3');
    expect(callCount).toBe(3);
  });
});
