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
