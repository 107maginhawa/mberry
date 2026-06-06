import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeElection as createFakeElection } from '@/test-utils/factories';
import { updateElectionStatus } from './updateElectionStatus';
import { ElectionsRepository } from './repos/elections.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { BusinessLogicError, ConflictError } from '@/core/errors';

mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

// ─── Fixtures ───────────────────────────────────────────

const fakeElection = createFakeElection({ status: 'draft' });

// ─── Tests ──────────────────────────────────────────────

describe('updateElectionStatus', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(OfficerTermRepository);
    // Default: user is President (authorized)
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    restoreRepo(ElectionsRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('updates status and returns 200', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      update: async (_id: string, data: any) => ({ ...fakeElection, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { status: 'nominationsOpen' },
    });

    const response = await updateElectionStatus(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('nominationsOpen');
  });

  test('sets publishedAt when status is published', async () => {
    let capturedData: any;
    mocks = stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection, status: 'awaitingConfirmation' }),
      update: async (_id: string, data: any) => { capturedData = data; return { ...fakeElection, ...data }; },
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { status: 'published' },
    });

    await updateElectionStatus(ctx);
    expect(capturedData.publishedAt).toBeInstanceOf(Date);
  });

  test('does not set publishedAt for non-published status', async () => {
    let capturedData: any;
    mocks = stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection, status: 'nominationsOpen' }),
      countNomineesByPosition: async () => [{ positionId: 'pos-1', count: 2 }],
      update: async (_id: string, data: any) => { capturedData = data; return { ...fakeElection, ...data }; },
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { status: 'votingOpen' },
    });

    await updateElectionStatus(ctx);
    expect(capturedData.publishedAt).toBeUndefined();
  });

  test('throws NotFoundError when election does not exist', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => undefined,
      update: async () => fakeElection,
    });

    const ctx = makeCtx({
      _params: { id: 'missing-id' },
      _body: { status: 'votingOpen' },
    });

    await expect(updateElectionStatus(ctx)).rejects.toThrow('Election not found');
  });

  test('transitions to cancelled status', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      update: async (_id: string, data: any) => ({ ...fakeElection, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { status: 'cancelled' },
    });

    const response = await updateElectionStatus(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('cancelled');
  });

  // ─── Transition guard tests ──────────────────────────────

  test('valid: nominationsOpen → votingOpen succeeds', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection, status: 'nominationsOpen' }),
      countNomineesByPosition: async () => [{ positionId: 'pos-1', count: 2 }],
      update: async (_id: string, data: any) => ({ ...fakeElection, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { status: 'votingOpen' },
    });

    const response = await updateElectionStatus(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('votingOpen');
  });

  test('invalid: draft → published throws ConflictError', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      update: async (_id: string, data: any) => ({ ...fakeElection, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { status: 'published' },
    });

    const err = await updateElectionStatus(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect((err as ConflictError).message).toContain('Cannot transition election');
  });

  test('invalid: draft → votingOpen throws ConflictError', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => fakeElection,
      update: async (_id: string, data: any) => ({ ...fakeElection, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { status: 'votingOpen' },
    });

    const err = await updateElectionStatus(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect((err as ConflictError).message).toContain('Cannot transition election');
  });

  test('terminal: cancelled → draft throws ConflictError', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection, status: 'cancelled' }),
      update: async (_id: string, data: any) => ({ ...fakeElection, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { status: 'draft' },
    });

    const err = await updateElectionStatus(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect((err as ConflictError).message).toContain('terminal');
  });

  test('terminal: published → cancelled throws ConflictError', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection, status: 'published' }),
      update: async (_id: string, data: any) => ({ ...fakeElection, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { status: 'cancelled' },
    });

    const err = await updateElectionStatus(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect((err as ConflictError).message).toContain('terminal');
  });

  // ─── [V-07 / BR-33] Min-candidate guard tests ────────────

  test('[V-07] throws INSUFFICIENT_CANDIDATES when transitioning to votingOpen with 0 nominees', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection, status: 'nominationsOpen' }),
      countNomineesByPosition: async () => [{ positionId: 'pos-1', count: 0 }],
      update: async () => { throw new Error('should not reach update'); },
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { status: 'votingOpen' },
    });

    const err = await updateElectionStatus(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect((err as BusinessLogicError).code).toBe('INSUFFICIENT_CANDIDATES');
    expect((err as any).message).toContain('fewer than 2 candidates');
  });

  test('[V-07] throws INSUFFICIENT_CANDIDATES when transitioning to votingOpen with 1 nominee per position', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection, status: 'nominationsOpen' }),
      countNomineesByPosition: async () => [
        { positionId: 'pos-1', count: 1 },
        { positionId: 'pos-2', count: 1 },
      ],
      update: async () => { throw new Error('should not reach update'); },
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { status: 'votingOpen' },
    });

    const err = await updateElectionStatus(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect((err as BusinessLogicError).code).toBe('INSUFFICIENT_CANDIDATES');
    expect((err as any).message).toContain('2 position(s)');
  });

  test('[V-07] succeeds transitioning to votingOpen with 2+ nominees per position', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection, status: 'nominationsOpen' }),
      countNomineesByPosition: async () => [
        { positionId: 'pos-1', count: 2 },
        { positionId: 'pos-2', count: 3 },
      ],
      update: async (_id: string, data: any) => ({ ...fakeElection, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { status: 'votingOpen' },
    });

    const response = await updateElectionStatus(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('votingOpen');
  });

  test('[V-07] mixed positions: some with 2+ and one with 1 → throws INSUFFICIENT_CANDIDATES', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection, status: 'nominationsOpen' }),
      countNomineesByPosition: async () => [
        { positionId: 'pos-1', count: 3 },
        { positionId: 'pos-2', count: 1 },  // under minimum
      ],
      update: async () => { throw new Error('should not reach update'); },
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { status: 'votingOpen' },
    });

    const err = await updateElectionStatus(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect((err as BusinessLogicError).code).toBe('INSUFFICIENT_CANDIDATES');
    expect((err as any).message).toContain('1 position(s)');
  });

  test('[V-07] transitioning to nominationsOpen skips candidate check (works with 0 nominees)', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => fakeElection, // draft status
      // No countNomineesByPosition stub — should not be called
      update: async (_id: string, data: any) => ({ ...fakeElection, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { status: 'nominationsOpen' },
    });

    const response = await updateElectionStatus(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('nominationsOpen');
  });

  test('valid: votingOpen → cancelled succeeds', async () => {
    mocks = stubRepo(ElectionsRepository, {
      get: async () => ({ ...fakeElection, status: 'votingOpen' }),
      update: async (_id: string, data: any) => ({ ...fakeElection, ...data }),
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { status: 'cancelled' },
    });

    const response = await updateElectionStatus(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('cancelled');
  });

  // ─── Authorization ───────────────────────────────────────

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'election-1' },
      _body: { status: 'nominationsOpen' },
    });
    await expect(updateElectionStatus(ctx)).rejects.toThrow('Unauthorized');
  });

  test('returns 403 when user is not president', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Treasurer' }],
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { status: 'nominationsOpen' },
    });

    const response = await updateElectionStatus(ctx);
    expect(response.status).toBe(403);
  });

  test('returns 403 when user has no officer term', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });

    const ctx = makeCtx({
      _params: { id: 'election-1' },
      _body: { status: 'nominationsOpen' },
    });

    const response = await updateElectionStatus(ctx);
    expect(response.status).toBe(403);
  });
});
