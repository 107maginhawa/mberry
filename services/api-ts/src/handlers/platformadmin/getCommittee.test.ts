/**
 * getCommittee (platformadmin re-export) — characterization tests (AHA FIX-002)
 *
 * Path: GET /admin/committees/:id
 * `platformadmin/getCommittee.ts` re-exports the implementation from
 * `association:operations/getCommittee`. These tests prove the re-export is
 * correctly wired and behaves (the underlying logic is also covered by
 * association:operations/committees.test.ts).
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { getCommittee } from './getCommittee';
import { CommitteeRepository } from '@/handlers/association:operations/repos/committee.repo';
import { NotFoundError } from '@/core/errors';

describe('getCommittee (platformadmin re-export)', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  beforeEach(() => { restoreRepo(CommitteeRepository); });
  afterEach(() => { if (mocks) for (const m of Object.values(mocks)) m.mockRestore(); });

  test('re-export resolves to a function', () => {
    expect(typeof getCommittee).toBe('function');
  });

  test('returns 200 with committee data when found', async () => {
    mocks = stubRepo(CommitteeRepository, {
      get: async () => ({ id: 'committee-1', name: 'Ethics Committee' }),
    });
    const ctx = makeCtx({ _params: { id: 'committee-1' } });
    const res = await getCommittee(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.data?.id).toBe('committee-1');
  });

  test('throws NotFoundError when committee does not exist', async () => {
    mocks = stubRepo(CommitteeRepository, { get: async () => undefined });
    const ctx = makeCtx({ _params: { id: 'nope' } });
    await expect(getCommittee(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});
