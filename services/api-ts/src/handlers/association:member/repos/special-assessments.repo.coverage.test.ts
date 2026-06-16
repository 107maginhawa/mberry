/**
 * SpecialAssessmentRepository — query-building + branch coverage.
 *
 * Mock-DB style (no Postgres): the repo issues raw drizzle chains; a recording
 * fake DB scripts each query's result and records the chain so every method,
 * filter branch, and edge case (empty targets, missing assessment, paid-invoice
 * metrics) is exercised. Mirrors the codebase's mock-DB convention.
 */

import { describe, test, expect } from 'bun:test';
import { SpecialAssessmentRepository } from './special-assessments.repo';
import { makeFakeDb, methodsOf } from './__testkit__/fake-db';

describe('SpecialAssessmentRepository', () => {
  test('create inserts and returns the row', async () => {
    const db = makeFakeDb({ insertResults: [[{ id: 'sa-1', name: 'Levy' }]] });
    const repo = new SpecialAssessmentRepository(db as any);
    const r = await repo.create({ organizationId: 'org-1', name: 'Levy', amount: 100 } as any);
    expect(r).toEqual({ id: 'sa-1', name: 'Levy' });
    expect(methodsOf(db.ops.insert[0]!)).toEqual(['insert', 'values', 'returning']);
  });

  test('findById returns row when present and null when absent', async () => {
    const present = makeFakeDb({ selectResults: [[{ id: 'sa-1' }]] });
    expect(await new SpecialAssessmentRepository(present as any).findById('sa-1')).toEqual({ id: 'sa-1' });

    const absent = makeFakeDb({ selectResults: [[]] });
    expect(await new SpecialAssessmentRepository(absent as any).findById('missing')).toBeNull();
  });

  test('listByOrg selects, filters by org, orders desc', async () => {
    const db = makeFakeDb({ selectResults: [[{ id: 'a' }, { id: 'b' }]] });
    const rows = await new SpecialAssessmentRepository(db as any).listByOrg('org-1');
    expect(rows).toHaveLength(2);
    expect(methodsOf(db.ops.select[0]!)).toEqual(['select', 'from', 'where', 'orderBy']);
  });

  test('update sets fields and returns row; null when no row', async () => {
    const ok = makeFakeDb({ updateResults: [[{ id: 'sa-1', name: 'New' }]] });
    expect(await new SpecialAssessmentRepository(ok as any).update('sa-1', { name: 'New' })).toEqual({ id: 'sa-1', name: 'New' });
    expect(methodsOf(ok.ops.update[0]!)).toEqual(['update', 'set', 'where', 'returning']);

    const none = makeFakeDb({ updateResults: [[]] });
    expect(await new SpecialAssessmentRepository(none as any).update('x', { name: 'N' })).toBeNull();
  });

  test('softDelete sets status closed', async () => {
    const db = makeFakeDb({ updateResults: [[{ id: 'sa-1', status: 'closed' }]] });
    const r = await new SpecialAssessmentRepository(db as any).softDelete('sa-1');
    expect(r).toEqual({ id: 'sa-1', status: 'closed' });
    const setArg = db.ops.update[0]!.find((c) => c.method === 'set')!.args[0] as any;
    expect(setArg.status).toBe('closed');
  });

  test('softDelete returns null when no row', async () => {
    const db = makeFakeDb({ updateResults: [[]] });
    expect(await new SpecialAssessmentRepository(db as any).softDelete('x')).toBeNull();
  });

  test('setStatus updates status and returns; null when absent', async () => {
    const db = makeFakeDb({ updateResults: [[{ id: 'sa-1', status: 'active' }]] });
    const r = await new SpecialAssessmentRepository(db as any).setStatus('sa-1', 'active');
    expect(r).toEqual({ id: 'sa-1', status: 'active' });
    const setArg = db.ops.update[0]!.find((c) => c.method === 'set')!.args[0] as any;
    expect(setArg.status).toBe('active');

    const none = makeFakeDb({ updateResults: [[]] });
    expect(await new SpecialAssessmentRepository(none as any).setStatus('x', 'draft')).toBeNull();
  });

  describe('targets', () => {
    test('addTargets returns [] for empty personIds without hitting db', async () => {
      const db = makeFakeDb();
      const r = await new SpecialAssessmentRepository(db as any).addTargets('sa-1', []);
      expect(r).toEqual([]);
      expect(db.ops.insert).toHaveLength(0);
    });

    test('addTargets maps personIds to rows and inserts', async () => {
      const db = makeFakeDb({ insertResults: [[{ id: 't1' }, { id: 't2' }]] });
      const r = await new SpecialAssessmentRepository(db as any).addTargets('sa-1', ['p1', 'p2']);
      expect(r).toHaveLength(2);
      const valuesArg = db.ops.insert[0]!.find((c) => c.method === 'values')!.args[0] as any[];
      expect(valuesArg).toEqual([
        { assessmentId: 'sa-1', personId: 'p1' },
        { assessmentId: 'sa-1', personId: 'p2' },
      ]);
    });

    test('getTargets selects by assessment', async () => {
      const db = makeFakeDb({ selectResults: [[{ id: 't1', personId: 'p1' }]] });
      const r = await new SpecialAssessmentRepository(db as any).getTargets('sa-1');
      expect(r).toHaveLength(1);
    });

    test('getTargetPersonIds maps to personId list', async () => {
      const db = makeFakeDb({ selectResults: [[{ personId: 'p1' }, { personId: 'p2' }]] });
      const r = await new SpecialAssessmentRepository(db as any).getTargetPersonIds('sa-1');
      expect(r).toEqual(['p1', 'p2']);
    });

    test('findTargetByAssessmentAndPerson returns row / null', async () => {
      const hit = makeFakeDb({ selectResults: [[{ id: 't1' }]] });
      expect(await new SpecialAssessmentRepository(hit as any).findTargetByAssessmentAndPerson('sa-1', 'p1')).toEqual({ id: 't1' });
      const miss = makeFakeDb({ selectResults: [[]] });
      expect(await new SpecialAssessmentRepository(miss as any).findTargetByAssessmentAndPerson('sa-1', 'p9')).toBeNull();
    });

    test('updateTargetInvoice sets invoiceId+paid; null when absent', async () => {
      const db = makeFakeDb({ updateResults: [[{ id: 't1', invoiceId: 'inv-1', status: 'paid' }]] });
      const r = await new SpecialAssessmentRepository(db as any).updateTargetInvoice('t1', 'inv-1');
      expect(r).toMatchObject({ invoiceId: 'inv-1', status: 'paid' });
      const none = makeFakeDb({ updateResults: [[]] });
      expect(await new SpecialAssessmentRepository(none as any).updateTargetInvoice('x', 'inv')).toBeNull();
    });

    test('markTargetWithInvoice sets invoiceId; null when absent', async () => {
      const db = makeFakeDb({ updateResults: [[{ id: 't1', invoiceId: 'inv-2' }]] });
      const r = await new SpecialAssessmentRepository(db as any).markTargetWithInvoice('sa-1', 'p1', 'inv-2');
      expect(r).toMatchObject({ invoiceId: 'inv-2' });
      const none = makeFakeDb({ updateResults: [[]] });
      expect(await new SpecialAssessmentRepository(none as any).markTargetWithInvoice('sa-1', 'p9', 'inv')).toBeNull();
    });
  });

  describe('getCollectionMetrics', () => {
    test('returns null when assessment missing', async () => {
      // 1st select = getTargets, 2nd select = findById (returns empty)
      const db = makeFakeDb({ selectResults: [[], []] });
      expect(await new SpecialAssessmentRepository(db as any).getCollectionMetrics('sa-x')).toBeNull();
    });

    test('zero targets → all zero metrics, no invoice query', async () => {
      const db = makeFakeDb({ selectResults: [[], [{ id: 'sa-1', amount: 100 }]] });
      const m = await new SpecialAssessmentRepository(db as any).getCollectionMetrics('sa-1');
      expect(m).toEqual({
        totalTargets: 0, paidCount: 0, paidAmount: 0,
        pendingCount: 0, pendingAmount: 0, totalAmount: 0,
      });
      // only getTargets + findById selects ran (no paid-invoice select)
      expect(db.ops.select).toHaveLength(2);
    });

    test('counts paid invoices and computes amounts', async () => {
      const targets = [
        { id: 't1', invoiceId: 'inv-1' },
        { id: 't2', invoiceId: 'inv-2' },
        { id: 't3', invoiceId: null },
      ];
      const db = makeFakeDb({
        selectResults: [
          targets,                       // getTargets
          [{ id: 'sa-1', amount: 50 }],  // findById
          [{ id: 'inv-1' }],             // paid invoices (1 paid)
        ],
      });
      const m = await new SpecialAssessmentRepository(db as any).getCollectionMetrics('sa-1');
      expect(m).toEqual({
        totalTargets: 3,
        paidCount: 1,
        paidAmount: 50,
        pendingCount: 2,
        pendingAmount: 100,
        totalAmount: 150,
      });
      expect(db.ops.select).toHaveLength(3);
    });
  });

  test('createInvoiceForTarget inserts a generated invoice', async () => {
    const db = makeFakeDb({ insertResults: [[{ id: 'inv-9', status: 'generated' }]] });
    const r = await new SpecialAssessmentRepository(db as any).createInvoiceForTarget({
      personId: 'p1', organizationId: 'org-1', totalAmount: 100, currency: 'PHP',
      periodStart: '2026-01-01', periodEnd: '2026-12-31', invoiceNumber: 'SA-1',
      fundAllocations: [{ fundName: 'General', amount: 100 }], membershipId: 'mem-1',
    });
    expect(r).toEqual({ id: 'inv-9', status: 'generated' });
    const valuesArg = db.ops.insert[0]!.find((c) => c.method === 'values')!.args[0] as any;
    expect(valuesArg.status).toBe('generated');
    expect(valuesArg.invoiceNumber).toBe('SA-1');
  });

  test('getActiveOrgMemberPersonIds returns active member person ids', async () => {
    const db = makeFakeDb({ selectResults: [[{ personId: 'p1' }, { personId: 'p2' }]] });
    const r = await new SpecialAssessmentRepository(db as any).getActiveOrgMemberPersonIds('org-1');
    expect(r).toEqual(['p1', 'p2']);
  });
});
