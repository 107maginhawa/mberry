/**
 * TC-DEC-02 (AHA Step 47) — manual-entry VERIFICATION GATE.
 *
 * Decision (captured verbatim in training-credits-fix-report.md):
 *   Member-submitted manual CPD entries enter `verificationStatus='pending'`
 *   and only count toward the member's credit total once an officer/admin
 *   verifies them. AUTO (training-attendance) credits are system-verified at
 *   award time and count immediately.
 *
 * This pins the gate at the two seams it lives on:
 *   1. WRITE side  — AUTO award stamps verificationStatus='verified';
 *                    member self-entry leaves it at the schema default
 *                    ('pending') and is never verified on create.
 *   2. READ side   — every credit-TOTAL aggregate (sumCreditsForCycle,
 *                    sumCreditsByOrg, sumCreditsByCategoryBatch, the transcript
 *                    list, and getMyCredits) filters verification_status =
 *                    'verified', so a pending member entry does NOT inflate the
 *                    total. The member's history view still SHOWS pending rows.
 *   3. SCHEMA side — the compliance_standings matview (officer report) agrees
 *                    with the repo reads by filtering verification_status too,
 *                    mirroring the FIX-005 status='active' lesson.
 *
 * Harness: mock-db + real handlers/repo methods (no fabricated `_body`). The
 * aggregate proofs capture the real WHERE the repo builds and assert the
 * verification_status column appears in it.
 */

import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeCtx, makeMockDb } from '@/test-utils/make-ctx';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { awardTrainingCredit } from '@/handlers/association:operations/utils/award-training-credit';

// ── queryChunks walker ──────────────────────────────────────────────────────
// Drizzle eq()/and() produce nested SQL objects whose chunks include the
// referenced Column instances. A Column has a string `.name`. Collect them so
// a test can assert a given physical column participates in the WHERE.
function columnNamesInSql(node: any, acc: string[] = [], seen = new Set<any>()): string[] {
  if (!node || typeof node !== 'object' || seen.has(node)) return acc;
  seen.add(node);
  if (typeof node.name === 'string' && ('table' in node || 'columnType' in node)) {
    acc.push(node.name);
  }
  const chunks = node.queryChunks ?? node.chunks;
  if (Array.isArray(chunks)) for (const c of chunks) columnNamesInSql(c, acc, seen);
  if (Array.isArray(node)) for (const c of node) columnNamesInSql(c, acc, seen);
  return acc;
}

// A db whose every chained method returns the same thenable proxy, resolving to
// `rows`, while recording each WHERE condition passed to `.where(...)`.
function recordingDb(rows: any[] = []) {
  const wheres: any[] = [];
  const chain: any = new Proxy(function () {} as any, {
    get(_t, prop) {
      if (prop === 'then') return (res: any, rej?: any) => Promise.resolve(rows).then(res, rej);
      if (prop === 'where') return (cond: any) => { wheres.push(cond); return chain; };
      return (..._a: any[]) => chain;
    },
    apply() { return chain; },
  });
  return { db: chain as any, wheres };
}

const CYCLE_START = new Date('2024-01-01');
const CYCLE_END = new Date('2026-01-01');

// ── 1. WRITE side ───────────────────────────────────────────────────────────

describe('[TC-DEC-02] AUTO training credit is system-verified at award', () => {
  test('awardTrainingCredit stamps verificationStatus=verified on the AUTO entry', async () => {
    const db = makeMockDb();
    const training = {
      id: 'training-1',
      organizationId: 'org-1',
      title: 'Dental Photography Seminar',
      creditAmount: 8,
      creditBearing: true,
      endDate: new Date('2024-09-15'),
    };

    const { creditAwarded } = await awardTrainingCredit(db as any, null, training as any, 'member-1');

    expect(creditAwarded).toBe(8);
    expect((db as any)._inserted).toHaveLength(1);
    expect((db as any)._inserted[0].type).toBe('auto');
    expect((db as any)._inserted[0].verificationStatus).toBe('verified');
  });
});

describe('[TC-DEC-02] member self-entry is NOT verified on create', () => {
  test('createCreditEntry leaves verificationStatus at the pending default (never sets verified)', async () => {
    const { createCreditEntry } = await import('./createCreditEntry');
    const db = makeMockDb();
    const ctx = makeCtx({
      database: db,
      _body: {
        organizationId: 'tenant-1',
        activityName: 'External CPD Course',
        activityDate: '2024-06-01',
        registrationDate: '2023-01-01',
        creditAmount: 4,
      },
    });

    await createCreditEntry(ctx as any);

    expect((db as any)._inserted).toHaveLength(1);
    // Omitted → DB default 'pending'. Crucially it must never be 'verified'.
    expect((db as any)._inserted[0].verificationStatus).not.toBe('verified');
  });
});

// ── 2. READ side: aggregates exclude pending (count only verified) ───────────

describe('[TC-DEC-02] credit-total aggregates filter verification_status=verified', () => {
  test('sumCreditsForCycle WHERE references verification_status', async () => {
    const { db, wheres } = recordingDb([{ total: 0 }]);
    const repo = new CreditEntryRepository(db, null as any);
    await repo.sumCreditsForCycle('member-1', CYCLE_START, CYCLE_END, 'org-1');
    expect(wheres).toHaveLength(1);
    expect(columnNamesInSql(wheres[0])).toContain('verification_status');
    // The pre-existing void exclusion must remain.
    expect(columnNamesInSql(wheres[0])).toContain('status');
  });

  test('sumCreditsByOrg WHERE references verification_status', async () => {
    const { db, wheres } = recordingDb([]);
    const repo = new CreditEntryRepository(db, null as any);
    await repo.sumCreditsByOrg('member-1', CYCLE_START, CYCLE_END);
    expect(wheres).toHaveLength(1);
    expect(columnNamesInSql(wheres[0])).toContain('verification_status');
  });

  test('sumCreditsByCategoryBatch WHERE references verification_status', async () => {
    const { db, wheres } = recordingDb([]);
    const repo = new CreditEntryRepository(db, null as any);
    await repo.sumCreditsByCategoryBatch(['member-1'], CYCLE_START, CYCLE_END, 'org-1');
    expect(wheres).toHaveLength(1);
    expect(columnNamesInSql(wheres[0])).toContain('verification_status');
  });

  test('transcript list (listForPerson) filters verification_status=verified', async () => {
    const { db, wheres } = recordingDb([]);
    const repo = new CreditEntryRepository(db, null as any);
    await repo.listForPerson('member-1', { cycleStart: CYCLE_START, cycleEnd: CYCLE_END });
    expect(wheres.length).toBeGreaterThanOrEqual(1);
    expect(columnNamesInSql(wheres[0])).toContain('verification_status');
  });
});

describe('[TC-DEC-02] getMyCredits: total excludes pending, history still shows it', () => {
  test('the SUM query filters verification_status but the history query does not', async () => {
    const { getMyCredits } = await import('@/handlers/person/getMyCredits');
    const { db, wheres } = recordingDb([]);
    // No organizationId → skip the org_cpd_config read, so the only WHEREs are
    // the aggregate SUM (first) and the history list (second).
    const ctx = makeCtx({ database: db, organizationId: undefined });
    await getMyCredits(ctx as any);

    expect(wheres.length).toBeGreaterThanOrEqual(2);
    const sumWhere = columnNamesInSql(wheres[0]);
    const historyWhere = columnNamesInSql(wheres[1]);
    expect(sumWhere).toContain('verification_status');
    // Member must still SEE their pending submissions in history.
    expect(historyWhere).not.toContain('verification_status');
  });
});

// ── 3. SCHEMA side: matview agrees with repo reads ──────────────────────────

describe('[TC-DEC-02] compliance_standings matview filters verification_status=verified', () => {
  test('the 0070 migration re-creates the matview with the verified gate', () => {
    const migration = join(
      import.meta.dir,
      '../../../generated/migrations/0070_credit_verification_gate.sql',
    );
    const sql = readFileSync(migration, 'utf8');
    expect(sql).toContain('compliance_standings');
    const normalized = sql.replace(/\s+/g, ' ').toLowerCase();
    // Both gates present: void exclusion (FIX-005) AND the new verification gate.
    expect(normalized).toMatch(/ce\.status\s*=\s*'active'/);
    expect(normalized).toMatch(/ce\.verification_status\s*=\s*'verified'/);
  });
});
