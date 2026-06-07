import { describe, test, expect, mock } from 'bun:test';
import { generateCertificates, bulkIssueCertificates } from './bulkIssueCertificates';

const OFFICER_TERM = { positionTitle: 'President' };

function buildMockDb(insertBehavior: 'success' | 'error' = 'success', selectResults: any[][] = []) {
  let selectIdx = 0;
  let insertCallCount = 0;
  const insertSpy = mock((_v: any) => {});
  const makeDbLike = (behavior: 'success' | 'error') => ({
    select: (..._a: any[]) => ({
      from: (_t: any) => {
        const idx = selectIdx++;
        const result = idx < selectResults.length ? selectResults[idx] : [];
        const chain = {
          limit: (_n: number) => Promise.resolve(result),
          then: (r: any, j?: any) => Promise.resolve(result).then(r, j),
        };
        const whereChain = {
          where: (_c: any) => chain,
          limit: (_n: number) => Promise.resolve(result),
          then: (r: any, j?: any) => Promise.resolve(result).then(r, j),
        };
        return {
          ...whereChain,
          innerJoin: (_t2: any, _c2: any) => whereChain,
          leftJoin: (_t2: any, _c2: any) => whereChain,
        };
      },
    }),
    insert: (_t: any) => ({
      values: (v: any) => {
        insertCallCount++;
        insertSpy(v);
        // For 'error' mode: let the first insert (reserveCertificateRange seq) succeed,
        // but fail subsequent inserts (certificate batch insert)
        if (behavior === 'error' && insertCallCount > 1) return Promise.reject(new Error('DB error'));
        return Promise.resolve();
      },
    }),
    execute: mock(() => Promise.resolve({ rows: [] })),
    update: (_t: any) => ({
      set: (_v: any) => ({
        where: (_c: any) => Promise.resolve(),
      }),
    }),
  });
  const db = {
    ...makeDbLike(insertBehavior),
    transaction: async (fn: any) => {
      insertCallCount = 0;
      return fn(makeDbLike(insertBehavior));
    },
  };
  return { db, insertSpy };
}

const validBody = {
  organizationId: 'org-1',
  personIds: ['person-1', 'person-2'],
  trainingTitle: 'CPD Workshop',
  certificateType: 'attendance' as const,
  signingOfficerId: 'officer-1',
  orgCode: 'PDA',
};

describe('generateCertificates', () => {
  test('generates certificates for all personIds', async () => {
    const { db } = buildMockDb();
    const results = await generateCertificates(db as any, validBody, 'user-1');
    expect(results).toHaveLength(2);
    expect(results[0].personId).toBe('person-1');
    expect(results[1].personId).toBe('person-2');
  });

  test('generates certificate numbers with org code prefix', async () => {
    const { db } = buildMockDb();
    const results = await generateCertificates(db as any, validBody, 'user-1');
    expect(results[0].certificateNumber).toStartWith('PDA-');
    expect(results[1].certificateNumber).toStartWith('PDA-');
  });

  test('creates certificate records in DB via insert', async () => {
    const { db, insertSpy } = buildMockDb();
    await generateCertificates(db as any, validBody, 'user-1');
    // 1 insert for reserveCertificateRange (seq row) + 1 batch insert for all certs
    expect(insertSpy).toHaveBeenCalledTimes(2);
  });

  test('returns ERROR certificateNumber on failure', async () => {
    const { db } = buildMockDb('error');
    const results = await generateCertificates(db as any, validBody, 'user-1');
    expect(results).toHaveLength(2);
    expect(results[0].certificateNumber).toBe('ERROR');
    expect(results[1].certificateNumber).toBe('ERROR');
  });
});

describe('bulkIssueCertificates', () => {
  test('throws ValidationError when personIds is empty', async () => {
    const { db } = buildMockDb('success', [[OFFICER_TERM]]);
    const ctx = {
      get: (key: string) => {
        if (key === 'session') return { user: { id: 'user-1' } };
        if (key === 'user') return { id: 'user-1' };
        if (key === 'database') return db;
        if (key === 'organizationId') return 'org-1';
        if (key === 'jobs') return null;
        return null;
      },
      req: {
        param: () => '',
        json: () => Promise.resolve({ ...validBody, personIds: [] }),
      },
      json: (data: any, status?: number) =>
        new Response(JSON.stringify(data), { status: status ?? 200 }),
    } as any;
    await expect(bulkIssueCertificates(ctx)).rejects.toThrow('personIds required');
  });

  test('throws ValidationError when required fields missing', async () => {
    const { db } = buildMockDb('success', [[OFFICER_TERM]]);
    const ctx = {
      get: (key: string) => {
        if (key === 'session') return { user: { id: 'user-1' } };
        if (key === 'user') return { id: 'user-1' };
        if (key === 'database') return db;
        if (key === 'organizationId') return 'org-1';
        if (key === 'jobs') return null;
        return null;
      },
      req: {
        param: () => '',
        json: () => Promise.resolve({ personIds: ['p1'], organizationId: 'org-1' }),
      },
      json: (data: any, status?: number) =>
        new Response(JSON.stringify(data), { status: status ?? 200 }),
    } as any;
    await expect(bulkIssueCertificates(ctx)).rejects.toThrow('trainingTitle, orgCode, signingOfficerId required');
  });
});
