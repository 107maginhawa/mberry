/**
 * createAdvertiser
 *
 * Path: POST /association/advertising/advertisers
 * OperationId: createAdvertiser
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError } from '@/core/errors';
import { AdvertiserRepository } from './repos/advertiser.repo';

export async function createAdvertiser(ctx: ValidatedContext<any, never, never>): Promise<Response> {
  const user = ctx.get('user') as User;
  if (!user?.id) throw new ValidationError('Valid user ID required');

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'advertising' }) ?? baseLogger;
  const organizationId = ctx.get('organizationId') as string;

  if (!body.companyName?.trim()) throw new ValidationError('Company name is required');
  if (!body.contactEmail?.trim()) throw new ValidationError('Contact email is required');

  const repo = new AdvertiserRepository(db, logger);

  const advertiser = await repo.createOne({
    organizationId,
    companyName: body.companyName.trim(),
    contactEmail: body.contactEmail.trim(),
    contactPersonId: body.contactPersonId ?? null,
    isActive: true,
    createdBy: user.id,
  });

  logger?.info({ advertiserId: advertiser.id, action: 'create_advertiser' }, 'Advertiser created');

  return ctx.json(advertiser, 201);
}
