import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { PreviewMessageTemplateBody, PreviewMessageTemplateParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { MessageTemplateRepository } from './repos/communication.repo';

/**
 * previewMessageTemplate
 *
 * Path: POST /association/message-templates/{templateId}/preview
 * OperationId: previewMessageTemplate
 *
 * Renders Handlebars-style merge fields in subject and body using provided mergeData.
 */
export async function previewMessageTemplate(
  ctx: ValidatedContext<PreviewMessageTemplateBody, never, PreviewMessageTemplateParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MessageTemplateRepository(db, logger);

  const template = await repo.findById(params.templateId);
  if (!template || template.organizationId !== orgId) {
    throw new NotFoundError('Message template not found');
  }

  const mergeData = body.mergeData as Record<string, unknown>;

  // Simple Handlebars-style merge field replacement: {{fieldName}} -> value
  const renderMergeFields = (text: string): string => {
    return text.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
      return mergeData[key] !== undefined ? String(mergeData[key]) : `{{${key}}}`;
    });
  };

  const renderedSubject = template.subject ? renderMergeFields(template.subject) : undefined;
  const renderedBody = renderMergeFields(template.body);

  return ctx.json({ subject: renderedSubject, body: renderedBody }, 200);
}
