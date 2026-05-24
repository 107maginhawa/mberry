import { describe, test, expect, mock } from 'bun:test';
import { verifyCertificatePublic } from './verifyCertificatePublic';

function buildMockDb(selectResponses: any[][] = []) {
  let selectIdx = 0;
  const db = {
    select: (..._a: any[]) => ({
      from: (_t: any) => {
        const idx = selectIdx++;
        const result = idx < selectResponses.length ? selectResponses[idx] : [];
        return {
          leftJoin: (_t2: any, _c2: any) => ({
            where: (_c: any) => ({
              limit: (_n: number) => Promise.resolve(result),
              then: (r: any, j?: any) => Promise.resolve(result).then(r, j),
            }),
          }),
          where: (_c: any) => ({
            limit: (_n: number) => Promise.resolve(result),
            then: (r: any, j?: any) => Promise.resolve(result).then(r, j),
          }),
        };
      },
    }),
  };
  return { db };
}

function createMockCtx(overrides: {
  database?: any;
  params?: Record<string, string>;
}) {
  const getMap: Record<string, any> = {
    database: overrides.database,
  };
  return {
    get: (key: string) => getMap[key],
    req: {
      param: (key: string) => overrides.params?.[key] ?? '',
      query: (_key: string) => undefined,
      json: () => Promise.resolve({}),
    },
    json: (data: any, status?: number) =>
      new Response(JSON.stringify(data), {
        status: status ?? 200,
        headers: { 'content-type': 'application/json' },
      }),
  } as any;
}

describe('verifyCertificatePublic', () => {
  test('returns certificate details for valid number', async () => {
    const { db } = buildMockDb([
      [
        {
          certificateNumber: 'PDA-2025-0001',
          issuedAt: '2025-06-15T00:00:00Z',
          status: 'issued',
          creditHours: 8,
          cpdActivityType: 'seminar',
          firstName: 'Juan',
          lastName: 'Cruz',
        },
      ],
    ]);
    const ctx = createMockCtx({
      database: db,
      params: { certificateNumber: 'PDA-2025-0001' },
    });
    const res = await verifyCertificatePublic(ctx);
    const json = await res.json();
    expect(json.data.certificateNumber).toBe('PDA-2025-0001');
    expect(json.data.holderName).toBe('Juan Cruz');
    expect(json.data.isValid).toBe(true);
    expect(json.data.creditHours).toBe(8);
  });

  test('throws NotFoundError for invalid certificate number', async () => {
    const { db } = buildMockDb([[]]);
    const ctx = createMockCtx({
      database: db,
      params: { certificateNumber: 'INVALID-0000' },
    });
    await expect(verifyCertificatePublic(ctx)).rejects.toThrow('Certificate not found');
  });

  test('shows REVOKED status with isValid=false', async () => {
    const { db } = buildMockDb([
      [
        {
          certificateNumber: 'PDA-2025-0002',
          issuedAt: '2025-06-15T00:00:00Z',
          status: 'revoked',
          creditHours: 4,
          cpdActivityType: 'lecture',
          firstName: 'Maria',
          lastName: 'Santos',
        },
      ],
    ]);
    const ctx = createMockCtx({
      database: db,
      params: { certificateNumber: 'PDA-2025-0002' },
    });
    const res = await verifyCertificatePublic(ctx);
    const json = await res.json();
    expect(json.data.status).toBe('revoked');
    expect(json.data.isValid).toBe(false);
  });

  test('does not expose PII (no email, no memberId)', async () => {
    const { db } = buildMockDb([
      [
        {
          certificateNumber: 'PDA-2025-0003',
          issuedAt: '2025-06-15T00:00:00Z',
          status: 'issued',
          creditHours: 2,
          cpdActivityType: 'workshop',
          firstName: 'Ana',
          lastName: 'Reyes',
        },
      ],
    ]);
    const ctx = createMockCtx({
      database: db,
      params: { certificateNumber: 'PDA-2025-0003' },
    });
    const res = await verifyCertificatePublic(ctx);
    const json = await res.json();
    expect(json.data.email).toBeUndefined();
    expect(json.data.memberId).toBeUndefined();
    expect(json.data.personId).toBeUndefined();
  });

  test('constructs holderName from firstName + lastName', async () => {
    const { db } = buildMockDb([
      [
        {
          certificateNumber: 'PDA-2025-0004',
          issuedAt: '2025-06-15T00:00:00Z',
          status: 'issued',
          creditHours: 3,
          cpdActivityType: null,
          firstName: null,
          lastName: 'Garcia',
        },
      ],
    ]);
    const ctx = createMockCtx({
      database: db,
      params: { certificateNumber: 'PDA-2025-0004' },
    });
    const res = await verifyCertificatePublic(ctx);
    const json = await res.json();
    expect(json.data.holderName).toBe('Garcia');
  });
});
