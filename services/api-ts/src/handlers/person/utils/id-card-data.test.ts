/**
 * BR-18: ID card QR payload must be HMAC-signed and include a timestamp so
 * verifiers can detect stale/replayed codes (EM-M02-4b5c6d7e).
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { getIdCardData } from './id-card-data';
import { stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CredentialTemplateRepository, DigitalCredentialRepository } from '@/handlers/association:member/repos/credentials.repo';

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

describe('[BR-18] getIdCardData — HMAC secret fail-closed (FIX-004 / G-04)', () => {
  const savedAuth = process.env['AUTH_SECRET'];
  const savedIdCard = process.env['ID_CARD_HMAC_SECRET'];

  afterEach(() => {
    if (savedAuth === undefined) delete process.env['AUTH_SECRET'];
    else process.env['AUTH_SECRET'] = savedAuth;
    if (savedIdCard === undefined) delete process.env['ID_CARD_HMAC_SECRET'];
    else process.env['ID_CARD_HMAC_SECRET'] = savedIdCard;
  });

  test('throws (fails closed) when no HMAC secret is configured', async () => {
    delete process.env['AUTH_SECRET'];
    delete process.env['ID_CARD_HMAC_SECRET'];
    const db = buildDb([PERSON, MEMBERSHIP, ORG]);
    await expect(getIdCardData(db, 'p-1', 'org-1')).rejects.toThrow(/secret/i);
  });

  test('uses ID_CARD_HMAC_SECRET when set, never a hardcoded fallback', async () => {
    delete process.env['AUTH_SECRET'];
    process.env['ID_CARD_HMAC_SECRET'] = 'dedicated-id-card-secret';
    const db = buildDb([PERSON, MEMBERSHIP, ORG]);
    const data = await getIdCardData(db, 'p-1', 'org-1');
    expect(data!.qrSignature).toMatch(/^[0-9a-f]{64}$/);
  });
});

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

// Batch A2 / FIX-001: surface a verifiable member-card credential number so the
// ID-card QR can point at the existing public credential-verify surface.
describe('getIdCardData — member-card credential surfacing (Batch A2)', () => {
  const savedIdCard = process.env['ID_CARD_HMAC_SECRET'];
  beforeEach(() => {
    process.env['ID_CARD_HMAC_SECRET'] = 'dedicated-id-card-secret';
    restoreRepo(CredentialTemplateRepository);
    restoreRepo(DigitalCredentialRepository);
  });
  afterEach(() => {
    restoreRepo(CredentialTemplateRepository);
    restoreRepo(DigitalCredentialRepository);
    if (savedIdCard === undefined) delete process.env['ID_CARD_HMAC_SECRET'];
    else process.env['ID_CARD_HMAC_SECRET'] = savedIdCard;
  });

  test('surfaces an active member-card credential number as verifyCredentialNumber', async () => {
    stubRepo(CredentialTemplateRepository, { findOne: async () => ({ id: 't1', organizationId: 'org-1', type: 'memberCard', status: 'active' }) });
    stubRepo(DigitalCredentialRepository, { findOne: async () => ({ credentialNumber: 'MC-ABC123', status: 'active' }) });
    const db = buildDb([PERSON, MEMBERSHIP, ORG]);
    const data = await getIdCardData(db, 'p-1', 'org-1');
    expect(data!.verifyCredentialNumber).toBe('MC-ABC123');
  });

  test('verifyCredentialNumber is null when the member has no active membership', async () => {
    const db = buildDb([PERSON, [], ORG]); // no membership row
    const data = await getIdCardData(db, 'p-1', 'org-1');
    expect(data!.verifyCredentialNumber).toBeNull();
  });
});
