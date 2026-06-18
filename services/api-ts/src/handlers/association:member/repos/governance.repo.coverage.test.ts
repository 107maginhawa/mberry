/**
 * Governance repos — Position / OfficerTerm / TransitionChecklist /
 * DisciplinaryAction + governanceRepoPort adapter. Plain repos (raw drizzle
 * chains). Mock-DB style with a recording fake DB.
 */

import { describe, test, expect } from 'bun:test';
import {
  PositionRepository,
  OfficerTermRepository,
  TransitionChecklistRepository,
  DisciplinaryActionRepository,
  governanceRepoPort,
} from './governance.repo';
import { makeFakeDb } from './__testkit__/fake-db';

describe('PositionRepository', () => {
  test('create / findById / findByOrg / update / delete', async () => {
    const create = makeFakeDb({ insertResults: [[{ id: 'pos-1', title: 'President' }]] });
    expect(await new PositionRepository(create as any).create({ title: 'President' } as any)).toEqual({ id: 'pos-1', title: 'President' });

    const find = makeFakeDb({ selectResults: [[{ id: 'pos-1' }]] });
    expect(await new PositionRepository(find as any).findById('pos-1')).toEqual({ id: 'pos-1' });

    const findMissing = makeFakeDb({ selectResults: [[]] });
    expect(await new PositionRepository(findMissing as any).findById('x')).toBeUndefined();

    const byOrg = makeFakeDb({ selectResults: [[{ id: 'pos-1' }, { id: 'pos-2' }]] });
    expect(await new PositionRepository(byOrg as any).findByOrg('org-1')).toHaveLength(2);

    const upd = makeFakeDb({ updateResults: [[{ id: 'pos-1', title: 'VP' }]] });
    expect(await new PositionRepository(upd as any).update('pos-1', { title: 'VP' })).toEqual({ id: 'pos-1', title: 'VP' });

    const del = makeFakeDb({ deleteResults: [[]] });
    await new PositionRepository(del as any).delete('pos-1');
    expect(del.ops.delete).toHaveLength(1);
  });
});

describe('OfficerTermRepository', () => {
  test('create / findById / findByOrg', async () => {
    const create = makeFakeDb({ insertResults: [[{ id: 'ot-1' }]] });
    expect(await new OfficerTermRepository(create as any).create({} as any)).toEqual({ id: 'ot-1' });
    const find = makeFakeDb({ selectResults: [[{ id: 'ot-1' }]] });
    expect(await new OfficerTermRepository(find as any).findById('ot-1')).toEqual({ id: 'ot-1' });
    const byOrg = makeFakeDb({ selectResults: [[{ id: 'ot-1' }]] });
    expect(await new OfficerTermRepository(byOrg as any).findByOrg('org-1')).toHaveLength(1);
  });

  test('findActiveByPosition returns first row / undefined', async () => {
    const hit = makeFakeDb({ selectResults: [[{ id: 'ot-1', status: 'active' }]] });
    expect(await new OfficerTermRepository(hit as any).findActiveByPosition('pos-1')).toMatchObject({ status: 'active' });
    const miss = makeFakeDb({ selectResults: [[]] });
    expect(await new OfficerTermRepository(miss as any).findActiveByPosition('pos-9')).toBeUndefined();
  });

  test('findActiveByPersonAndOrg joins positions and returns rows', async () => {
    const db = makeFakeDb({ selectResults: [[{ id: 'ot-1', positionTitle: 'President' }]] });
    const rows = await new OfficerTermRepository(db as any).findActiveByPersonAndOrg('p-1', 'org-1');
    expect(rows).toEqual([{ id: 'ot-1', positionTitle: 'President' }]);
    expect(db.ops.select[0]!.some((c) => c.method === 'innerJoin')).toBe(true);
  });

  test('findActiveByPersonInOrg returns active terms list', async () => {
    const db = makeFakeDb({ selectResults: [[{ id: 'ot-1' }, { id: 'ot-2' }]] });
    expect(await new OfficerTermRepository(db as any).findActiveByPersonInOrg('p-1', 'org-1')).toHaveLength(2);
  });

  test('update / delete', async () => {
    const upd = makeFakeDb({ updateResults: [[{ id: 'ot-1', status: 'ended' }]] });
    expect(await new OfficerTermRepository(upd as any).update('ot-1', { status: 'ended' } as any)).toMatchObject({ status: 'ended' });
    const del = makeFakeDb({ deleteResults: [[]] });
    await new OfficerTermRepository(del as any).delete('ot-1');
    expect(del.ops.delete).toHaveLength(1);
  });
});

describe('TransitionChecklistRepository', () => {
  test('create / findByTerm / findPendingByTerm / markCompleted', async () => {
    const create = makeFakeDb({ insertResults: [[{ id: 'tc-1' }]] });
    expect(await new TransitionChecklistRepository(create as any).create({} as any)).toEqual({ id: 'tc-1' });

    const byTerm = makeFakeDb({ selectResults: [[{ id: 'tc-1' }]] });
    expect(await new TransitionChecklistRepository(byTerm as any).findByTerm('ot-1')).toHaveLength(1);

    const pending = makeFakeDb({ selectResults: [[{ id: 'tc-1', status: 'pending' }]] });
    expect(await new TransitionChecklistRepository(pending as any).findPendingByTerm('ot-1')).toHaveLength(1);

    const done = makeFakeDb({ updateResults: [[{ id: 'tc-1', status: 'completed' }]] });
    const r = await new TransitionChecklistRepository(done as any).markCompleted('tc-1', 'user-1');
    expect(r).toMatchObject({ status: 'completed' });
    const setArg = done.ops.update[0]!.find((c) => c.method === 'set')!.args[0] as any;
    expect(setArg.status).toBe('completed');
    expect(setArg.completedBy).toBe('user-1');
  });
});

describe('DisciplinaryActionRepository', () => {
  test('create / findById / findByOrg / findByPerson', async () => {
    const create = makeFakeDb({ insertResults: [[{ id: 'da-1' }]] });
    expect(await new DisciplinaryActionRepository(create as any).create({} as any)).toEqual({ id: 'da-1' });

    const find = makeFakeDb({ selectResults: [[{ id: 'da-1' }]] });
    expect(await new DisciplinaryActionRepository(find as any).findById('da-1')).toEqual({ id: 'da-1' });

    const miss = makeFakeDb({ selectResults: [[]] });
    expect(await new DisciplinaryActionRepository(miss as any).findById('x')).toBeUndefined();

    const byOrg = makeFakeDb({ selectResults: [[{ id: 'da-1' }]] });
    expect(await new DisciplinaryActionRepository(byOrg as any).findByOrg('org-1')).toHaveLength(1);

    const byPerson = makeFakeDb({ selectResults: [[{ id: 'da-1' }, { id: 'da-2' }]] });
    expect(await new DisciplinaryActionRepository(byPerson as any).findByPerson('p-1')).toHaveLength(2);
  });
});

describe('governanceRepoPort', () => {
  test('maps active officer terms to {id, positionTitle}', async () => {
    const db = makeFakeDb({ selectResults: [[{ id: 'ot-1', positionTitle: 'Treasurer', extra: 'x' }]] });
    const port = governanceRepoPort(db as any);
    const r = await port.findActiveOfficerTermsByPersonAndOrg('p-1', 'org-1');
    expect(r).toEqual([{ id: 'ot-1', positionTitle: 'Treasurer' }]);
  });
});
