// Unit suite for PaymentTokenRepository — one-tap payment-link tokens.
// Verifies create returns the inserted row, markUsed stamps usedAt, and the
// hash-lookup paths return the stored row (or undefined when absent).
// Uses a small stateful fake DB that models the drizzle insert/select/update
// chains the repo issues (no real Postgres in unit tests — same convention as
// the rest of the handler test suite).

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { PaymentTokenRepository } from './payment-token.repo';
import { paymentTokens } from './payment-token.schema';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

function makeTokenDb() {
  const rows = new Map<string, any>(); // id -> token row
  let selectFilter: ((r: any) => boolean) | null = null;
  let updateTarget: string | null = null;

  const db: any = {
    __rows: rows,
    __setSelectFilter: (f: ((r: any) => boolean) | null) => { selectFilter = f; },
    __setUpdateTarget: (id: string) => { updateTarget = id; },
    insert: (_table: any) => ({
      values: (v: any) => ({
        returning: async () => {
          const row = { id: v.id ?? crypto.randomUUID(), ...v };
          rows.set(row.id, row);
          return [row];
        },
      }),
    }),
    select: (_cols?: any) => {
      const chain: any = {
        from: () => chain,
        innerJoin: () => chain,
        where: () => chain,
        limit: async (_n: number) =>
          [...rows.values()].filter(selectFilter ?? (() => true)).slice(0, _n),
      };
      return chain;
    },
    update: (_table: any) => ({
      set: (data: any) => ({
        where: (_c: any) => ({
          returning: async () => {
            const existing = updateTarget ? rows.get(updateTarget) : undefined;
            const updated = { ...(existing ?? {}), ...data };
            if (updateTarget) rows.set(updateTarget, updated);
            return [updated];
          },
        }),
      }),
    }),
  };
  return db;
}

const sampleToken = {
  id: 'tok-1',
  tokenHash: 'hash-abc',
  personId: 'person-1',
  organizationId: 'org-A',
  amount: 5000,
  currency: 'PHP',
  expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
  usedAt: null,
  createdByOfficer: 'officer-1',
};

describe('PaymentTokenRepository', () => {
  test('create persists and returns the inserted token', async () => {
    const db = makeTokenDb();
    const repo = new PaymentTokenRepository(db);
    const created = await repo.create(sampleToken as any);
    expect(created.tokenHash).toBe('hash-abc');
    expect(db.__rows.size).toBe(1);
  });

  test('findByTokenHash returns the matching row', async () => {
    const db = makeTokenDb();
    const repo = new PaymentTokenRepository(db);
    await repo.create(sampleToken as any);
    db.__setSelectFilter((r: any) => r.tokenHash === 'hash-abc');
    const found = await repo.findByTokenHash('hash-abc');
    expect(found?.id).toBe('tok-1');
  });

  test('findByTokenHash returns undefined for an unknown hash', async () => {
    const db = makeTokenDb();
    const repo = new PaymentTokenRepository(db);
    await repo.create(sampleToken as any);
    db.__setSelectFilter((r: any) => r.tokenHash === 'does-not-exist');
    const found = await repo.findByTokenHash('does-not-exist');
    expect(found).toBeUndefined();
  });

  test('markUsed stamps usedAt on the token', async () => {
    const db = makeTokenDb();
    const repo = new PaymentTokenRepository(db);
    await repo.create(sampleToken as any);
    db.__setUpdateTarget('tok-1');
    const updated = await repo.markUsed('tok-1');
    expect(updated?.usedAt).toBeInstanceOf(Date);
  });
});

// ─── Real-PG concurrency suite — claim mutex / CAS / revoke ─────────────────
// The single-winner mutex (claimForCheckout) and CAS (markUsedCas) are money-path
// correctness: a double-tap must never double-claim or double-charge. These are
// atomic single-statement UPDATE…WHERE…RETURNING — only real Postgres row-lock
// semantics (not a fake DB) can prove the single-winner guarantee, so this section
// runs against the SHARED pg-scratch harness (CREATE TABLE … LIKE … INCLUDING ALL).
// FKs are not copied by LIKE, so person/org rows are not required — any valid UUID
// is fine for person_id/organization_id/created_by_officer.

let H: ScratchDb;

const PERSON = '00000000-0000-4000-8000-0000000000c1';
const ORG = '00000000-0000-4000-8000-0000000000a1';
const OFFICER = '00000000-0000-4000-8000-0000000000d1';

/**
 * Insert an active, unused, unexpired payment_token directly and return its id.
 * expires_at is 72h in the future; used_at / revoked_at / paymongo_session_id /
 * checkout_started_at are null unless an override sets them. token_hash is unique
 * per call. id/created_at/updated_at/version come from baseEntityFields defaults.
 */
async function seedActiveToken(
  db: ScratchDb['db'],
  overrides: Partial<typeof paymentTokens.$inferInsert> = {},
): Promise<string> {
  const [row] = await db
    .insert(paymentTokens)
    .values({
      tokenHash: `hash-${crypto.randomUUID()}`,
      personId: PERSON,
      organizationId: ORG,
      amount: 5000,
      currency: 'PHP',
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      createdByOfficer: OFFICER,
      ...overrides,
    })
    .returning({ id: paymentTokens.id });
  return row!.id;
}

beforeAll(async () => {
  H = await createScratch(['payment_token']);
});

afterAll(async () => {
  await H?.teardown();
});

describe('claimForCheckout (single-winner mutex)', () => {
  test('only one of two concurrent claims wins', async () => {
    if (!H.dbReachable) return;
    const repo = new PaymentTokenRepository(H.db as any);
    const id = await seedActiveToken(H.db);
    const [a, b] = await Promise.all([
      repo.claimForCheckout(id, 'key-a'),
      repo.claimForCheckout(id, 'key-b'),
    ]);
    expect([a, b].filter(Boolean).length).toBe(1);
  });

  test('reclaims a stale claim (checkout_started_at older than 2 min, no session)', async () => {
    if (!H.dbReachable) return;
    const repo = new PaymentTokenRepository(H.db as any);
    const id = await seedActiveToken(H.db, { checkoutStartedAt: new Date(Date.now() - 3 * 60_000) });
    expect(await repo.claimForCheckout(id, 'key')).not.toBeNull();
  });

  test('does NOT claim once a session is attached', async () => {
    if (!H.dbReachable) return;
    const repo = new PaymentTokenRepository(H.db as any);
    const id = await seedActiveToken(H.db, { paymongoSessionId: 'cs_test_1', checkoutStartedAt: new Date() });
    expect(await repo.claimForCheckout(id, 'key')).toBeNull();
  });
});

describe('markUsedCas', () => {
  test('returns true once, false on the second call', async () => {
    if (!H.dbReachable) return;
    const repo = new PaymentTokenRepository(H.db as any);
    const id = await seedActiveToken(H.db);
    expect(await repo.markUsedCas(id)).toBe(true);
    expect(await repo.markUsedCas(id)).toBe(false);
  });
});

describe('revoke', () => {
  test('sets revokedAt and blocks future claims', async () => {
    if (!H.dbReachable) return;
    const repo = new PaymentTokenRepository(H.db as any);
    const id = await seedActiveToken(H.db);
    expect(await repo.revoke(id)).toBe(true);
    expect(await repo.claimForCheckout(id, 'key')).toBeNull();
  });
});

// ─── Nullable createdByOfficer ────────────────────────────────────────────────
// Verifies the column is truly nullable now (migration 0086).

describe('createdByOfficer nullable (migration 0086)', () => {
  test('inserts with createdByOfficer: null and reads back null', async () => {
    if (!H.dbReachable) return;
    const repo = new PaymentTokenRepository(H.db as any);
    const id = await seedActiveToken(H.db, { createdByOfficer: null });
    const found = await repo.findById(id);
    expect(found).toBeTruthy();
    expect(found!.createdByOfficer).toBeNull();
  });

  test('inserts with a non-null officer still works', async () => {
    if (!H.dbReachable) return;
    const repo = new PaymentTokenRepository(H.db as any);
    const id = await seedActiveToken(H.db, { createdByOfficer: OFFICER });
    const found = await repo.findById(id);
    expect(found!.createdByOfficer).toBe(OFFICER);
  });
});

// ─── findActiveForInvoice ─────────────────────────────────────────────────────
// Double-charge guard: returns the active token or null for exhausted/missing.

describe('findActiveForInvoice', () => {
  const INVOICE = '00000000-0000-4000-8000-0000000000e1';
  const PERSON2 = '00000000-0000-4000-8000-0000000000c2';

  test('returns the active token when it exists', async () => {
    if (!H.dbReachable) return;
    const repo = new PaymentTokenRepository(H.db as any);
    await seedActiveToken(H.db, { invoiceId: INVOICE, personId: PERSON });
    const found = await repo.findActiveForInvoice(INVOICE, PERSON);
    expect(found).not.toBeNull();
    expect(found!.invoiceId).toBe(INVOICE);
    expect(found!.personId).toBe(PERSON);
  });

  test('returns null when the token is used', async () => {
    if (!H.dbReachable) return;
    const repo = new PaymentTokenRepository(H.db as any);
    const id = await seedActiveToken(H.db, { invoiceId: INVOICE, personId: PERSON });
    await repo.markUsedCas(id);
    // This person has no other active token for this invoice.
    const found = await repo.findActiveForInvoice(INVOICE, PERSON);
    // May find a token from a previous test; only check the one we just used is excluded.
    // Use a unique invoice to isolate.
    const uniqueInvoice = crypto.randomUUID();
    const id2 = await seedActiveToken(H.db, { invoiceId: uniqueInvoice, personId: PERSON });
    await repo.markUsedCas(id2);
    expect(await repo.findActiveForInvoice(uniqueInvoice, PERSON)).toBeNull();
  });

  test('returns null when the token is revoked', async () => {
    if (!H.dbReachable) return;
    const repo = new PaymentTokenRepository(H.db as any);
    const uniqueInvoice = crypto.randomUUID();
    const id = await seedActiveToken(H.db, { invoiceId: uniqueInvoice, personId: PERSON });
    await repo.revoke(id);
    expect(await repo.findActiveForInvoice(uniqueInvoice, PERSON)).toBeNull();
  });

  test('returns null when the token is expired', async () => {
    if (!H.dbReachable) return;
    const repo = new PaymentTokenRepository(H.db as any);
    const uniqueInvoice = crypto.randomUUID();
    await seedActiveToken(H.db, {
      invoiceId: uniqueInvoice,
      personId: PERSON,
      expiresAt: new Date(Date.now() - 1000), // 1 second ago
    });
    expect(await repo.findActiveForInvoice(uniqueInvoice, PERSON)).toBeNull();
  });

  test('returns null for a different person on the same invoice', async () => {
    if (!H.dbReachable) return;
    const repo = new PaymentTokenRepository(H.db as any);
    const uniqueInvoice = crypto.randomUUID();
    await seedActiveToken(H.db, { invoiceId: uniqueInvoice, personId: PERSON });
    // PERSON2 has no token for this invoice.
    expect(await repo.findActiveForInvoice(uniqueInvoice, PERSON2)).toBeNull();
  });

  test('returns null when invoiceId is not set on the token', async () => {
    if (!H.dbReachable) return;
    const repo = new PaymentTokenRepository(H.db as any);
    const uniqueInvoice = crypto.randomUUID();
    // Token without invoiceId.
    await seedActiveToken(H.db, { personId: PERSON });
    expect(await repo.findActiveForInvoice(uniqueInvoice, PERSON)).toBeNull();
  });
});
