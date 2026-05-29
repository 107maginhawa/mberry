import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PersonRepository } from './repos/person.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { domainEvents } from '@/core/domain-events';
import { requestDataExport } from './requestDataExport';

mock.module('@/utils/audit', () => ({ auditAction: async () => {} }));

// Thenable Drizzle query stub: chain methods return self; awaiting it (or
// calling .limit()) resolves to the provided rows.
function arrChain(result: any[]): any {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => Promise.resolve(result),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

function makeExportDb(recent: any[], payments: any[]) {
  let selectN = 0;
  return {
    select: () => {
      selectN++;
      return arrChain(selectN === 1 ? recent : payments);
    },
    insert: () => ({ values: () => ({ returning: async () => [{ id: 'exp-1' }] }) }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  };
}

describe('requestDataExport', () => {
  beforeEach(() => {
    restoreRepo(PersonRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(CreditEntryRepository);
  });
  afterEach(() => {
    restoreRepo(PersonRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(CreditEntryRepository);
  });

  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(requestDataExport(ctx)).rejects.toThrow('Unauthorized');
  });

  test('rate limits to 1 per 24h (M2-R4)', async () => {
    const ctx = makeCtx({ database: makeExportDb([{ id: 'old', status: 'ready' }], []) });
    const res = await requestDataExport(ctx);
    expect(res.status).toBe(429);
  });

  test('generates export, returns 202, emits data-export.ready', async () => {
    stubRepo(PersonRepository, {
      findOneById: async () => ({ id: 'user-1', firstName: 'Test', lastName: 'User' }),
    });
    stubRepo(MembershipRepository, { findAllByPerson: async () => [] });
    stubRepo(CreditEntryRepository, { findMany: async () => [] });

    const emitSpy = spyOn(domainEvents, 'emit');
    try {
      const ctx = makeCtx({ database: makeExportDb([], []) });
      const res = await requestDataExport(ctx);
      expect(res.status).toBe(202);

      const readyEmit = emitSpy.mock.calls.find((c) => c[0] === 'data-export.ready');
      expect(readyEmit).toBeDefined();
      expect(readyEmit![1]).toMatchObject({ personId: 'user-1', exportId: 'exp-1' });
    } finally {
      emitSpy.mockRestore();
    }
  });
});
