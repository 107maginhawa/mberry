import type { Context } from 'hono';
import { NotFoundError, ForbiddenError } from '@/core/errors';
import { CertificatesRepository } from './repos/certificates.repo';

export async function getCertificate(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const id = ctx.req.param('id')!;
  const user = ctx.get('user');
  const repo = new CertificatesRepository(db);
  const cert = await repo.get(id);
  if (!cert) throw new NotFoundError('Certificate not found');

  // IDOR prevention: only the certificate owner can access it
  if (user && cert.personId !== user.id) {
    throw new ForbiddenError('Access denied');
  }

  return ctx.json({ data: cert }, 200);
}
