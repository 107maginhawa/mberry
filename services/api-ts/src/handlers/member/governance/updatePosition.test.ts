import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, makeUser, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { updatePosition } from './updatePosition';
import { PositionRepository } from '@/handlers/association:member/repos/governance.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakePosition = {
  id: 'pos-1',
  organizationId: 'tenant-1',
  title: 'President',
  description: 'Association president',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// ─── Tests ──────────────────────────────────────────────

describe('updatePosition', () => {
  afterEach(() => restoreRepo(PositionRepository));

  test('happy path — updates position and returns updated data', async () => {
    const updatedPosition = { ...fakePosition, title: 'Vice President' };
    stubRepo(PositionRepository, {
      findById: async () => fakePosition,
      update: async () => updatedPosition,
    });

    const ctx = makeCtx({
      _params: { positionId: 'pos-1' },
      _body: { title: 'Vice President' },
    });
    const res = await updatePosition(ctx);

    // ctx.json(updated) — no status arg → status is undefined in mock; assert body directly
    expect(res.body.title).toBe('Vice President');
    expect(res.body.id).toBe('pos-1');
  });

  test('missing user — returns 401', async () => {
    stubRepo(PositionRepository, {
      findById: async () => fakePosition,
      update: async () => fakePosition,
    });

    // updatePosition checks ctx.get('user') not session
    const ctx = makeCtx({ user: null, _params: { positionId: 'pos-1' }, _body: {} });
    const res = await updatePosition(ctx);

    expect(res.status).toBe(401);
  });

  test('missing org context — returns 403', async () => {
    stubRepo(PositionRepository, {
      findById: async () => fakePosition,
      update: async () => fakePosition,
    });

    const ctx = makeCtx({ organizationId: '', _params: { positionId: 'pos-1' }, _body: {} });
    const res = await updatePosition(ctx);

    expect(res.status).toBe(403);
  });

  test('throws NotFoundError when position does not exist', async () => {
    stubRepo(PositionRepository, {
      findById: async () => undefined,
      update: async () => fakePosition,
    });

    const ctx = makeCtx({ _params: { positionId: 'no-such' }, _body: { title: 'X' } });
    await expect(updatePosition(ctx)).rejects.toThrow();
  });

  test('throws NotFoundError when position belongs to different org', async () => {
    stubRepo(PositionRepository, {
      findById: async () => ({ ...fakePosition, organizationId: 'other-org' }),
      update: async () => fakePosition,
    });

    const ctx = makeCtx({ organizationId: 'tenant-1', _params: { positionId: 'pos-1' }, _body: {} });
    await expect(updatePosition(ctx)).rejects.toThrow();
  });

  test('partial body update — passes body fields to repo.update', async () => {
    let capturedData: any;
    stubRepo(PositionRepository, {
      findById: async () => fakePosition,
      update: async (_id: string, data: any) => {
        capturedData = data;
        return { ...fakePosition, ...data };
      },
    });

    const ctx = makeCtx({
      _params: { positionId: 'pos-1' },
      _body: { description: 'Updated description' },
    });
    await updatePosition(ctx);

    expect(capturedData.description).toBe('Updated description');
  });
});
