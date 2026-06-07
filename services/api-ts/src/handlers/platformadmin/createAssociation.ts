import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateAssociationBody } from '@/generated/openapi/validators';
import { ConflictError } from '@/core/errors';
import { AssociationRepository } from './repos/platform-admin.repo';
import { domainEvents } from '@/core/domain-events';

/**
 * createAssociation
 *
 * Path: POST /admin/associations
 * OperationId: createAssociation
 */
export async function createAssociation(
  ctx: ValidatedContext<CreateAssociationBody, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  // P0: Only super admins can create associations
  const callerAdmin = ctx.get('platformAdmin') as { role: string } | undefined;
  if (!callerAdmin || callerAdmin.role !== 'super') {
    return ctx.json({ error: 'Super admin access required' }, 403);
  }

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new AssociationRepository(db, logger);

  const existing = await repo.findByName(body.name);
  if (existing) {
    throw new ConflictError('Association with this name already exists');
  }

  const association = await repo.create({
    name: body.name,
    country: body.country,
    currency: body.currency,
    locale: body.locale ?? 'en',
    licenseFormatRegex: body.licenseFormatRegex ?? null,
    creditCyclePeriod: body.creditCyclePeriod ?? null,
    requiredCreditsPerCycle: body.requiredCreditsPerCycle ?? null,
    carryoverEnabled: body.carryoverEnabled ?? false,
  });

  ctx.set('auditResourceId', association.id);
  ctx.set('auditDescription', `Association "${association.name}" created`);

  // [EM-M03-d1e2f3a4] Emit spec-declared AssociationCreated event.
  domainEvents
    .emit('association.created', { associationId: association.id, name: association.name })
    .catch(() => {});

  return ctx.json(association, 201);
}