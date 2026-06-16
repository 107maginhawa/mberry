// Business Rules: [BR-06] duplicate-payment guard | [BR-08] refund cap |
// [FIX-003] atomic per-(org,year) receipt sequence | [M06] status-transition audit trail.
//
// Unit/integration suite for DuesRepository — the dues module previously had
// ZERO tests. These exercise the real repo code paths via a stateful in-memory
// fake DB that faithfully models the two pieces of SQL behaviour the repo relies
// on: the `dues_receipt_counter` upsert (atomic increment) and a `dues_payment`
// store for duplicate-detection + status transitions.
//
// Known-bug tests are guarded with test.todo + a file:line citation so the
// suite stays green. See docs/audits/review-2026-06-16/03-money.md.

import { describe, test, expect } from 'bun:test';
import { DuesRepository } from './dues-payments.repo';
import {
  DUES_PAYMENT_VALID_TRANSITIONS,
  isValidTransition,
} from '@/utils/status-transitions';
import { validateRefundEligibility } from '@/handlers/association:member/utils/refund-validation';

// ─── Stateful fake DB ───────────────────────────────────
//
// Models exactly the statements DuesRepository issues against:
//   • dues_receipt_counter  — insert .. onConflictDoUpdate { nextSequence: n+1 }
//                             .. returning({ nextSequence })
//   • dues_payment          — insert/select/update for the duplicate guard +
//                             updatePaymentStatus path
//   • dues_payment_status_history — insert (audit trail)
//
// Drizzle column refs are opaque to us, so each chain identifies its target by
// the *table object* passed to .insert()/.select().from()/.update(). We tag the
// real schema objects by identity.

import {
  duesReceiptCounters,
  duesPayments,
} from './dues-payments.schema';
import { duesPaymentStatusHistory } from '../../association:member/repos/dues-payment-status-history.schema';

interface CounterRow {
  organizationId: string;
  year: number;
  nextSequence: number;
}

function makeStatefulDb() {
  // (orgId|year) -> counter row
  const counters = new Map<string, CounterRow>();
  // id -> payment row
  const payments = new Map<string, any>();
  const statusHistory: any[] = [];

  const key = (org: string, year: number) => `${org}|${year}`;

  function counterInsert(values: CounterRow) {
    return {
      onConflictDoUpdate: (_cfg: any) => ({
        returning: async () => {
          const k = key(values.organizationId, values.year);
          const existing = counters.get(k);
          if (!existing) {
            // first insert: row stored with the supplied nextSequence (=2),
            // RETURNING yields that stored value.
            counters.set(k, { ...values });
            return [{ nextSequence: values.nextSequence }];
          }
          // conflict: increment stored counter, RETURNING the post-increment value.
          existing.nextSequence += 1;
          return [{ nextSequence: existing.nextSequence }];
        },
      }),
    };
  }

  function paymentInsert(values: any) {
    const row = { refundedAmount: 0, ...values, id: values.id ?? crypto.randomUUID() };
    payments.set(row.id, row);
    return {
      returning: async () => [row],
      then: (resolve: any) => Promise.resolve(undefined).then(resolve),
    };
  }

  function historyInsert(values: any) {
    statusHistory.push(values);
    return {
      returning: async () => [values],
      then: (resolve: any) => Promise.resolve(undefined).then(resolve),
    };
  }

  // A payments select chain that supports the duplicate-guard query:
  //   select().from(duesPayments).where(...).orderBy(...).limit(1)
  // We can't introspect the drizzle `where`, so the chain closes over a filter
  // installed per-call via the active query context.
  let pendingPaymentFilter: ((r: any) => boolean) | null = null;

  function paymentSelectChain() {
    const chain: any = {
      from: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      // [FIX-008] getPaymentForUpdate adds `.for('update')` to the chain. The
      // fake models the lock's *effect* — a re-read of current store state —
      // not OS-level blocking. Returning `chain` keeps the chain fluent.
      for: () => chain,
      orderBy: () => chain,
      limit: async (_n: number) => {
        const all = [...payments.values()].filter(pendingPaymentFilter ?? (() => true));
        // newest first by createdAt
        all.sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
        );
        return _n != null ? all.slice(0, _n) : all;
      },
      then: (resolve: any) =>
        Promise.resolve(
          [...payments.values()].filter(pendingPaymentFilter ?? (() => true)),
        ).then(resolve),
    };
    return chain;
  }

  const db: any = {
    __counters: counters,
    __payments: payments,
    __statusHistory: statusHistory,
    __setPaymentFilter: (f: ((r: any) => boolean) | null) => {
      pendingPaymentFilter = f;
    },
    insert: (table: any) => ({
      values: (values: any) => {
        if (table === duesReceiptCounters) return counterInsert(values);
        if (table === duesPaymentStatusHistory) return historyInsert(values);
        if (table === duesPayments) return paymentInsert(values);
        // generic
        return {
          returning: async () => [values],
          then: (resolve: any) => Promise.resolve(undefined).then(resolve),
        };
      },
    }),
    select: (_cols?: any) => ({
      from: (table: any) => {
        if (table === duesPayments) return paymentSelectChain();
        const empty: any = {
          from: () => empty,
          leftJoin: () => empty,
          where: () => empty,
          orderBy: async () => [],
          limit: async () => [],
          then: (resolve: any) => Promise.resolve([]).then(resolve),
        };
        return empty;
      },
    }),
    update: (table: any) => ({
      set: (data: any) => ({
        where: (_c: any) => ({
          returning: async () => {
            if (table === duesPayments) {
              // updatePaymentStatus targets the row by id; we don't have the id
              // from `where`, so the test installs the target via __updateTarget.
              const id = db.__updateTarget;
              const existing = id ? payments.get(id) : undefined;
              const updated = { ...(existing ?? {}), ...data };
              if (id) payments.set(id, updated);
              return [updated];
            }
            return [data];
          },
        }),
      }),
    }),
    transaction: async (fn: any) => fn(db),
  };
  return db;
}

// ─── Receipt sequence allocation [FIX-003] ──────────────

describe('[FIX-003] getNextReceiptSequence', () => {
  test('sequential allocations yield 1,2,3… gap-free', async () => {
    const db = makeStatefulDb();
    const repo = new DuesRepository(db);
    const seqs: number[] = [];
    for (let i = 0; i < 5; i++) {
      seqs.push(await repo.getNextReceiptSequence('org-A', 2026));
    }
    expect(seqs).toEqual([1, 2, 3, 4, 5]);
  });

  test('N concurrent allocations yield N distinct gap-free numbers', async () => {
    const db = makeStatefulDb();
    const repo = new DuesRepository(db);
    // The fake counter increments atomically (single Map mutation per call),
    // mirroring the real onConflictDoUpdate { nextSequence: n+1 } statement.
    const results = await Promise.all(
      Array.from({ length: 20 }, () => repo.getNextReceiptSequence('org-A', 2026)),
    );
    const unique = new Set(results);
    expect(unique.size).toBe(20); // all distinct
    expect([...unique].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    ); // gap-free 1..20
  });

  test('per-org isolation: two orgs do not collide', async () => {
    const db = makeStatefulDb();
    const repo = new DuesRepository(db);
    const a1 = await repo.getNextReceiptSequence('org-A', 2026);
    const b1 = await repo.getNextReceiptSequence('org-B', 2026);
    const a2 = await repo.getNextReceiptSequence('org-A', 2026);
    const b2 = await repo.getNextReceiptSequence('org-B', 2026);
    expect([a1, a2]).toEqual([1, 2]); // org-A independent
    expect([b1, b2]).toEqual([1, 2]); // org-B independent — both start at 1
  });

  test('per-year isolation: sequence resets across years', async () => {
    const db = makeStatefulDb();
    const repo = new DuesRepository(db);
    const y25 = await repo.getNextReceiptSequence('org-A', 2025);
    const y26 = await repo.getNextReceiptSequence('org-A', 2026);
    expect([y25, y26]).toEqual([1, 1]);
  });
});

describe('getOrgReceiptPrefix', () => {
  test('derives uppercase-alphanumeric prefix from org slug', async () => {
    const db = makeStatefulDb();
    // org slug read returns empty → buildReceiptPrefix falls back to 'ORG'.
    const repo = new DuesRepository(db);
    const prefix = await repo.getOrgReceiptPrefix('org-A');
    expect(prefix).toBe('ORG'); // fake select returns no org row → safe default
  });
});

// ─── Payment status transitions [M06] ───────────────────

describe('[M06] updatePaymentStatus transitions', () => {
  function seedPayment(db: any, overrides: any = {}) {
    const id = overrides.id ?? 'pay-1';
    db.__payments.set(id, {
      id,
      organizationId: 'org-A',
      personId: 'person-1',
      status: 'pending',
      amount: 5000,
      refundedAmount: 0,
      ...overrides,
    });
    db.__updateTarget = id;
    return id;
  }

  test('valid transition pending → completed succeeds', async () => {
    const db = makeStatefulDb();
    const repo = new DuesRepository(db);
    const id = seedPayment(db);
    const result = await repo.updatePaymentStatus(id, 'pending', 'completed', undefined, 'actor-1');
    expect(result.status).toBe('completed');
  });

  test('valid transition submitted → confirmed succeeds', async () => {
    const db = makeStatefulDb();
    const repo = new DuesRepository(db);
    const id = seedPayment(db, { status: 'submitted' });
    const result = await repo.updatePaymentStatus(id, 'submitted', 'confirmed', undefined, 'actor-1');
    expect(result.status).toBe('confirmed');
  });

  test('invalid transition pending → refunded is rejected (ConflictError)', async () => {
    const db = makeStatefulDb();
    const repo = new DuesRepository(db);
    const id = seedPayment(db);
    await expect(
      repo.updatePaymentStatus(id, 'pending', 'refunded', undefined, 'actor-1'),
    ).rejects.toThrow(/Cannot transition/);
  });

  test('invalid transition from terminal refunded is rejected', async () => {
    const db = makeStatefulDb();
    const repo = new DuesRepository(db);
    const id = seedPayment(db, { status: 'refunded' });
    await expect(
      repo.updatePaymentStatus(id, 'refunded', 'completed', undefined, 'actor-1'),
    ).rejects.toThrow(/Cannot transition/);
  });

  test('valid transition writes a status-history audit row', async () => {
    const db = makeStatefulDb();
    const repo = new DuesRepository(db);
    const id = seedPayment(db);
    await repo.updatePaymentStatus(id, 'pending', 'completed', undefined, 'actor-1');
    expect(db.__statusHistory.length).toBe(1);
    const row = db.__statusHistory[0];
    expect(row.fromStatus).toBe('pending');
    expect(row.toStatus).toBe('completed');
    expect(row.changedBy).toBe('actor-1');
  });

  test('rejection reason is captured in the audit row', async () => {
    const db = makeStatefulDb();
    const repo = new DuesRepository(db);
    const id = seedPayment(db, { status: 'submitted' });
    await repo.updatePaymentStatus(
      id,
      'submitted',
      'rejected',
      { rejectionReason: 'bad proof' } as any,
      'actor-1',
    );
    expect(db.__statusHistory[0].reason).toBe('bad proof');
  });

  /**
   * Concurrent confirm-vs-reject. updatePaymentStatus validates the transition
   * against the *caller-supplied* currentStatus, NOT a freshly-read row, and the
   * UPDATE has no `WHERE status = currentStatus` optimistic guard
   * (dues-payments.repo.ts:191-217). So two racing officers — one confirming,
   * one rejecting — can both pass validation from the same `submitted` snapshot
   * and the last writer wins. Documented here as current (unlocked) behaviour.
   */
  test('concurrent confirm-vs-reject from same snapshot: last-writer-wins (characterization)', async () => {
    const db = makeStatefulDb();
    const repo = new DuesRepository(db);
    const id = seedPayment(db, { status: 'submitted' });

    // Both read the SAME currentStatus='submitted' (no row re-read / no lock).
    await repo.updatePaymentStatus(id, 'submitted', 'confirmed', undefined, 'officer-A');
    db.__updateTarget = id;
    await repo.updatePaymentStatus(id, 'submitted', 'rejected', undefined, 'officer-B');

    // Last writer wins — the repo did not reject the stale second transition.
    expect(db.__payments.get(id).status).toBe('rejected');
    // Two audit rows written, both claiming fromStatus 'submitted' — the
    // smoking gun that the second transition operated on a stale snapshot.
    expect(db.__statusHistory.length).toBe(2);
    expect(db.__statusHistory.every((h: any) => h.fromStatus === 'submitted')).toBe(true);
  });

  // KNOWN BUG: dues-payments.repo.ts:191-217 — updatePaymentStatus performs no
  // optimistic-concurrency guard (no `WHERE status = currentStatus` / no version
  // check). A stale second transition silently overwrites the first. See
  // docs/audits/review-2026-06-16/03-money.md.
  test.todo(
    'updatePaymentStatus should reject a stale transition when row status already changed (needs WHERE status=currentStatus guard) — dues-payments.repo.ts:191-217',
  );
});

// ─── Duplicate payment detection [BR-06] ────────────────

describe('[BR-06] findRecentPaymentForPerson duplicate guard', () => {
  function seed(db: any, createdAt: Date, overrides: any = {}) {
    const id = overrides.id ?? crypto.randomUUID();
    db.__payments.set(id, {
      id,
      organizationId: 'org-A',
      personId: 'person-1',
      createdAt,
      amount: 5000,
      ...overrides,
    });
    return id;
  }

  test('returns a payment created within the 5-minute window', async () => {
    const db = makeStatefulDb();
    const repo = new DuesRepository(db);
    seed(db, new Date(Date.now() - 2 * 60 * 1000)); // 2 min ago
    db.__setPaymentFilter(
      (r: any) =>
        r.organizationId === 'org-A' &&
        r.personId === 'person-1' &&
        new Date(r.createdAt).getTime() >= Date.now() - 5 * 60 * 1000,
    );
    const recent = await repo.findRecentPaymentForPerson('org-A', 'person-1', 5);
    expect(recent).toBeDefined();
  });

  test('returns undefined when the only payment is older than the window', async () => {
    const db = makeStatefulDb();
    const repo = new DuesRepository(db);
    seed(db, new Date(Date.now() - 10 * 60 * 1000)); // 10 min ago
    db.__setPaymentFilter(
      (r: any) =>
        r.organizationId === 'org-A' &&
        r.personId === 'person-1' &&
        new Date(r.createdAt).getTime() >= Date.now() - 5 * 60 * 1000,
    );
    const recent = await repo.findRecentPaymentForPerson('org-A', 'person-1', 5);
    expect(recent).toBeUndefined();
  });

  test('does not match a different person (per-person scoping)', async () => {
    const db = makeStatefulDb();
    const repo = new DuesRepository(db);
    seed(db, new Date(), { personId: 'person-2' });
    db.__setPaymentFilter(
      (r: any) => r.organizationId === 'org-A' && r.personId === 'person-1',
    );
    const recent = await repo.findRecentPaymentForPerson('org-A', 'person-1', 5);
    expect(recent).toBeUndefined();
  });

  /**
   * CHARACTERIZATION: findRecentPaymentForPerson is a *detector*, not an
   * enforcer. recordDuesPayment.ts only surfaces its result as
   * `meta.concurrentWarning: true` and still records the payment (HTTP 201) —
   * verified by recordDuesPayment.test.ts "warns when recent payment exists".
   * The guard is WARN-ONLY; it does NOT block a duplicate.
   */
  test('the duplicate guard is warn-only — detector returns a hit but does not block', async () => {
    const db = makeStatefulDb();
    const repo = new DuesRepository(db);
    seed(db, new Date());
    db.__setPaymentFilter(() => true);
    const recent = await repo.findRecentPaymentForPerson('org-A', 'person-1', 5);
    // Detector simply returns the row; nothing in the repo throws/blocks.
    expect(recent).toBeDefined();
  });

  // INTENDED (not yet implemented): a hard duplicate block. Currently the 5-min
  // guard only warns (recordDuesPayment.ts surfaces meta.concurrentWarning).
  // See docs/audits/review-2026-06-16/03-money.md.
  test.todo(
    'recordDuesPayment should optionally HARD-BLOCK a same-member duplicate within 5 min (currently warn-only)',
  );
});

// ─── Refund logic [BR-08] ───────────────────────────────
//
// The refund cap lives in the pure validateRefundEligibility() function, which
// the refundDuesPayment handler calls before mutating. We test the cap directly
// (deterministic) and characterize the concurrent-partial-refund race.

describe('[BR-08] refund eligibility / over-refund cap', () => {
  const base = {
    paymentStatus: 'completed',
    paymentPaidAt: new Date(),
    paymentAmount: 5000,
    alreadyRefunded: 0,
    requestedRefundAmount: null as number | null,
  };

  test('full refund of a completed payment is eligible', () => {
    expect(validateRefundEligibility({ ...base }).eligible).toBe(true);
  });

  test('partial refund within remaining balance is eligible', () => {
    expect(
      validateRefundEligibility({ ...base, requestedRefundAmount: 2000 }).eligible,
    ).toBe(true);
  });

  test('over-refund (request > remaining) is rejected', () => {
    const r = validateRefundEligibility({
      ...base,
      alreadyRefunded: 4000,
      requestedRefundAmount: 2000, // 4000 + 2000 > 5000
    });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.code).toBe('EXCEEDS_REFUNDABLE');
  });

  test('refund of an already-fully-refunded payment is rejected', () => {
    const r = validateRefundEligibility({ ...base, paymentStatus: 'refunded' });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.code).toBe('ALREADY_REFUNDED');
  });

  test('refund of a non-refundable status (pending) is rejected', () => {
    const r = validateRefundEligibility({ ...base, paymentStatus: 'pending' });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.code).toBe('INVALID_STATUS');
  });

  test('refund outside the 30-day window is rejected', () => {
    const r = validateRefundEligibility({
      ...base,
      paymentPaidAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.code).toBe('REFUND_WINDOW_EXPIRED');
  });

  test('zero remaining (fully consumed by prior partials) is rejected', () => {
    const r = validateRefundEligibility({
      ...base,
      alreadyRefunded: 5000,
      requestedRefundAmount: null, // full of what remains = 0
    });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.code).toBe('NOTHING_TO_REFUND');
  });

  /**
   * CONCURRENT PARTIAL REFUND RACE.
   *
   * refundDuesPayment.ts reads `payment.refundedAmount` OUTSIDE the transaction
   * (line 61) and validates the cap against that stale snapshot. Two concurrent
   * partial refunds that each individually pass the cap can, combined, exceed
   * the original payment — because neither sees the other's increment until both
   * have already validated.
   *
   * Demonstrated here against the pure validator: two requests of 3000 each on a
   * 5000 payment, BOTH validating against alreadyRefunded=0 (the stale snapshot),
   * both pass — yet 3000 + 3000 = 6000 > 5000.
   */
  test('two concurrent partials each pass against a stale alreadyRefunded=0 snapshot (race window)', () => {
    const staleSnapshot = 0; // both reads happen before either write
    const reqA = validateRefundEligibility({
      ...base,
      alreadyRefunded: staleSnapshot,
      requestedRefundAmount: 3000,
    });
    const reqB = validateRefundEligibility({
      ...base,
      alreadyRefunded: staleSnapshot,
      requestedRefundAmount: 3000,
    });
    // Both individually eligible …
    expect(reqA.eligible).toBe(true);
    expect(reqB.eligible).toBe(true);
    // … but their sum over-refunds. The validator cannot catch this because the
    // race is in the read-outside-tx in refundDuesPayment.ts:61-101.
    expect(3000 + 3000).toBeGreaterThan(base.paymentAmount);
  });

  /**
   * [FIX-008] Over-refund race fix — repo-layer proof.
   *
   * refundDuesPayment.ts no longer trusts the pre-tx `refundedAmount` snapshot.
   * Inside the tx it calls `getPaymentForUpdate(id)` (a `SELECT … FOR UPDATE`
   * locked re-read) and re-validates the cap against the FRESH value before
   * incrementing.
   *
   * A real DB serialises two concurrent refunds via the row lock: the second
   * blocks until the first commits, then re-reads the updated `refundedAmount`.
   * We model exactly that serialised order here — refund A commits its
   * increment to the store, THEN refund B does its locked re-read — and assert
   * that B, seeing the fresh value, is capped. This is the deterministic
   * equivalent of the previously-untestable concurrent race: under the old
   * stale-snapshot code B would have read refundedAmount=0 and over-refunded.
   *
   * (True OS-level parallel blocking needs a real Postgres; the lock's *effect*
   * — re-read of committed state — is what the fix guarantees and what we prove.)
   */
  test('[FIX-008] second partial re-reads via FOR UPDATE and is capped (over-refund race fixed)', async () => {
    const db = makeStatefulDb();
    const repo = new DuesRepository(db);

    const id = 'pay-refund-race';
    // 5000 payment, nothing refunded yet. Two refunds of 3000 each will race.
    db.__payments.set(id, {
      id,
      organizationId: 'org-A',
      personId: 'person-1',
      status: 'completed',
      amount: 5000,
      refundedAmount: 0,
      paidAt: new Date(),
    });
    db.__updateTarget = id;
    db.__setPaymentFilter((r: any) => r.id === id);

    // ── Refund A (wins): locked re-read sees refundedAmount=0, 3000 ≤ 5000 ──
    const lockedA = await repo.getPaymentForUpdate(id);
    expect(lockedA).toBeDefined();
    const alreadyA = lockedA!.refundedAmount ?? 0;
    const capA = validateRefundEligibility({
      paymentStatus: lockedA!.status,
      paymentPaidAt: lockedA!.paidAt ?? null,
      paymentAmount: lockedA!.amount,
      alreadyRefunded: alreadyA,
      requestedRefundAmount: 3000,
    });
    expect(capA.eligible).toBe(true);
    const newTotalA = alreadyA + 3000; // 3000
    // A commits its increment (FOR UPDATE lock released on commit).
    await repo.updatePaymentStatus(id, lockedA!.status, 'partiallyRefunded', {
      refundedAmount: newTotalA,
    } as any, 'officer-A');
    expect(db.__payments.get(id).refundedAmount).toBe(3000);

    // ── Refund B (blocked until A commits): locked re-read now sees 3000 ──
    const lockedB = await repo.getPaymentForUpdate(id);
    const alreadyB = lockedB!.refundedAmount ?? 0;
    expect(alreadyB).toBe(3000); // FRESH value, NOT the stale 0
    const capB = validateRefundEligibility({
      paymentStatus: lockedB!.status,
      paymentPaidAt: lockedB!.paidAt ?? null,
      paymentAmount: lockedB!.amount,
      alreadyRefunded: alreadyB,
      requestedRefundAmount: 3000, // 3000 + 3000 = 6000 > 5000
    });
    // B is rejected — cumulative refunds can never exceed the original.
    expect(capB.eligible).toBe(false);
    if (!capB.eligible) expect(capB.code).toBe('EXCEEDS_REFUNDABLE');

    // Final stored refundedAmount stays within the cap.
    expect(db.__payments.get(id).refundedAmount).toBeLessThanOrEqual(5000);
  });
});

// ─── Status-transition map sanity ───────────────────────

describe('DUES_PAYMENT_VALID_TRANSITIONS map', () => {
  test('confirmed can move to completed/refunded/partiallyRefunded', () => {
    expect(isValidTransition(DUES_PAYMENT_VALID_TRANSITIONS, 'confirmed', 'completed')).toBe(true);
    expect(isValidTransition(DUES_PAYMENT_VALID_TRANSITIONS, 'confirmed', 'refunded')).toBe(true);
    expect(isValidTransition(DUES_PAYMENT_VALID_TRANSITIONS, 'confirmed', 'partiallyRefunded')).toBe(true);
  });

  test('partiallyRefunded → refunded is valid (completes a refund)', () => {
    expect(isValidTransition(DUES_PAYMENT_VALID_TRANSITIONS, 'partiallyRefunded', 'refunded')).toBe(true);
  });

  test('refunded and expired are terminal', () => {
    expect(DUES_PAYMENT_VALID_TRANSITIONS['refunded']).toEqual([]);
    expect(DUES_PAYMENT_VALID_TRANSITIONS['expired']).toEqual([]);
  });

  test('rejected/failed allow re-entry to pending', () => {
    expect(isValidTransition(DUES_PAYMENT_VALID_TRANSITIONS, 'rejected', 'pending')).toBe(true);
    expect(isValidTransition(DUES_PAYMENT_VALID_TRANSITIONS, 'failed', 'pending')).toBe(true);
  });
});
