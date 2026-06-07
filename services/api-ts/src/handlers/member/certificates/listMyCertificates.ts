import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { ListMyCertificatesQuery } from '@/generated/openapi/validators';
import { DigitalCredentialRepository } from '@/handlers/association:member/repos/credentials.repo';

/**
 * listMyCertificates
 *
 * Path: GET /association/member/certificates
 * OperationId: listMyCertificates
 */
export async function listMyCertificates(
  ctx: ValidatedContext<never, ListMyCertificatesQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const personId = session.user.id;
  const query = ctx.req.valid('query');
  const q = query as Record<string, unknown>;

  const repo = new DigitalCredentialRepository(db, logger);
  const certs = await repo.findMany({
    personId,
    organizationId: q['organizationId'] as string | undefined,
    status: q['status'] as string | undefined,
  });

  return ctx.json({ data: certs, total: certs.length }, 200);
}
