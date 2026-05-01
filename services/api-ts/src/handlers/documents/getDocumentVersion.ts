import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetDocumentVersionParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DocumentVersionRepository } from './repos/documents.repo';

/**
 * getDocumentVersion
 *
 * Path: GET /association/documents/{documentId}/versions/{versionId}
 * OperationId: getDocumentVersion
 */
export async function getDocumentVersion(
  ctx: ValidatedContext<never, never, GetDocumentVersionParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DocumentVersionRepository(db, ctx.get('logger'));

  const version = await repo.findOneById((params as any).versionId);
  if (!version || version.documentId !== (params as any).documentId) {
    throw new NotFoundError('Document version');
  }

  return ctx.json(version, 200);
}
