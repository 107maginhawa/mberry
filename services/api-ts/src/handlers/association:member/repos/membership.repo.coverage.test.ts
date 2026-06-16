/**
 * Membership repos — buildWhereConditions branches (Tier/Membership/Application/
 * Category) + custom methods (findByCode, countMembersInTier, findByPersonAndOrg,
 * findAllByPerson, findMembersExpiringOn, countMembersInCategory).
 * Mock-DB style with a recording fake DB. Complements membership.repo.test.ts.
 */

import { describe, test, expect } from 'bun:test';
import {
  MembershipTierRepository,
  MembershipRepository,
  MembershipApplicationRepository,
  MembershipCategoryRepository,
} from './membership.repo';
import { makeFakeDb } from './__testkit__/fake-db';

const hasWhere = (db: ReturnType<typeof makeFakeDb>) =>
  db.ops.select[0]!.some((c) => c.method === 'where');

describe('MembershipTierRepository', () => {
  test('buildWhereConditions: none / org+status+name / q OR', async () => {
    const none = makeFakeDb({ selectResults: [[]] });
    await new MembershipTierRepository(none as any).findMany();
    expect(hasWhere(none)).toBe(false);

    const full = makeFakeDb({ selectResults: [[{ id: 't-1' }]] });
    await new MembershipTierRepository(full as any).findMany({ organizationId: 'org-1', status: 'active', name: 'Reg' });
    expect(hasWhere(full)).toBe(true);

    const q = makeFakeDb({ selectResults: [[{ id: 't-1' }]] });
    await new MembershipTierRepository(q as any).findMany({ q: 'gold' });
    expect(hasWhere(q)).toBe(true);
  });

  test('findByCode returns tier / null', async () => {
    const hit = makeFakeDb({ selectResults: [[{ id: 't-1', code: 'REG' }]] });
    expect(await new MembershipTierRepository(hit as any).findByCode('org-1', 'REG')).toMatchObject({ code: 'REG' });
    const miss = makeFakeDb({ selectResults: [[]] });
    expect(await new MembershipTierRepository(miss as any).findByCode('org-1', 'X')).toBeNull();
  });

  test('countMembersInTier returns numeric count / 0 default', async () => {
    const db = makeFakeDb({ selectResults: [[{ count: '3' }]] });
    expect(await new MembershipTierRepository(db as any).countMembersInTier('t-1')).toBe(3);
    const empty = makeFakeDb({ selectResults: [[]] });
    expect(await new MembershipTierRepository(empty as any).countMembersInTier('t-1')).toBe(0);
  });
});

describe('MembershipRepository', () => {
  test('buildWhereConditions covers org/person/status/tier/q', async () => {
    const db = makeFakeDb({ selectResults: [[{ id: 'm-1' }]] });
    await new MembershipRepository(db as any).findMany({
      organizationId: 'org-1', personId: 'p-1', status: 'active', tierId: 't-1', q: 'MEM-001',
    });
    expect(hasWhere(db)).toBe(true);
  });

  test('findByPersonAndOrg returns row / null', async () => {
    const hit = makeFakeDb({ selectResults: [[{ id: 'm-1' }]] });
    expect(await new MembershipRepository(hit as any).findByPersonAndOrg('p-1', 'org-1')).toEqual({ id: 'm-1' });
    const miss = makeFakeDb({ selectResults: [[]] });
    expect(await new MembershipRepository(miss as any).findByPersonAndOrg('p-9', 'org-1')).toBeNull();
  });

  test('findAllByPerson returns all rows', async () => {
    const db = makeFakeDb({ selectResults: [[{ id: 'm-1' }, { id: 'm-2' }]] });
    expect(await new MembershipRepository(db as any).findAllByPerson('p-1')).toHaveLength(2);
  });

  test('findMembersExpiringOn returns projected rows', async () => {
    const db = makeFakeDb({ selectResults: [[{ id: 'm-1', personId: 'p-1', organizationId: 'org-1', duesExpiryDate: '2026-07-01' }]] });
    const r = await new MembershipRepository(db as any).findMembersExpiringOn('org-1', '2026-07-01');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: 'm-1', personId: 'p-1' });
  });
});

describe('MembershipApplicationRepository.buildWhereConditions', () => {
  test('none / all fields', async () => {
    const none = makeFakeDb({ selectResults: [[]] });
    await new MembershipApplicationRepository(none as any).findMany();
    expect(hasWhere(none)).toBe(false);

    const full = makeFakeDb({ selectResults: [[{ id: 'app-1' }]] });
    await new MembershipApplicationRepository(full as any).findMany({ organizationId: 'org-1', personId: 'p-1', status: 'pending' });
    expect(hasWhere(full)).toBe(true);
  });
});

describe('MembershipCategoryRepository', () => {
  test('buildWhereConditions none / org+name', async () => {
    const none = makeFakeDb({ selectResults: [[]] });
    await new MembershipCategoryRepository(none as any).findMany();
    expect(hasWhere(none)).toBe(false);

    const full = makeFakeDb({ selectResults: [[{ id: 'c-1' }]] });
    await new MembershipCategoryRepository(full as any).findMany({ organizationId: 'org-1', name: 'Stud' });
    expect(hasWhere(full)).toBe(true);
  });

  test('countMembersInCategory returns count / 0', async () => {
    const db = makeFakeDb({ selectResults: [[{ count: '5' }]] });
    expect(await new MembershipCategoryRepository(db as any).countMembersInCategory('c-1')).toBe(5);
    const empty = makeFakeDb({ selectResults: [[]] });
    expect(await new MembershipCategoryRepository(empty as any).countMembersInCategory('c-1')).toBe(0);
  });
});
