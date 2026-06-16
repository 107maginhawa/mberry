import { describe, test, expect } from 'bun:test';
import { getNextCertificateNumber, reserveCertificateRange } from './certificate-numbering';

interface SeqRow {
  organizationId: string;
  year: number;
  lastSeq: number;
  orgCode: string;
}

/**
 * Stateful fake DB modelling the atomic ON CONFLICT upsert against
 * org_certificate_seq's (organization_id, year) unique constraint.
 *
 * Invariant mirrored from the real statement: the inserted `lastSeq` equals the
 * increment applied on conflict (getNextCertificateNumber inserts 1 / bumps +1;
 * reserveCertificateRange inserts `count` / bumps +`count`). Each call performs
 * a single atomic Map mutation, so Promise.all of N calls yields N disjoint,
 * gap-free allocations — the same guarantee Postgres gives under row locking.
 */
function makeStatefulDb() {
  const rows = new Map<string, SeqRow>();
  const key = (org: string, year: number) => `${org}|${year}`;

  const db: any = {
    __rows: rows,
    insert: (_table: any) => ({
      values: (values: SeqRow) => ({
        onConflictDoUpdate: (_cfg: any) => ({
          returning: async (_cols?: any) => {
            const k = key(values.organizationId, values.year);
            const existing = rows.get(k);
            if (!existing) {
              // first issuance: row stored with supplied lastSeq, RETURNING it.
              rows.set(k, { ...values });
              return [{ lastSeq: values.lastSeq }];
            }
            // conflict: bump by the same amount the insert would have added,
            // RETURNING the post-increment value.
            existing.lastSeq += values.lastSeq;
            return [{ lastSeq: existing.lastSeq }];
          },
        }),
      }),
    }),
  };
  return db;
}

describe('getNextCertificateNumber', () => {
  test('first cert of the year allocates 0001', async () => {
    const db = makeStatefulDb();
    expect((await getNextCertificateNumber(db, 'org-1', 'PDA', 2026)).certificateNumber).toBe('PDA-2026-0001');
  });

  test('increments sequentially and preserves format', async () => {
    const db = makeStatefulDb();
    const a = await getNextCertificateNumber(db, 'org-1', 'PDA', 2026);
    const b = await getNextCertificateNumber(db, 'org-1', 'PDA', 2026);
    expect(a.certificateNumber).toBe('PDA-2026-0001');
    expect(b.certificateNumber).toBe('PDA-2026-0002');
    expect(b.seq).toBe(2);
  });

  test('zero-pads to 4 digits', async () => {
    const db = makeStatefulDb();
    db.__rows.set('org-1|2026', { organizationId: 'org-1', year: 2026, lastSeq: 99, orgCode: 'PDA' });
    expect((await getNextCertificateNumber(db, 'org-1', 'PDA', 2026)).certificateNumber).toBe('PDA-2026-0100');
  });

  test('defaults to current year', async () => {
    const db = makeStatefulDb();
    expect((await getNextCertificateNumber(db, 'org-1', 'PDA')).certificateNumber).toContain(String(new Date().getFullYear()));
  });

  // ─── Concurrency: gap-free first-of-year + steady-state ──────────────────
  test('N concurrent issuances yield N distinct gap-free sequence numbers (no dupes)', async () => {
    const db = makeStatefulDb();
    const results = await Promise.all(
      Array.from({ length: 25 }, () => getNextCertificateNumber(db, 'org-1', 'PDA', 2026)),
    );
    const seqs = results.map((r) => r.seq);
    const unique = new Set(seqs);
    expect(unique.size).toBe(25); // all distinct — no race dupes
    expect([...unique].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 25 }, (_, i) => i + 1),
    ); // gap-free 1..25 including the first-of-year insert
    const numbers = new Set(results.map((r) => r.certificateNumber));
    expect(numbers.size).toBe(25); // distinct cert numbers
  });

  test('per-org isolation: two orgs both start at 0001 without colliding', async () => {
    const db = makeStatefulDb();
    const a1 = await getNextCertificateNumber(db, 'org-A', 'AAA', 2026);
    const b1 = await getNextCertificateNumber(db, 'org-B', 'BBB', 2026);
    const a2 = await getNextCertificateNumber(db, 'org-A', 'AAA', 2026);
    expect(a1.certificateNumber).toBe('AAA-2026-0001');
    expect(b1.certificateNumber).toBe('BBB-2026-0001');
    expect(a2.certificateNumber).toBe('AAA-2026-0002');
  });

  test('per-year isolation: sequence resets across years', async () => {
    const db = makeStatefulDb();
    const y25 = await getNextCertificateNumber(db, 'org-1', 'PDA', 2025);
    const y26 = await getNextCertificateNumber(db, 'org-1', 'PDA', 2026);
    expect(y25.seq).toBe(1);
    expect(y26.seq).toBe(1);
  });
});

describe('reserveCertificateRange', () => {
  test('first reservation starts at 1 and is contiguous', async () => {
    const db = makeStatefulDb();
    const { startSeq, year } = await reserveCertificateRange(db, 'org-1', 'PDA', 5, 2026);
    expect(startSeq).toBe(1);
    expect(year).toBe(2026);
  });

  test('subsequent reservations do not overlap', async () => {
    const db = makeStatefulDb();
    const first = await reserveCertificateRange(db, 'org-1', 'PDA', 5, 2026); // 1..5
    const second = await reserveCertificateRange(db, 'org-1', 'PDA', 3, 2026); // 6..8
    expect(first.startSeq).toBe(1);
    expect(second.startSeq).toBe(6);
  });

  test('concurrent batches reserve disjoint contiguous blocks (no overlap, gap-free)', async () => {
    const db = makeStatefulDb();
    const sizes = [4, 2, 5, 3];
    const reservations = await Promise.all(
      sizes.map((n) => reserveCertificateRange(db, 'org-1', 'PDA', n, 2026)),
    );
    // Expand every reserved block into its individual seq numbers.
    const allSeqs = reservations.flatMap((r, i) =>
      Array.from({ length: sizes[i]! }, (_, k) => r.startSeq + k),
    );
    const unique = new Set(allSeqs);
    expect(unique.size).toBe(allSeqs.length); // no overlap across batches
    const total = sizes.reduce((a, b) => a + b, 0);
    expect([...unique].sort((a, b) => a - b)).toEqual(
      Array.from({ length: total }, (_, i) => i + 1),
    ); // gap-free 1..total
  });

  test('single getNext + range share one sequence space', async () => {
    const db = makeStatefulDb();
    const one = await getNextCertificateNumber(db, 'org-1', 'PDA', 2026); // seq 1
    const range = await reserveCertificateRange(db, 'org-1', 'PDA', 3, 2026); // 2..4
    expect(one.seq).toBe(1);
    expect(range.startSeq).toBe(2);
  });
});
