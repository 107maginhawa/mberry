/**
 * Chapter repos — ChapterAffiliationRepository.setPrimary + buildWhereConditions
 * for all three repos (ChapterAffiliation / AffiliationTransfer / RoyaltySplit).
 *
 * Mock-DB style with a recording fake DB.
 */

import { describe, test, expect } from 'bun:test';
import {
  ChapterAffiliationRepository,
  AffiliationTransferRepository,
  RoyaltySplitRepository,
} from './chapters.repo';
import { NotFoundError, InternalError } from '@/core/errors';
import { makeFakeDb } from './__testkit__/fake-db';

describe('ChapterAffiliationRepository.buildWhereConditions (via findMany)', () => {
  test('no filters → no where', async () => {
    const db = makeFakeDb({ selectResults: [[]] });
    await new ChapterAffiliationRepository(db as any).findMany();
    expect(db.ops.select[0]!.some((c) => c.method === 'where')).toBe(false);
  });

  test('all filters incl. isPrimary=false build conditions', async () => {
    const db = makeFakeDb({ selectResults: [[{ id: 'ca-1' }]] });
    await new ChapterAffiliationRepository(db as any).findMany({
      organizationId: 'org-1',
      personId: 'p-1',
      chapterId: 'chap-1',
      isPrimary: false, // explicit false must still build (=== undefined guard)
      status: 'active',
    });
    expect(db.ops.select[0]!.some((c) => c.method === 'where')).toBe(true);
  });
});

describe('ChapterAffiliationRepository.setPrimary', () => {
  test('clears others then sets target primary', async () => {
    const db = makeFakeDb({
      selectResults: [[{ id: 'ca-1', personId: 'p-1' }]], // findOneById(target)
      updateResults: [
        [],                                  // bulk clear (no returning, terminal)
        [{ id: 'ca-1', isPrimary: true }],   // set target primary
      ],
    });
    const r = await new ChapterAffiliationRepository(db as any).setPrimary('ca-1', 'org-1');
    expect(r).toEqual({ id: 'ca-1', isPrimary: true });
    expect(db.ops.update).toHaveLength(2);
  });

  test('throws NotFoundError when target missing', async () => {
    const db = makeFakeDb({ selectResults: [[]] });
    await expect(
      new ChapterAffiliationRepository(db as any).setPrimary('missing', 'org-1'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws InternalError when final update returns no row', async () => {
    const db = makeFakeDb({
      selectResults: [[{ id: 'ca-1', personId: 'p-1' }]],
      updateResults: [[], []], // clear ok, set-primary returns nothing
    });
    await expect(
      new ChapterAffiliationRepository(db as any).setPrimary('ca-1', 'org-1'),
    ).rejects.toBeInstanceOf(InternalError);
  });
});

describe('AffiliationTransferRepository.buildWhereConditions (via findMany)', () => {
  test('no filters → no where', async () => {
    const db = makeFakeDb({ selectResults: [[]] });
    await new AffiliationTransferRepository(db as any).findMany();
    expect(db.ops.select[0]!.some((c) => c.method === 'where')).toBe(false);
  });

  test('all filter fields build conditions', async () => {
    const db = makeFakeDb({ selectResults: [[{ id: 'at-1' }]] });
    await new AffiliationTransferRepository(db as any).findMany({
      organizationId: 'org-1',
      personId: 'p-1',
      fromChapterId: 'c-1',
      toChapterId: 'c-2',
      status: 'pending',
    });
    expect(db.ops.select[0]!.some((c) => c.method === 'where')).toBe(true);
  });
});

describe('RoyaltySplitRepository.buildWhereConditions (via findMany)', () => {
  test('no filters → no where', async () => {
    const db = makeFakeDb({ selectResults: [[]] });
    await new RoyaltySplitRepository(db as any).findMany();
    expect(db.ops.select[0]!.some((c) => c.method === 'where')).toBe(false);
  });

  test('all filter fields build conditions', async () => {
    const db = makeFakeDb({ selectResults: [[{ id: 'rs-1' }]] });
    await new RoyaltySplitRepository(db as any).findMany({
      organizationId: 'org-1',
      membershipId: 'm-1',
      chapterId: 'c-1',
      nationalOrgId: 'n-1',
    });
    expect(db.ops.select[0]!.some((c) => c.method === 'where')).toBe(true);
  });
});
