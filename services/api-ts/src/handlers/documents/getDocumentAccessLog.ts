import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetDocumentAccessLogQuery, GetDocumentAccessLogParams } from '@/generated/openapi/validators';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DocumentRepository, DocumentAccessLogRepository } from './repos/documents.repo';

/**
 * getDocumentAccessLog
 *
 * Path: GET /association/documents/{documentId}/access-log
 * OperationId: getDocumentAccessLog
 *
 * Returns access log entries for a document. Also logs the access itself (meta-logging).
 */
export async function getDocumentAccessLog(
  ctx: ValidatedContext<never, GetDocumentAccessLogQuery, GetDocumentAccessLogParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const params = ctx.req.valid('param');
  const query = ctx.req.valid('query');
  const offset = Number(query.offset ?? 0);
  const limit = Number(query.limit ?? 20);

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const documentId = (params as any).documentId;

  // Verify document exists
  const docRepo = new DocumentRepository(db, logger);
  const document = await docRepo.findOneById(documentId);
  if (!document) throw new NotFoundError('Document');

  const accessLogRepo = new DocumentAccessLogRepository(db, logger);

  // Meta-logging: log this access log view itself
  try {
    await accessLogRepo.createOne({
      documentId,
      personId: user.id,
      action: 'view_access_log',
      accessedAt: new Date(),
      ipAddress: ctx.req.header('x-forwarded-for') || ctx.req.header('x-real-ip') || null,
    });
  } catch {
    // Non-critical: don't fail the request if meta-logging fails
    logger?.warn({ documentId }, 'Failed to record access log view');
  }

  const result = await accessLogRepo.findManyWithPagination(
    { documentId },
    { pagination: { offset, limit } },
  );

  const totalPages = Math.ceil(result.totalCount / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return ctx.json({
    data: result.data.map(entry => ({
      accessedBy: entry.personId,
      accessedAt: entry.accessedAt.toISOString(),
      action: entry.action,
      ipAddress: entry.ipAddress ?? undefined,
    })),
    pagination: {
      offset,
      limit,
      count: result.data.length,
      totalCount: result.totalCount,
      totalPages,
      currentPage,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    },
  }, 200);
}
