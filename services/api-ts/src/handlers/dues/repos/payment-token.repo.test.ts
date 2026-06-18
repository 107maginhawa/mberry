// Unit suite for PaymentTokenRepository — one-tap payment-link tokens.
// Verifies create returns the inserted row, markUsed stamps usedAt, and the
// hash-lookup paths return the stored row (or undefined when absent).
// Uses a small stateful fake DB that models the drizzle insert/select/update
// chains the repo issues (no real Postgres in unit tests — same convention as
// the rest of the handler test suite).

import { describe, test, expect } from 'bun:test';
import { PaymentTokenRepository } from './payment-token.repo';
import { paymentTokens } from './payment-token.schema';

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
