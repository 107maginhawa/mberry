import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { getOrganizationBySlug } from './getOrganizationBySlug';

describe('[BR-29] getOrganizationBySlug', () => {
  test('throws NotFoundError for empty slug', async () => {
    const ctx = makeCtx({ _params: { slug: '' } });
    await expect(getOrganizationBySlug(ctx)).rejects.toThrow('Organization not found');
  });

  test('throws NotFoundError for whitespace slug', async () => {
    const ctx = makeCtx({ _params: { slug: '   ' } });
    await expect(getOrganizationBySlug(ctx)).rejects.toThrow('Organization not found');
  });
});
