import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { getPosition } from './getPosition';
import { PositionRepository } from '@/handlers/association:member/repos/governance.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakePosition = {
  id: 'pos-1',
  organizationId: 'tenant-1',
  title: 'President',
  description: null,
  level: 1,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Tests ──────────────────────────────────────────────

describe('getPosition', () => {
  beforeEach(() => {
    restoreRepo(PositionRepository);
  });

  afterEach(() => {
    restoreRepo(PositionRepository);
  });

  test('returns 401 when no user', async () => {
    const ctx = makeCtx({ user: null, session: null, _params: { positionId: 'pos-1' } });
    const res = await getPosition(ctx as any);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organizationId', async () => {
    const ctx = makeCtx({ organizationId: '', _params: { positionId: 'pos-1' } });
    const res = await getPosition(ctx as any);
    expect(res.status).toBe(403);
  });

  test('happy path — returns position', async () => {
    stubRepo(PositionRepository, {
      findById: async () => fakePosition,
    });

    const ctx = makeCtx({ _params: { positionId: 'pos-1' } });
    const res = await getPosition(ctx as any);

    expect(res.status).toBeUndefined(); // ctx.json called with no status → body only
    expect((res as any).body.id).toBe('pos-1');
    expect((res as any).body.title).toBe('President');
    expect((res as any).body.organizationId).toBe('tenant-1');
  });

  test('throws NotFoundError when position does not exist', async () => {
    stubRepo(PositionRepository, {
      findById: async () => null,
    });

    const ctx = makeCtx({ _params: { positionId: 'missing' } });
    await expect(getPosition(ctx as any)).rejects.toThrow('Position');
  });

  test('throws NotFoundError when position belongs to different org', async () => {
    stubRepo(PositionRepository, {
      findById: async () => ({ ...fakePosition, organizationId: 'other-org' }),
    });

    const ctx = makeCtx({ organizationId: 'tenant-1', _params: { positionId: 'pos-1' } });
    await expect(getPosition(ctx as any)).rejects.toThrow('Position');
  });

  test('passes positionId to repo.findById', async () => {
    let capturedId: string | undefined;
    stubRepo(PositionRepository, {
      findById: async (id: string) => {
        capturedId = id;
        return { ...fakePosition, id };
      },
    });

    const ctx = makeCtx({ _params: { positionId: 'pos-xyz' } });
    await getPosition(ctx as any);

    expect(capturedId).toBe('pos-xyz');
  });
});
