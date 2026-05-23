import { describe, test, expect, mock } from 'bun:test';
import { lookupCredentialPublic } from './lookupCredentialPublic';

function createMockDb(selectResponses: any[][]) {
  let idx = 0;
  return {
    select: (..._args: any[]) => ({
      from: (_table: any) => ({
        where: (_cond: any) => ({
          limit: (_n: number) => Promise.resolve(selectResponses[idx++] ?? []),
        }),
      }),
    }),
  };
}

function makeCtx(credentialNumber: string, db: any) {
  return {
    req: { param: (key: string) => key === 'credentialNumber' ? credentialNumber : '' },
    get: (key: string) => key === 'database' ? db : null,
    json: (body: any, status: number) => ({ status, body }) as any,
  };
}

describe('lookupCredentialPublic', () => {
  test('returns notFound for unknown credential number', async () => {
    const db = createMockDb([[]]);
    const ctx = makeCtx('UNKNOWN-123', db);
    const res = await lookupCredentialPublic(ctx as any) as any;
    expect(res.status).toBe(200);
    expect(res.body.result).toBe('notFound');
    expect(res.body.credential).toBeNull();
  });

  test('returns valid for active credential with trust summary', async () => {
    const db = createMockDb([
      // credential
      [{ credentialNumber: 'DC-001', personId: 'p-1', status: 'active', issuedAt: new Date('2025-01-01'), expiresAt: new Date('2027-01-01') }],
      // directory profile
      [{ displayName: 'Dr. Santos', photoUrl: '/photo.jpg', specialty: 'Orthodontics' }],
      // privacy settings
      [{ duesStatusVisible: true, credentialsVisible: true }],
      // membership
      [{ status: 'active' }],
    ]);
    const ctx = makeCtx('DC-001', db);
    const res = await lookupCredentialPublic(ctx as any) as any;

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('valid');
    expect(res.body.credential.credentialNumber).toBe('DC-001');
    expect(res.body.holder.displayName).toBe('Dr. Santos');
    expect(res.body.holder.membershipStatus).toBe('current');
  });

  test('returns expired for expired credential', async () => {
    const db = createMockDb([
      [{ credentialNumber: 'DC-002', personId: 'p-2', status: 'expired', issuedAt: new Date('2023-01-01'), expiresAt: new Date('2024-01-01') }],
      [{ displayName: 'Dr. Cruz', photoUrl: null, specialty: null }],
      [{ duesStatusVisible: false }],
      [{ status: 'lapsed' }],
    ]);
    const ctx = makeCtx('DC-002', db);
    const res = await lookupCredentialPublic(ctx as any) as any;

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('expired');
    expect(res.body.holder.membershipStatus).toBeNull(); // lapsed = hidden
  });

  test('returns revoked for revoked credential', async () => {
    const db = createMockDb([
      [{ credentialNumber: 'DC-003', personId: 'p-3', status: 'revoked', issuedAt: new Date('2024-01-01'), expiresAt: null }],
      [{ displayName: 'Dr. Reyes', photoUrl: null, specialty: null }],
      [],
      [],
    ]);
    const ctx = makeCtx('DC-003', db);
    const res = await lookupCredentialPublic(ctx as any) as any;

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('revoked');
  });

  test('privacy gates membership status — hidden when duesStatusVisible=false', async () => {
    const db = createMockDb([
      [{ credentialNumber: 'DC-004', personId: 'p-4', status: 'active', issuedAt: new Date(), expiresAt: null }],
      [{ displayName: 'Dr. Lim', photoUrl: null, specialty: null }],
      [{ duesStatusVisible: false }], // privacy: dues hidden
      [{ status: 'active' }], // membership is active but should be hidden
    ]);
    const ctx = makeCtx('DC-004', db);
    const res = await lookupCredentialPublic(ctx as any) as any;

    expect(res.body.result).toBe('valid');
    expect(res.body.holder.membershipStatus).toBeNull(); // hidden due to privacy
  });
});
