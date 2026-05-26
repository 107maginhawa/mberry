import type { Context } from 'hono';
import { NotFoundError, ForbiddenError, UnauthorizedError } from '@/core/errors';
import { CertificatesRepository } from './repos/certificates.repo';

export async function getCertificate(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const id = ctx.req.param('id')!;
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError();

  const repo = new CertificatesRepository(db);
  const cert = await repo.get(id);
  if (!cert) throw new NotFoundError('Certificate not found');

  // P1: IDOR prevention — only the certificate owner or same-org officer can access
  const orgId = ctx.get('organizationId');
  if (cert.personId !== user.id && cert.organizationId !== orgId) {
    throw new ForbiddenError('Access denied');
  }

  return ctx.json({ data: cert }, 200);
}
