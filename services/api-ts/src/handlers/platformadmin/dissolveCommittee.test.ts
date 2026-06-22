/**
 * Unit tests for the dissolveCommittee handler (BR-39). Repo is stubbed via the
 * shared prototype stubber — no DB. Covers the happy path + the 404/409 guards.
 * The end-to-end behavior (member deactivation, row retention, transaction) is
 * covered by dissolveCommittee.integration.test.ts on real PG.
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CommitteeRepository } from '@/handlers/association:operations/repos/committee.repo';
import { dissolveCommittee } from './dissolveCommittee';

const ADMIN = { id: 'admin-1', role: 'platform_admin' };

describe('dissolveCommittee (unit)', () => {
  afterEach(() => restoreRepo(CommitteeRepository));

  test('200: dissolves an active committee and returns completed status', async () => {
    let dissolveArgs: unknown[] = [];
    stubRepo(CommitteeRepository, {
      get: async () => ({ id: 'c1', name: 'Board', organizationId: 'org-1', status: 'active' }),
      dissolve: async (...args: unknown[]) => {
        dissolveArgs = args;
        return { id: 'c1', name: 'Board', organizationId: 'org-1', status: 'completed', dissolvedAt: new Date() };
      },
    });

    const ctx = makeCtx({ user: ADMIN, _params: { id: 'c1' }, _body: { reason: 'mandate fulfilled' } });
    const res = await dissolveCommittee(ctx);

    expect((res as unknown as { status: number }).status).toBe(200);
    const body = (res as unknown as { body: { data: { id: string; status: string } } }).body;
    expect(body.data.id).toBe('c1');
    expect(body.data.status).toBe('completed');
    // The acting admin + reason are passed through to the repo.
    expect(dissolveArgs).toEqual(['c1', 'admin-1', 'mandate fulfilled']);
  });

  test('404 when the committee does not exist', async () => {
    stubRepo(CommitteeRepository, { get: async () => undefined });
    const ctx = makeCtx({ user: ADMIN, _params: { id: 'missing' }, _body: {} });
    await expect(dissolveCommittee(ctx)).rejects.toThrow(/not found/i);
  });

  test('409 when the committee is already completed (idempotency guard)', async () => {
    stubRepo(CommitteeRepository, {
      get: async () => ({ id: 'c1', name: 'Board', organizationId: 'org-1', status: 'completed' }),
    });
    const ctx = makeCtx({ user: ADMIN, _params: { id: 'c1' }, _body: {} });
    await expect(dissolveCommittee(ctx)).rejects.toThrow(/already dissolved/i);
  });
});
