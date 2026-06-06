import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { CreateElectionBody } from '@/generated/openapi/validators';
import { ElectionsRepository } from '../elections/repos/elections.repo';
import type { NewElection } from '../elections/repos/elections.schema';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
import { domainEvents } from '@/core/domain-events';

/**
 * createElection
 *
 * Path: POST /association/member/elections
 * OperationId: createElection
 */
export async function createElection(
  ctx: ValidatedContext<CreateElectionBody, never, never>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError();

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ElectionsRepository(db);

  // Convert position strings to {id, title, sortOrder} objects for JSONB storage
  const positionObjects = (body.positions ?? []).map((p: string, i: number) => ({
    id: crypto.randomUUID(),
    title: p,
    sortOrder: i,
  }));

  // Explicit field mapping (TypeSpec request fields now match schema columns)
  const election = await repo.create({
    organizationId: orgId,
    title: body.title,
    type: body.type,
    status: 'draft',
    votingMode: body.votingMode ?? 'online',
    nominationsOpenAt: body.nominationsOpenAt ?? null,
    nominationsCloseAt: body.nominationsCloseAt ?? null,
    votingOpenAt: body.votingOpenAt ?? null,
    votingCloseAt: body.votingCloseAt ?? null,
    passageThreshold: body.passageThreshold ?? null,
    positions: positionObjects,
    createdBy: user.id,
    updatedBy: user.id,
  } as NewElection);

  ctx.set('auditResourceId', election.id);
  ctx.set('auditDescription', `Election created: ${election.title}`);

  domainEvents.emit('election.created', {
    electionId: election.id,
    organizationId: orgId,
    createdBy: user.id,
  }).catch(() => {});

  return ctx.json({ data: election }, 201);
}
