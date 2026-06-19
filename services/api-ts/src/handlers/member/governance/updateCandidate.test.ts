import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { updateCandidate } from './updateCandidate';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { ElectionsRepository } from '@/handlers/elections/repos/elections.repo';
import { NotFoundError, UnauthorizedError } from '@/core/errors';

const existingNominee = { id: 'cand-1', electionId: 'elec-1', status: 'pending', name: 'Jane' };

/** db that returns an existing nominee from select and echoes the update set. */
function makeDb(existing: any = existingNominee) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => (existing ? [existing] : []) }),
      }),
    }),
    update: () => ({
      set: (data: any) => ({
        where: () => ({ returning: async () => [{ ...existing, ...data }] }),
      }),
    }),
  };
}

describe('updateCandidate', () => {
  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(ElectionsRepository);
  });

  test('returns 403 when caller has no officer term', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      database: makeDb(),
      _params: { candidateId: 'cand-1' },
      _body: { status: 'approved' },
    });

    const response = await updateCandidate(ctx);
    expect(response.status).toBe(403);
  });

  test('throws NotFoundError when nominee does not exist', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      database: makeDb(null),
      _params: { candidateId: 'cand-x' },
      _body: { status: 'approved' },
    });

    await expect(updateCandidate(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('updates nominee status via updateNomineeStatus when status present', async () => {
    let capturedStatus: string | null = null;
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
    stubRepo(ElectionsRepository, {
      updateNomineeStatus: async (_id: string, status: string) => {
        capturedStatus = status;
        return { ...existingNominee, status };
      },
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      database: makeDb(),
      _params: { candidateId: 'cand-1' },
      _body: { status: 'approved' },
    });

    const response = await updateCandidate(ctx);
    expect(response.status).toBe(200);
    expect(capturedStatus).toBe('approved');
    expect(response.body.status).toBe('approved');
    const auditEvents = ctx.get('auditEvents') as any[];
    expect(auditEvents[0].action).toBe('update');
    expect(auditEvents[0].resource).toBe('cand-1');
  });

  test('performs a generic field update when no status in body', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
    stubRepo(ElectionsRepository, {
      updateNomineeStatus: async () => { throw new Error('should not be called'); },
    });

    const ctx = makeCtx({
      organizationId: 'org-1',
      database: makeDb(),
      _params: { candidateId: 'cand-1' },
      _body: { name: 'Jane Doe' },
    });

    const response = await updateCandidate(ctx);
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Jane Doe');
    const auditEvents = ctx.get('auditEvents') as any[];
    expect(auditEvents[0].description).toBe('Nominee updated');
  });
});
