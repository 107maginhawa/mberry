import type { Context } from 'hono';
import { eq } from 'drizzle-orm';
import { NotFoundError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { certificates } from './repos/certificates.schema';
import { verifyCertificateQR } from './utils/certificate-qr';
import { domainEvents } from '@/core/domain-events';

export async function verifyCertificatePublic(ctx: Context): Promise<Response> {
  const certificateNumber = ctx.req.param('certificateNumber')!;
  const signature = ctx.req.query('signature');
  const db = ctx.get('database') as DatabaseInstance;
  const config = ctx.get('config') as { certificates?: { qrSecret?: string } };
  const results = await db.select({ certificateNumber: certificates.certificateNumber, issuedAt: certificates.issuedAt, status: certificates.status, creditHours: certificates.creditHours, cpdActivityType: certificates.cpdActivityType }).from(certificates).where(eq(certificates.certificateNumber, certificateNumber)).limit(1);
  const cert = results[0];
  if (!cert) throw new NotFoundError('Certificate not found');

  // EF-M11-002: HMAC QR signature verification
  // If a signature is provided, verify it against the certificate number.
  // If no signature, return verified: false (backward compatible).
  const qrSecret = config?.certificates?.qrSecret || process.env['CERTIFICATE_QR_SECRET'] || '';
  let verified = false;
  if (signature && qrSecret) {
    verified = verifyCertificateQR(certificateNumber, signature, qrSecret);
  }

  // EM-M11-d1e34f90: emit VerificationRequested domain event.
  domainEvents.emit('verification.requested', {
    credentialNumber: cert.certificateNumber,
    verified,
  }).catch(() => {});

  return ctx.json({ data: { certificateNumber: cert.certificateNumber, issuedAt: cert.issuedAt, status: cert.status ?? 'issued', creditHours: cert.creditHours, cpdActivityType: cert.cpdActivityType, isValid: cert.status !== 'revoked', verified } });
}
