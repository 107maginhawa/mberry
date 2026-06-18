import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { deletePosition } from './deletePosition';
import { PositionRepository } from '@/handlers/association:member/repos/governance.repo';
import { NotFoundError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────

const fakePosition = {
  id: 'pos-1',
  organizationId: 'tenant-1',
  title: 'Vice President',
  description: null,
  level: 1,
  termLengthMonths: 12,
  maxTerms: null,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Tests ──────────────────────────────────────────────

describe('deletePosition', () => {
  beforeEach(() => {
    restoreRepo(PositionRepository);
  });

  afterEach(() => {
    restoreRepo(PositionRepository);
  });

  test('returns 401 when no user', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { positionId: 'pos-1' } });
    const res = await deletePosition(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organizationId', async () => {
    const ctx = makeCtx({ organizationId: '', _params: { positionId: 'pos-1' } });
    const res = await deletePosition(ctx);
    expect(res.status).toBe(403);
  });

  test('throws NotFoundError when position does not exist', async () => {
    stubRepo(PositionRepository, {
      findById: async () => undefined,
      delete: async () => undefined,
    });

    const ctx = makeCtx({ _params: { positionId: 'no-such' } });
    await expect(deletePosition(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws NotFoundError when position belongs to different org', async () => {
    stubRepo(PositionRepository, {
      findById: async () => ({ ...fakePosition, organizationId: 'other-org' }),
      delete: async () => undefined,
    });

    const ctx = makeCtx({ organizationId: 'tenant-1', _params: { positionId: 'pos-1' } });
    await expect(deletePosition(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('happy path — deletes position and returns success', async () => {
    let deletedId: string | undefined;
    stubRepo(PositionRepository, {
      findById: async () => fakePosition,
      delete: async (id: string) => {
        deletedId = id;
      },
    });

    const ctx = makeCtx({ _params: { positionId: 'pos-1' } });
    const res = await deletePosition(ctx);

    // ctx.json({ success: true }) — no status arg → undefined
    expect(res.body.success).toBe(true);
    expect(deletedId).toBe('pos-1');
  });

  test('passes positionId to repo.findById', async () => {
    let capturedId: string | undefined;
    stubRepo(PositionRepository, {
      findById: async (id: string) => {
        capturedId = id;
        return fakePosition;
      },
      delete: async () => undefined,
    });

    const ctx = makeCtx({ _params: { positionId: 'pos-xyz' } });
    await deletePosition(ctx);

    expect(capturedId).toBe('pos-xyz');
  });
});
