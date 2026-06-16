/**
 * Dunning repos — DunningTemplateRepository + DunningEventRepository.
 * buildWhereConditions branches, findByStage convenience, logDunningEvent.
 * Mock-DB style with a recording fake DB.
 */

import { describe, test, expect } from 'bun:test';
import { DunningTemplateRepository, DunningEventRepository } from './dunning.repo';
import { makeFakeDb } from './__testkit__/fake-db';

describe('DunningTemplateRepository.buildWhereConditions (via findMany)', () => {
  test('no filters → no where', async () => {
    const db = makeFakeDb({ selectResults: [[]] });
    await new DunningTemplateRepository(db as any).findMany();
    expect(db.ops.select[0]!.some((c) => c.method === 'where')).toBe(false);
  });

  test('stage=0 still builds a condition (!== undefined guard)', async () => {
    const db = makeFakeDb({ selectResults: [[{ id: 'dt-1' }]] });
    await new DunningTemplateRepository(db as any).findMany({ stage: 0 });
    expect(db.ops.select[0]!.some((c) => c.method === 'where')).toBe(true);
  });

  test('all filter fields build conditions', async () => {
    const db = makeFakeDb({ selectResults: [[{ id: 'dt-1' }]] });
    await new DunningTemplateRepository(db as any).findMany({
      organizationId: 'org-1',
      stage: 2,
      channel: 'email',
      status: 'active',
    });
    expect(db.ops.select[0]!.some((c) => c.method === 'where')).toBe(true);
  });
});

describe('DunningTemplateRepository.findByStage', () => {
  test('queries active templates for org+stage', async () => {
    const db = makeFakeDb({ selectResults: [[{ id: 'dt-1', stage: 1, status: 'active' }]] });
    const r = await new DunningTemplateRepository(db as any).findByStage('org-1', 1);
    expect(r).toHaveLength(1);
    expect(db.ops.select[0]!.some((c) => c.method === 'where')).toBe(true);
  });
});

describe('DunningEventRepository.buildWhereConditions (via findMany)', () => {
  test('no filters → no where', async () => {
    const db = makeFakeDb({ selectResults: [[]] });
    await new DunningEventRepository(db as any).findMany();
    expect(db.ops.select[0]!.some((c) => c.method === 'where')).toBe(false);
  });

  test('stage=0 builds condition; membership/person/template build conditions', async () => {
    const db = makeFakeDb({ selectResults: [[{ id: 'de-1' }]] });
    await new DunningEventRepository(db as any).findMany({
      membershipId: 'm-1',
      personId: 'p-1',
      templateId: 'dt-1',
      stage: 0,
    });
    expect(db.ops.select[0]!.some((c) => c.method === 'where')).toBe(true);
  });
});

describe('DunningEventRepository.logDunningEvent', () => {
  test('delegates to createOne and returns inserted row', async () => {
    const db = makeFakeDb({ insertResults: [[{ id: 'de-9', stage: 1 }]] });
    const r = await new DunningEventRepository(db as any).logDunningEvent({
      membershipId: 'm-1', personId: 'p-1', stage: 1,
    } as any);
    expect(r).toEqual({ id: 'de-9', stage: 1 });
  });
});
