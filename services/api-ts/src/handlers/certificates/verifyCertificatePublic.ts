import type { Context } from 'hono';
import { eq } from 'drizzle-orm';
import { NotFoundError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { certificates } from './repos/certificates.schema';

export async function verifyCertificatePublic(ctx: Context): Promise<Response> {
  const certificateNumber = ctx.req.param('certificateNumber')!;
  const db = ctx.get('database') as DatabaseInstance;
  const results = await db.select({ certificateNumber: certificates.certificateNumber, issuedAt: certificates.issuedAt, status: certificates.status, creditHours: certificates.creditHours, cpdActivityType: certificates.cpdActivityType }).from(certificates).where(eq(certificates.certificateNumber, certificateNumber)).limit(1);
  const cert = results[0];
  if (!cert) throw new NotFoundError('Certificate not found');
  return ctx.json({ data: { certificateNumber: cert.certificateNumber, issuedAt: cert.issuedAt, status: cert.status ?? 'issued', creditHours: cert.creditHours, cpdActivityType: cert.cpdActivityType, isValid: cert.status !== 'revoked' } });
}
