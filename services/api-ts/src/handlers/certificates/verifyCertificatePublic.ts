import type { Context } from 'hono';
import { eq } from 'drizzle-orm';
import { NotFoundError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { certificates } from './repos/certificates.schema';
import { persons } from '../person/repos/person.schema';

export async function verifyCertificatePublic(ctx: Context): Promise<Response> {
  const certificateNumber = ctx.req.param('certificateNumber')!;
  const db = ctx.get('database') as DatabaseInstance;
  const results = await db.select({ certificateNumber: certificates.certificateNumber, issuedAt: certificates.issuedAt, status: certificates.status, creditHours: certificates.creditHours, cpdActivityType: certificates.cpdActivityType, firstName: persons.firstName, lastName: persons.lastName }).from(certificates).leftJoin(persons, eq(certificates.personId, persons.id)).where(eq(certificates.certificateNumber, certificateNumber)).limit(1);
  const cert = results[0];
  if (!cert) throw new NotFoundError('Certificate not found');
  return ctx.json({ data: { certificateNumber: cert.certificateNumber, holderName: [cert.firstName, cert.lastName].filter(Boolean).join(' ') || 'Unknown', issuedAt: cert.issuedAt, status: cert.status ?? 'issued', creditHours: cert.creditHours, cpdActivityType: cert.cpdActivityType, isValid: cert.status !== 'revoked' } });
}
