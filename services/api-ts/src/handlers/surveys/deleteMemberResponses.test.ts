/**
 * Tests for deleteMemberResponses handler (right-to-deletion).
 *
 * FIX-009: deletion must be scoped to the caller's current organization — the
 * prior implementation deleted ALL responses by responderId across every org
 * with no scoping. Anonymized responses (responderId nulled by the
 * person.deleted cascade) are naturally excluded because they no longer match
 * the caller's id.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SurveyResponseRepository } from './repos/survey.repo';
import { deleteMemberResponses } from './deleteMemberResponses';

describe('deleteMemberResponses', () => {
  afterEach(() => {
    restoreRepo(SurveyResponseRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(deleteMemberResponses(ctx)).rejects.toThrow();
  });

  test('FIX-009: deletes only the caller responses scoped to the current org', async () => {
    let calledWith: { responderId: string; orgId: string } | null = null;
    stubRepo(SurveyResponseRepository, {
      deleteByResponderAndOrg: async (responderId: string, orgId: string) => {
        calledWith = { responderId, orgId };
        return 3;
      },
    });

    const ctx = makeCtx({ user: { id: 'member-1', role: 'user' }, organizationId: 'tenant-1' });
    const res = await deleteMemberResponses(ctx);

    expect(res.status).toBe(200);
    expect((res as any).body.deletedCount).toBe(3);
    expect(calledWith).toEqual({ responderId: 'member-1', orgId: 'tenant-1' });
  });

  test('FIX-009: requires org context — no unscoped cross-org wipe', async () => {
    let called = false;
    stubRepo(SurveyResponseRepository, {
      deleteByResponderAndOrg: async () => { called = true; return 0; },
    });

    const ctx = makeCtx({ user: { id: 'member-1', role: 'user' }, organizationId: undefined });
    await expect(deleteMemberResponses(ctx)).rejects.toThrow(/Organization context/i);
    expect(called).toBe(false);
  });
});
