import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { updateCandidateStatus } from './updateCandidateStatus';
import { ElectionsRepository } from '@/handlers/elections/repos/elections.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { UnauthorizedError, NotFoundError, ForbiddenError, BusinessLogicError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────

const fakeElection = {
  id: 'election-1',
  organizationId: 'tenant-1',
  status: 'open',
  title: 'Annual Election',
  type: 'officer',
  nominationsOpenAt: new Date('2026-01-01'),
  nominationsCloseAt: new Date('2026-12-31'),
};

const fakeNominee = {
  id: 'nominee-1',
  electionId: 'election-1',
  positionId: 'pos-1',
  personId: 'person-99', // different from session user
  nominatedBy: 'user-1',
  status: 'nominated',
  organizationId: 'tenant-1',
};

const selfNominee = {
  ...fakeNominee,
  personId: 'user-1', // matches default session user
};

const updatedNominee = { ...fakeNominee, status: 'accepted' };

// ─── Tests ──────────────────────────────────────────────

describe('updateCandidateStatus', () => {
  beforeEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('throws UnauthorizedError when no session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { candidateId: 'nominee-1' },
      _body: { status: 'accepted' },
    });
    await expect(updateCandidateStatus(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('throws NotFoundError when nominee does not exist', async () => {
    stubRepo(ElectionsRepository, {
      getNominee: async () => undefined,
      get: async () => fakeElection,
      updateNomineeStatus: async () => updatedNominee,
    });

    const ctx = makeCtx({
      _params: { candidateId: 'no-such' },
      _body: { status: 'accepted' },
    });
    await expect(updateCandidateStatus(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws NotFoundError when election does not exist', async () => {
    stubRepo(ElectionsRepository, {
      getNominee: async () => fakeNominee,
      get: async () => undefined,
      updateNomineeStatus: async () => updatedNominee,
    });

    const ctx = makeCtx({
      _params: { candidateId: 'nominee-1' },
      _body: { status: 'accepted' },
    });
    await expect(updateCandidateStatus(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('happy path — self-nominee transitions nominated → accepted', async () => {
    stubRepo(ElectionsRepository, {
      getNominee: async () => selfNominee,
      get: async () => fakeElection,
      updateNomineeStatus: async () => ({ ...selfNominee, status: 'accepted' }),
    });

    // User is the nominee themselves (personId matches user.id = 'user-1')
    const ctx = makeCtx({
      _params: { candidateId: 'nominee-1' },
      _body: { status: 'accepted' },
    });
    const res = await updateCandidateStatus(ctx);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('accepted');
  });

  test('happy path — self-nominee transitions nominated → declined', async () => {
    stubRepo(ElectionsRepository, {
      getNominee: async () => selfNominee,
      get: async () => fakeElection,
      updateNomineeStatus: async () => ({ ...selfNominee, status: 'declined' }),
    });

    const ctx = makeCtx({
      _params: { candidateId: 'nominee-1' },
      _body: { status: 'declined' },
    });
    const res = await updateCandidateStatus(ctx);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('declined');
  });

  test('officer can update status of another nominee', async () => {
    stubRepo(ElectionsRepository, {
      getNominee: async () => fakeNominee, // person-99, not user-1
      get: async () => fakeElection,
      updateNomineeStatus: async () => updatedNominee,
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Secretary' }],
    });

    const ctx = makeCtx({
      _params: { candidateId: 'nominee-1' },
      _body: { status: 'accepted' },
    });
    const res = await updateCandidateStatus(ctx);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('accepted');
  });

  test('throws ForbiddenError when non-self non-officer tries to update', async () => {
    stubRepo(ElectionsRepository, {
      getNominee: async () => fakeNominee, // person-99, not user-1
      get: async () => fakeElection,
      updateNomineeStatus: async () => updatedNominee,
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [], // not an officer
    });

    const ctx = makeCtx({
      _params: { candidateId: 'nominee-1' },
      _body: { status: 'accepted' },
    });
    await expect(updateCandidateStatus(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('throws BusinessLogicError for invalid transition (accepted → nominated)', async () => {
    const acceptedNominee = { ...selfNominee, status: 'accepted' };
    stubRepo(ElectionsRepository, {
      getNominee: async () => acceptedNominee,
      get: async () => fakeElection,
      updateNomineeStatus: async () => acceptedNominee,
    });

    const ctx = makeCtx({
      _params: { candidateId: 'nominee-1' },
      _body: { status: 'nominated' }, // invalid: can't go back
    });
    await expect(updateCandidateStatus(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('throws BusinessLogicError for invalid transition from terminal state (declined)', async () => {
    const declinedNominee = { ...selfNominee, status: 'declined' };
    stubRepo(ElectionsRepository, {
      getNominee: async () => declinedNominee,
      get: async () => fakeElection,
      updateNomineeStatus: async () => declinedNominee,
    });

    const ctx = makeCtx({
      _params: { candidateId: 'nominee-1' },
      _body: { status: 'accepted' }, // declined is terminal
    });
    await expect(updateCandidateStatus(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('accepted → declined is valid transition', async () => {
    const acceptedNominee = { ...selfNominee, status: 'accepted' };
    stubRepo(ElectionsRepository, {
      getNominee: async () => acceptedNominee,
      get: async () => fakeElection,
      updateNomineeStatus: async () => ({ ...acceptedNominee, status: 'declined' }),
    });

    const ctx = makeCtx({
      _params: { candidateId: 'nominee-1' },
      _body: { status: 'declined' },
    });
    const res = await updateCandidateStatus(ctx);

    expect(res.status).toBe(200);
  });
});
