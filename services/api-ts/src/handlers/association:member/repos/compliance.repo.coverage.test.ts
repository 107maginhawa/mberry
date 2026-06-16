/**
 * ComplianceRepository — getByOrganization (with/without status filter, count +
 * rows mapping), getOrgSummary (rate math + zero-member guard), refresh, and
 * mapRow null/defaulting. Uses a fake db.execute() that returns scripted rows.
 */

import { describe, test, expect } from 'bun:test';
import { ComplianceRepository as ImportedComplianceRepository } from './compliance.repo';

// Sibling test files (member/credits/*) call bun's process-global
// mock.module() on this repo path with a stub class lacking these methods,
// which leaks across files. The preload (test-utils/preload-pristine.ts)
// snapshots the real class onto globalThis before any mock runs; prefer it so
// this suite is order-independent. Falls back to the direct import in isolation.
const ComplianceRepository =
  (globalThis as any).__pristineComplianceRepository ?? ImportedComplianceRepository;

/** Fake DB whose execute() dequeues scripted results, supporting {rows} + array. */
function makeExecDb(results: unknown[]) {
  const q = [...results];
  const calls: unknown[] = [];
  return {
    execute: (sqlObj: unknown) => {
      calls.push(sqlObj);
      return Promise.resolve(q.length > 0 ? q.shift() : []);
    },
    _calls: calls,
  };
}

describe('ComplianceRepository.getByOrganization', () => {
  test('no status filter: count + mapped rows', async () => {
    const db = makeExecDb([
      { rows: [{ count: '2' }] },
      {
        rows: [
          { person_id: 'p1', organization_id: 'org-1', total_credits: '10', general_credits: '4', major_credits: '3', sdl_credits: '3', entry_count: '5', required_credits: '20', sdl_cap_percent: '40', compliance_percent: '50', compliance_status: 'at_risk', last_credit_at: '2026-01-01T00:00:00Z' },
          { person_id: 'p2', organization_id: 'org-1', compliance_status: 'compliant', last_credit_at: null },
        ],
      },
    ]);
    const r = await new ComplianceRepository(db as any).getByOrganization('org-1');
    expect(r.total).toBe(2);
    expect(r.data).toHaveLength(2);
    expect(r.data[0]).toMatchObject({
      personId: 'p1', totalCredits: 10, generalCredits: 4, majorCredits: 3,
      sdlCredits: 3, entryCount: 5, requiredCredits: 20, sdlCapPercent: 40,
      compliancePercent: 50, complianceStatus: 'at_risk',
    });
    expect(r.data[0]!.lastCreditAt).toBeInstanceOf(Date);
    // mapRow defaulting branch: missing numeric fields → 0, null date → null
    expect(r.data[1]).toMatchObject({ totalCredits: 0, complianceStatus: 'compliant', lastCreditAt: null });
  });

  test('with status filter (array result format) and custom limit/offset', async () => {
    const db = makeExecDb([
      [{ count: 1 }],                                  // direct array form
      [{ person_id: 'p9', compliance_status: 'non_compliant' }],
    ]);
    const r = await new ComplianceRepository(db as any).getByOrganization('org-1', {
      status: 'non_compliant', limit: 10, offset: 20,
    });
    expect(r.total).toBe(1);
    expect(r.data[0]!.complianceStatus).toBe('non_compliant');
  });

  test('count defaults to 0 when no rows', async () => {
    const db = makeExecDb([{ rows: [] }, { rows: [] }]);
    const r = await new ComplianceRepository(db as any).getByOrganization('org-1');
    expect(r.total).toBe(0);
    expect(r.data).toEqual([]);
  });
});

describe('ComplianceRepository.getOrgSummary', () => {
  test('computes complianceRate from counts', async () => {
    const db = makeExecDb([
      { rows: [{ total_members: '10', compliant: '7', at_risk: '2', non_compliant: '1' }] },
    ]);
    const s = await new ComplianceRepository(db as any).getOrgSummary('org-1');
    expect(s).toEqual({ totalMembers: 10, compliant: 7, atRisk: 2, nonCompliant: 1, complianceRate: 70 });
  });

  test('zero members → complianceRate 0 (no divide-by-zero)', async () => {
    const db = makeExecDb([{ rows: [{}] }]);
    const s = await new ComplianceRepository(db as any).getOrgSummary('org-1');
    expect(s).toEqual({ totalMembers: 0, compliant: 0, atRisk: 0, nonCompliant: 0, complianceRate: 0 });
  });

  test('missing summary row defaults all to 0', async () => {
    const db = makeExecDb([{ rows: [] }]);
    const s = await new ComplianceRepository(db as any).getOrgSummary('org-1');
    expect(s.totalMembers).toBe(0);
    expect(s.complianceRate).toBe(0);
  });
});

describe('ComplianceRepository.refresh', () => {
  test('issues a REFRESH MATERIALIZED VIEW execute', async () => {
    const db = makeExecDb([[]]);
    await new ComplianceRepository(db as any).refresh();
    expect(db._calls).toHaveLength(1);
  });
});
