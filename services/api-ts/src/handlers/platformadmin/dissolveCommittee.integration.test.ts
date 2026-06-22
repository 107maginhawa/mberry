/**
 * Real-PG integration for the dissolveCommittee handler (BR-39). Drives the REAL
 * handler against a createScratch schema with the REAL CommitteeRepository — the
 * platform-admin dissolution flow: 200 happy path (status=completed, members
 * deactivated end-to-end, rows retained), 409 on re-dissolve, 404 on missing.
 * Skips when DB unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { CommitteeRepository } from '@/handlers/association:operations/repos/committee.repo';
import { dissolveCommittee } from './dissolveCommittee';

let H: ScratchDb;
let repo: CommitteeRepository;
const ORG = '00000000-0000-4000-8000-0000000000c3';

beforeAll(async () => {
  H = await createScratch(['committee', 'committee_member']);
  if (H.dbReachable) repo = new CommitteeRepository(H.db as never);
});
afterAll(async () => { await H?.teardown(); });

interface CtxOpts {
  userId: string;
  id: string;
  reason?: string;
}

function makeCtx(opts: CtxOpts) {
  let captured: { data: unknown; status: number } = { data: null, status: 0 };
  const store: Record<string, unknown> = {
    session: { user: { id: opts.userId, name: 'Admin', email: 'a@test.com', role: 'platform_admin' } },
    database: H.db,
  };
  const ctx = {
    get: (key: string) => store[key],
    set: () => {},
    req: {
      param: (k: string) => (k === 'id' ? opts.id : undefined),
      valid: (kind: 'json' | 'param') => (kind === 'json' ? { reason: opts.reason } : { id: opts.id }),
    },
    json: (data: unknown, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
  };
  return ctx as never;
}

function capture(ctx: never): { data: unknown; status: number } {
  return (ctx as unknown as { _captured: () => { data: unknown; status: number } })._captured();
}

describe('dissolveCommittee handler — real PG (BR-39)', () => {
  test('200: dissolves an active committee, deactivates members, retains rows', async () => {
    if (!H.dbReachable) return;
    const c = await repo.create({ organizationId: ORG, name: 'Events Committee', status: 'active' } as never);
    await repo.addMember({ organizationId: ORG, committeeId: c.id, personId: crypto.randomUUID(), role: 'chairperson' } as never);
    await repo.addMember({ organizationId: ORG, committeeId: c.id, personId: crypto.randomUUID(), role: 'member' } as never);

    const ctx = makeCtx({ userId: crypto.randomUUID(), id: c.id, reason: 'term ended' });
    await dissolveCommittee(ctx);
    const res = capture(ctx) as { data: { data: { status: string; dissolvedAt: unknown } }; status: number };
    expect(res.status).toBe(200);
    expect(res.data.data.status).toBe('completed');
    expect(res.data.data.dissolvedAt).not.toBeNull();

    // Committee row reflects dissolution; all member rows retained but inactive.
    const reloaded = await repo.get(c.id);
    expect(reloaded?.status).toBe('completed');
    expect(reloaded?.dissolutionReason).toBe('term ended');
    expect((await repo.listMembers(c.id)).length).toBe(0);
    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".committee_member WHERE committee_id=$1`,
      [c.id],
    );
    expect(rows[0].n).toBe(2);
  });

  test('409: re-dissolving an already-completed committee is rejected', async () => {
    if (!H.dbReachable) return;
    const c = await repo.create({ organizationId: ORG, name: 'Once', status: 'active' } as never);
    await dissolveCommittee(makeCtx({ userId: crypto.randomUUID(), id: c.id }));
    await expect(
      dissolveCommittee(makeCtx({ userId: crypto.randomUUID(), id: c.id })),
    ).rejects.toThrow(/already dissolved/i);
  });

  test('404: dissolving a non-existent committee is rejected', async () => {
    if (!H.dbReachable) return;
    await expect(
      dissolveCommittee(makeCtx({ userId: crypto.randomUUID(), id: crypto.randomUUID() })),
    ).rejects.toThrow(/not found/i);
  });
});
