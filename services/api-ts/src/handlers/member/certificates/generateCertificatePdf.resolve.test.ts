/**
 * FIX-005 (G5) — server-side certificate data resolution + verify QR.
 *
 * Proves the certificate PDF is built from DB-resolved identity (recipient,
 * training, org, type, credits) and a signed verify URL — NOT from a client
 * body override. `resolveCertificatePdfData` takes no request body, so the
 * forgery surface (client-controlled identity on a genuinely-numbered cert)
 * is structurally closed.
 */

import { describe, test, expect } from 'bun:test';
import { resolveCertificatePdfData } from './generateCertificatePdf';
import { signCertificateQR } from './utils/certificate-qr';
import { persons } from '@/handlers/person/repos/person.schema';
import { organizations } from '@/handlers/platformadmin/repos/platform-admin.schema';
import { trainings } from '@/handlers/association:operations/repos/training.schema';

const SECRET = 'test-cert-secret';

function buildResolveDb(opts: { person?: any; org?: any; training?: any }) {
  return {
    select: (_fields?: any) => ({
      from: (table: any) => {
        const rows =
          table === persons ? (opts.person ? [opts.person] : [])
          : table === organizations ? (opts.org ? [opts.org] : [])
          : table === trainings ? (opts.training ? [opts.training] : [])
          : [];
        return { where: (_c: any) => ({ limit: (_n: number) => Promise.resolve(rows) }) };
      },
    }),
  } as any;
}

function fakeCert(overrides: any = {}) {
  return {
    id: 'cert-1',
    personId: 'person-1',
    organizationId: 'org-1',
    trainingId: 'training-1',
    certificateNumber: 'PDA-2026-0001',
    issuedAt: new Date('2026-03-15'),
    certificateType: 'completion',
    creditHours: 8,
    cpdActivityType: 'seminar',
    ...overrides,
  };
}

describe('resolveCertificatePdfData — server-resolved identity', () => {
  test('resolves recipient name from the person record, not a client value', async () => {
    const db = buildResolveDb({
      person: { firstName: 'Maria', lastName: 'Santos' },
      org: { name: 'Philippine Dental Association' },
      training: { title: 'Advanced Implants' },
    });
    const { templateData } = await resolveCertificatePdfData(db, fakeCert(), 'IGNORED-FALLBACK', SECRET);
    expect(templateData.recipientName).toBe('Maria Santos');
  });

  test('resolves org name and training title from the DB', async () => {
    const db = buildResolveDb({
      person: { firstName: 'Maria', lastName: 'Santos' },
      org: { name: 'PDA' },
      training: { title: 'Advanced Implants' },
    });
    const { templateData } = await resolveCertificatePdfData(db, fakeCert(), 'Member', SECRET);
    expect(templateData.organizationName).toBe('PDA');
    expect(templateData.trainingTitle).toBe('Advanced Implants');
  });

  test('uses certificateType + credits from the cert record', async () => {
    const db = buildResolveDb({ person: { firstName: 'A', lastName: 'B' }, org: { name: 'O' }, training: { title: 'T' } });
    const { templateData } = await resolveCertificatePdfData(db, fakeCert(), 'Member', SECRET);
    expect(templateData.certificateType).toBe('completion');
    expect(templateData.creditAmount).toBe(8);
    expect(templateData.creditCategory).toBe('seminar');
  });

  test('falls back to a neutral training title when trainingId is NULL (unlinked cert)', async () => {
    const db = buildResolveDb({ person: { firstName: 'A', lastName: 'B' }, org: { name: 'O' } });
    const { templateData } = await resolveCertificatePdfData(db, fakeCert({ trainingId: null }), 'Member', SECRET);
    expect(templateData.trainingTitle).toBe('Training Activity');
  });

  test('clamps an unknown stored certificateType to a valid label', async () => {
    const db = buildResolveDb({ person: { firstName: 'A', lastName: 'B' }, org: { name: 'O' }, training: { title: 'T' } });
    const { templateData } = await resolveCertificatePdfData(db, fakeCert({ certificateType: 'garbage' }), 'Member', SECRET);
    expect(['attendance', 'completion', 'speaker']).toContain(templateData.certificateType);
  });

  test('builds a signed verify URL embedding the certificate-qr HMAC', async () => {
    const db = buildResolveDb({ person: { firstName: 'A', lastName: 'B' }, org: { name: 'O' }, training: { title: 'T' } });
    const { verifyUrl } = await resolveCertificatePdfData(db, fakeCert(), 'Member', SECRET);
    const sig = signCertificateQR('PDA-2026-0001', SECRET);
    expect(verifyUrl).toBe(`https://memberry.app/verify/PDA-2026-0001?signature=${sig}`);
  });

  test('omits the verify URL when no QR secret is configured (no unsigned/forgeable QR)', async () => {
    const db = buildResolveDb({ person: { firstName: 'A', lastName: 'B' }, org: { name: 'O' }, training: { title: 'T' } });
    const { verifyUrl } = await resolveCertificatePdfData(db, fakeCert(), 'Member', '');
    expect(verifyUrl).toBeNull();
  });
});
