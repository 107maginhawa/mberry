import { describe, test, expect } from 'bun:test';
import { generateSlug } from './slug';
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
