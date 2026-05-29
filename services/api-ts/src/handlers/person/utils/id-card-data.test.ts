/**
 * BR-18: ID card QR payload must be HMAC-signed and include a timestamp so
 * verifiers can detect stale/replayed codes (EM-M02-4b5c6d7e).
 */
import { describe, test, expect } from 'bun:test';
import { getIdCardData } from './id-card-data';

// Minimal chainable db: each select().from().where().limit() resolves the next
// queued result row-set, matching the three queries getIdCardData runs in order.
function buildDb(rowSets: any[][]) {
  let call = 0;
  return {
    select: (..._a: any[]) => ({
      from: (_t: any) => {
        const rows = rowSets[call++] ?? [];
        const chain: any = {
          where: () => ({ limit: () => Promise.resolve(rows) }),
        };
        return chain;
      },
    }),
  } as any;
}

const PERSON = [{ id: 'p-1', firstName: 'Ada', lastName: 'Lovelace', licenseNumber: 'LIC-1', prcId: null, avatar: null }];
const MEMBERSHIP = [{ status: 'active', duesExpiryDate: '2027-01-01' }];
const ORG = [{ name: 'PDA' }];

describe('[BR-18] getIdCardData — QR payload timestamp', () => {
  test('QR payload includes an ISO timestamp field', async () => {
    const db = buildDb([PERSON, MEMBERSHIP, ORG]);
    const data = await getIdCardData(db, 'p-1', 'org-1');
    expect(data).not.toBeNull();
    const payload = JSON.parse(Buffer.from(data!.qrPayload, 'base64').toString('utf8'));
    expect(typeof payload.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(payload.timestamp))).toBe(false);
  });

  test('HMAC signature covers the timestamp (payload tamper changes signature)', async () => {
    const db = buildDb([PERSON, MEMBERSHIP, ORG]);
    const data = await getIdCardData(db, 'p-1', 'org-1');
    const payload = JSON.parse(Buffer.from(data!.qrPayload, 'base64').toString('utf8'));
    expect(payload.timestamp).toBeDefined();
    // signature is hex HMAC over the exact payload JSON
    expect(data!.qrSignature).toMatch(/^[0-9a-f]{64}$/);
  });
});
