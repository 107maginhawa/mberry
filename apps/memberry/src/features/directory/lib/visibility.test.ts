import { describe, test, expect } from 'vitest';
import { getVisibilityLabel, isSearchable, getVisibilityIcon } from './visibility';

describe('getVisibilityLabel', () => {
  test('maps all visibility levels', () => {
    expect(getVisibilityLabel('public')).toBe('Public');
    expect(getVisibilityLabel('memberOnly')).toBe('Members Only');
    expect(getVisibilityLabel('hidden')).toBe('Hidden');
  });
});

describe('isSearchable', () => {
  test('public and memberOnly are searchable', () => {
    expect(isSearchable('public')).toBe(true);
    expect(isSearchable('memberOnly')).toBe(true);
  });

  test('hidden is not searchable', () => {
    expect(isSearchable('hidden')).toBe(false);
  });
});

describe('getVisibilityIcon', () => {
  test('returns icon names for each level', () => {
    expect(getVisibilityIcon('public')).toBe('globe');
    expect(getVisibilityIcon('memberOnly')).toBe('users');
    expect(getVisibilityIcon('hidden')).toBe('eye-off');
  });
});
