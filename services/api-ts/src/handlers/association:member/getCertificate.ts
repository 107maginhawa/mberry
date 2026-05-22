import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import type { GetCertificateParams } from '@/generated/openapi/validators';
import { DigitalCredentialRepository } from './repos/credentials.repo';

/**
 * getCertificate
 *
 * Path: GET /association/member/certificates/{certificateId}
 * OperationId: getCertificate
 */
export async function getCertificate(
  ctx: ValidatedContext<never, never, GetCertificateParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const params = ctx.req.valid('param');
  const { certificateId } = params as { certificateId: string };
  const personId = session.user.id;

  const repo = new DigitalCredentialRepository(db, logger);
  const cert = await repo.findOneById(certificateId);

  if (!cert) throw new NotFoundError('Certificate not found');

  // Owner-scoped: member can only access their own certificates
  if (cert.personId !== personId) throw new ForbiddenError('Access denied');

  return ctx.json(cert, 200);
}
