/**
 * EF-M11-002: verifyCertificatePublic with HMAC signature verification
 *
 * Tests that the handler accepts an optional `signature` query param
 * and returns `verified: true/false` accordingly.
 */

import { describe, test, expect } from 'bun:test';
import { verifyCertificatePublic } from './verifyCertificatePublic';
import { signCertificateQR } from './utils/certificate-qr';

const CERT_SECRET = 'test-cert-secret';

function buildMockDb(rows: any[] = []) {
  return {
    select: (..._a: any[]) => ({
      from: (_t: any) => ({
        where: (_c: any) => ({
          limit: (_n: number) => Promise.resolve(rows),
        }),
      }),
    }),
  };
}

function createMockCtx(opts: {
  db: any;
  certificateNumber: string;
  signature?: string;
  config?: any;
}) {
  const getMap: Record<string, any> = {
    database: opts.db,
    config: opts.config ?? { certificates: { qrSecret: CERT_SECRET } },
  };
  return {
    get: (key: string) => getMap[key],
    req: {
      param: (key: string) => (key === 'certificateNumber' ? opts.certificateNumber : ''),
      query: (key: string) => (key === 'signature' ? opts.signature : undefined),
    },
    json: (data: any, status?: number) =>
      new Response(JSON.stringify(data), {
        status: status ?? 200,
        headers: { 'content-type': 'application/json' },
      }),
  } as any;
}

describe('verifyCertificatePublic HMAC verification', () => {
  const certRow = {
    certificateNumber: 'PDA-2025-0001',
    issuedAt: '2025-06-15T00:00:00Z',
    status: 'issued',
    creditHours: 8,
    cpdActivityType: 'seminar',
  };

  test('returns verified: true when valid signature is provided', async () => {
    const sig = signCertificateQR('PDA-2025-0001', CERT_SECRET);
    const db = buildMockDb([certRow]);
    const ctx = createMockCtx({ db, certificateNumber: 'PDA-2025-0001', signature: sig });
    const res = await verifyCertificatePublic(ctx);
    const json = await res.json();
    expect(json.data.verified).toBe(true);
  });

  test('returns verified: false when invalid signature is provided', async () => {
    const db = buildMockDb([certRow]);
    const ctx = createMockCtx({ db, certificateNumber: 'PDA-2025-0001', signature: 'badsignaturebad0' });
    const res = await verifyCertificatePublic(ctx);
    const json = await res.json();
    expect(json.data.verified).toBe(false);
  });

  test('returns verified: false when no signature is provided (backward compat)', async () => {
    const db = buildMockDb([certRow]);
    const ctx = createMockCtx({ db, certificateNumber: 'PDA-2025-0001' });
    const res = await verifyCertificatePublic(ctx);
    const json = await res.json();
    expect(json.data.verified).toBe(false);
  });
});
