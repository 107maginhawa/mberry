import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateDocumentTagBody } from '@/generated/openapi/validators';
import { UnauthorizedError } from '@/core/errors';
import { DocumentTagRepository } from './repos/documents.repo';
import { auditAction } from '@/utils/audit';

/**
 * createDocumentTag
 *
 * Path: POST /association/document-tags
 * OperationId: createDocumentTag
 */
export async function createDocumentTag(
  ctx: ValidatedContext<CreateDocumentTagBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new DocumentTagRepository(db, logger);

  const tag = await repo.createOne({
    orgId,
    name: body.name,
    color: body.color ?? null,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'document-tag',
    resourceId: tag.id,
    description: `Document tag "${body.name}" created`,
  });

  return ctx.json(tag, 201);
}
