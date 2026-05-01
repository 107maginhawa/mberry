import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateDocumentBody } from '@/generated/openapi/validators';
import { UnauthorizedError } from '@/core/errors';
import { DocumentRepository } from './repos/documents.repo';
import { auditAction } from '@/utils/audit';

/**
 * createDocument
 *
 * Path: POST /association/documents
 * OperationId: createDocument
 */
export async function createDocument(
  ctx: ValidatedContext<CreateDocumentBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const tenantId = ctx.get('tenantId');
  if (!tenantId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new DocumentRepository(db, logger);

  const document = await repo.createOne({
    tenantId,
    title: body.title,
    fileName: body.fileName,
    mimeType: body.mimeType,
    size: body.size,
    storageKey: body.storageKey,
    ownerId: body.ownerId,
    ownerType: body.ownerType,
    accessLevel: body.accessLevel,
    category: body.category ?? null,
    tags: body.tags ?? [],
    status: 'published',
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'document',
    resourceId: document.id,
    description: `Document "${body.title}" created`,
  });

  return ctx.json(document, 201);
}
