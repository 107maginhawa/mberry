/**
 * InstitutionalMembershipRepository & SeatAllocationRepository — branch coverage.
 *
 * Mock-DB style. buildWhereConditions branches are driven via findMany(filters);
 * the seat-increment FSM (seats-full vs not-found) and decrement guard are
 * exercised against a scripted recording fake DB.
 */

import { describe, test, expect } from 'bun:test';
import {
  InstitutionalMembershipRepository,
  SeatAllocationRepository,
} from './institutional-membership.repo';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { makeFakeDb } from './__testkit__/fake-db';

describe('InstitutionalMembershipRepository.buildWhereConditions (via findMany)', () => {
  test('no filters → no where clause', async () => {
    const db = makeFakeDb({ selectResults: [[]] });
    await new InstitutionalMembershipRepository(db as any).findMany();
    expect(db.ops.select[0]!.some((c) => c.method === 'where')).toBe(false);
  });

  test('empty filter object → no where clause', async () => {
    const db = makeFakeDb({ selectResults: [[]] });
    await new InstitutionalMembershipRepository(db as any).findMany({});
    expect(db.ops.select[0]!.some((c) => c.method === 'where')).toBe(false);
  });

  test('each filter field builds a where condition', async () => {
    const db = makeFakeDb({ selectResults: [[{ id: 'im-1' }]] });
    await new InstitutionalMembershipRepository(db as any).findMany({
      organizationId: 'org-1',
      parentOrganizationId: 'parent-1',
      status: 'active',
      tierId: 'tier-1',
    });
    expect(db.ops.select[0]!.some((c) => c.method === 'where')).toBe(true);
  });
});

describe('InstitutionalMembershipRepository.incrementUsedSeats', () => {
  test('returns updated row on success', async () => {
    const db = makeFakeDb({ updateResults: [[{ id: 'im-1', usedSeats: 2 }]] });
    const r = await new InstitutionalMembershipRepository(db as any).incrementUsedSeats('im-1');
    expect(r).toEqual({ id: 'im-1', usedSeats: 2 });
  });

  test('throws NotFoundError when record does not exist', async () => {
    // update returns no row, then findOneById (select) returns empty
    const db = makeFakeDb({ updateResults: [[]], selectResults: [[]] });
    await expect(
      new InstitutionalMembershipRepository(db as any).incrementUsedSeats('missing'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws BusinessLogicError SEATS_FULL when record exists but full', async () => {
    const db = makeFakeDb({ updateResults: [[]], selectResults: [[{ id: 'im-1', usedSeats: 5, totalSeats: 5 }]] });
    await expect(
      new InstitutionalMembershipRepository(db as any).incrementUsedSeats('im-1'),
    ).rejects.toMatchObject({ code: 'SEATS_FULL' });
  });
});

describe('InstitutionalMembershipRepository.decrementUsedSeats', () => {
  test('returns updated row', async () => {
    const db = makeFakeDb({ updateResults: [[{ id: 'im-1', usedSeats: 1 }]] });
    const r = await new InstitutionalMembershipRepository(db as any).decrementUsedSeats('im-1');
    expect(r).toEqual({ id: 'im-1', usedSeats: 1 });
  });

  test('throws NotFoundError when no row updated', async () => {
    const db = makeFakeDb({ updateResults: [[]] });
    await expect(
      new InstitutionalMembershipRepository(db as any).decrementUsedSeats('missing'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('SeatAllocationRepository.buildWhereConditions (via findMany)', () => {
  test('no filters → no where', async () => {
    const db = makeFakeDb({ selectResults: [[]] });
    await new SeatAllocationRepository(db as any).findMany();
    expect(db.ops.select[0]!.some((c) => c.method === 'where')).toBe(false);
  });

  test('all filter fields build conditions', async () => {
    const db = makeFakeDb({ selectResults: [[{ id: 's-1' }]] });
    await new SeatAllocationRepository(db as any).findMany({
      institutionalMembershipId: 'im-1',
      personId: 'p-1',
      status: 'active',
    });
    expect(db.ops.select[0]!.some((c) => c.method === 'where')).toBe(true);
  });
});

describe('SeatAllocationRepository.findActiveByMembershipAndPerson', () => {
  test('returns row when found', async () => {
    const db = makeFakeDb({ selectResults: [[{ id: 's-1', status: 'active' }]] });
    const r = await new SeatAllocationRepository(db as any).findActiveByMembershipAndPerson('im-1', 'p-1');
    expect(r).toEqual({ id: 's-1', status: 'active' });
  });

  test('returns null when not found', async () => {
    const db = makeFakeDb({ selectResults: [[]] });
    const r = await new SeatAllocationRepository(db as any).findActiveByMembershipAndPerson('im-1', 'p-9');
    expect(r).toBeNull();
  });
});

describe('SeatAllocationRepository.revokeAllActive', () => {
  test('returns count of revoked allocations', async () => {
    const db = makeFakeDb({ updateResults: [[{ id: 's-1' }, { id: 's-2' }]] });
    const n = await new SeatAllocationRepository(db as any).revokeAllActive('im-1');
    expect(n).toBe(2);
    const setArg = db.ops.update[0]!.find((c) => c.method === 'set')!.args[0] as any;
    expect(setArg.status).toBe('revoked');
    expect(setArg.revokedAt).toBeInstanceOf(Date);
  });

  test('returns 0 when none active', async () => {
    const db = makeFakeDb({ updateResults: [[]] });
    expect(await new SeatAllocationRepository(db as any).revokeAllActive('im-1')).toBe(0);
  });
});
