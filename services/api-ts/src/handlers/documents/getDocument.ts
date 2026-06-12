import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetDocumentParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { DocumentRepository, DocumentAccessLogRepository } from './repos/documents.repo';

/**
 * getDocument
 *
 * Path: GET /association/documents/{documentId}
 * OperationId: getDocument
 */
export async function getDocument(
  ctx: ValidatedContext<never, never, GetDocumentParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DocumentRepository(db, ctx.get('logger'));

  const document = await repo.findOneById(params.documentId);
  if (!document) throw new NotFoundError('Document');

  // P0-01: Org-scope check to prevent IDOR
  const orgId = ctx.get('organizationId');
  if (document.organizationId !== orgId) {
    throw new ForbiddenError('Access denied to this document');
  }

  ctx.set('auditResourceId', params.documentId);
  ctx.set('auditDescription', `Document accessed: ${document.title ?? params.documentId}`);

  // FIX-003 (M11-R5 / AC-M11-005): persist a module-owned access-log row for
  // every view so the officer-facing access-log UI/API has real data.
  // Best-effort: a logging failure must never break the document view.
  try {
    const accessLogRepo = new DocumentAccessLogRepository(db, ctx.get('logger'));
    await accessLogRepo.createOne({
      documentId: params.documentId,
      personId: session.user.id,
      action: 'view',
      accessedAt: new Date(),
      ipAddress: ctx.req.header('x-forwarded-for') || ctx.req.header('x-real-ip') || null,
      organizationId: document.organizationId,
    });
  } catch {
    ctx.get('logger')?.warn?.(
      { action: 'getDocument.accessLog', documentId: params.documentId },
      'Failed to record document view access log',
    );
  }

  return ctx.json(document, 200);
}
