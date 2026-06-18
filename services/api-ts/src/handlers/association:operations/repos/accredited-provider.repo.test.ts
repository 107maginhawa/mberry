/**
 * Unit suite for AccreditedProviderRepository (fake-DB harness, ./__fake-db).
 * Covers the expiringSoon computation in listWithExpiry, status filtering
 * branch, org-scoped get, and create/update/delete with their InternalError
 * guards.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { AccreditedProviderRepository } from './accredited-provider.repo';
import { accreditedProviders } from './accredited-provider.schema';
import { InternalError } from '@/core/errors';
import { makeFakeDb, type FakeDb } from './__fake-db';

let fake: FakeDb;
let repo: AccreditedProviderRepository;

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  fake = makeFakeDb();
  repo = new AccreditedProviderRepository(fake.db);
});

describe('AccreditedProviderRepository.listWithExpiry', () => {
  test('flags providers expiring within 30 days, not those further out / past / null', async () => {
    const now = Date.now();
    fake.seed(accreditedProviders, [
      { id: 'soon', organizationId: 'org-1', expiryDate: new Date(now + 10 * DAY) },
      { id: 'far', organizationId: 'org-1', expiryDate: new Date(now + 90 * DAY) },
      { id: 'past', organizationId: 'org-1', expiryDate: new Date(now - 5 * DAY) },
      { id: 'none', organizationId: 'org-1', expiryDate: null },
    ]);
    const { data, total } = await repo.listWithExpiry('org-1');
    expect(total).toBe(4);
    const byId = Object.fromEntries(data.map((d) => [d.id, d.expiringSoon]));
    expect(byId['soon']).toBe(true);
    expect(byId['far']).toBe(false);
    expect(byId['past']).toBe(false);
    expect(byId['none']).toBe(false);
  });

  test('applies status filter branch', async () => {
    fake.seed(accreditedProviders, [{ id: 'a', organizationId: 'org-1', status: 'active', expiryDate: null }]);
    const { data } = await repo.listWithExpiry('org-1', 'active');
    expect(data).toHaveLength(1);
    expect(fake.whereCalls.some((w) => w.table === accreditedProviders)).toBe(true);
  });

  test('empty result yields total 0', async () => {
    fake.seed(accreditedProviders, []);
    const { data, total } = await repo.listWithExpiry('org-1');
    expect(data).toHaveLength(0);
    expect(total).toBe(0);
  });
});

describe('AccreditedProviderRepository CRUD', () => {
  test('getByOrg returns row or undefined', async () => {
    fake.seed(accreditedProviders, [{ id: 'a', organizationId: 'org-1' }]);
    expect((await repo.getByOrg('a', 'org-1'))?.id).toBe('a');
    fake.seed(accreditedProviders, []);
    expect(await repo.getByOrg('a', 'org-1')).toBeUndefined();
  });

  test('createOne stores and returns the provider', async () => {
    const out = await repo.createOne({ organizationId: 'org-1', name: 'PRC Co' } as any);
    expect(out.id).toBeDefined();
    expect(fake.rows(accreditedProviders)).toHaveLength(1);
  });

  test('update sets fields + updatedAt', async () => {
    fake.seed(accreditedProviders, [{ id: 'a', name: 'Old' }]);
    const out = await repo.update('a', { name: 'New' } as any);
    expect(out.name).toBe('New');
    expect(out.updatedAt).toBeInstanceOf(Date);
  });

  test('update throws InternalError when no row updated', async () => {
    fake.seed(accreditedProviders, []); // returning() yields []
    await expect(repo.update('missing', { name: 'X' } as any)).rejects.toBeInstanceOf(InternalError);
  });

  test('delete clears the matching row', async () => {
    fake.seed(accreditedProviders, [{ id: 'a' }]);
    await repo.delete('a');
    expect(fake.rows(accreditedProviders)).toHaveLength(0);
  });
});
