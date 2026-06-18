import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { listPositions } from './listPositions';
import { PositionRepository } from '@/handlers/association:member/repos/governance.repo';

describe('listPositions', () => {
  afterEach(() => {
    restoreRepo(PositionRepository);
  });

  test('returns 401 when no user', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const response = await listPositions(ctx);
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Unauthorized');
  });

  test('returns 403 when organizationId is missing', async () => {
    const ctx = makeCtx({ organizationId: null });
    const response = await listPositions(ctx);
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Organization context required');
  });

  test('returns an empty list when org has no positions', async () => {
    stubRepo(PositionRepository, {
      findByOrg: async () => [],
    });

    const ctx = makeCtx({ organizationId: 'org-1' });
    const response = await listPositions(ctx);
    expect(response.body.items).toEqual([]);
  });

  test('returns the positions for the org', async () => {
    let capturedOrg: string | null = null;
    const positions = [
      { id: 'pos-1', title: 'President', organizationId: 'org-1' },
      { id: 'pos-2', title: 'Treasurer', organizationId: 'org-1' },
    ];
    stubRepo(PositionRepository, {
      findByOrg: async (orgId: string) => { capturedOrg = orgId; return positions; },
    });

    const ctx = makeCtx({ organizationId: 'org-1' });
    const response = await listPositions(ctx);
    expect(response.body.items).toEqual(positions);
    expect(capturedOrg).toBe('org-1');
  });
});
