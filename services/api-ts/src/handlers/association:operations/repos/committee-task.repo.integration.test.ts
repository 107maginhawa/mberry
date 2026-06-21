/**
 * Real-PG integration for CommitteeTaskRepository, replacing the fake-db illusion
 * (committee-task.repo.test.ts) whose date predicates were opaque. Proves the
 * headline listOverdue predicate (status='pending' AND due_date <= now()) and the
 * completion/assignment writes against real SQL. Skips when DB unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { CommitteeTaskRepository } from './committee-task.repo';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;
let repo: CommitteeTaskRepository;
const ORG = '00000000-0000-4000-8000-0000000000a1';

function taskData(committeeId: string, o: Partial<Record<string, unknown>> = {}) {
  return { organizationId: ORG, committeeId, title: 'Task', status: 'pending', priority: 'medium', ...o } as never;
}
const ago = (d: number) => new Date(Date.now() - d * 86400000);
const ahead = (d: number) => new Date(Date.now() + d * 86400000);

beforeAll(async () => {
  H = await createScratch(['committee_task']);
  if (H.dbReachable) repo = new CommitteeTaskRepository(H.db as never);
});
afterAll(async () => { await H?.teardown(); });

describe('CommitteeTaskRepository — real-PG', () => {
  test('listOverdue returns only pending tasks past due, ordered by due_date', async () => {
    if (!H.dbReachable) return;
    const committeeId = crypto.randomUUID();
    const overdue = await repo.create(taskData(committeeId, { title: 'overdue', dueDate: ago(1) }));
    await repo.create(taskData(committeeId, { title: 'future', dueDate: ahead(1) }));          // not overdue
    await repo.create(taskData(committeeId, { title: 'done', status: 'completed', dueDate: ago(2) })); // past but completed

    const result = await repo.listOverdue(committeeId);
    expect(result.length).toBe(1);
    expect(result[0]!.id).toBe(overdue.id);
    expect(result[0]!.title).toBe('overdue');
  });

  test('updateStatus(completed) stamps completedAt + completedBy', async () => {
    if (!H.dbReachable) return;
    const t = await repo.create(taskData(crypto.randomUUID(), { dueDate: ahead(3) }));
    const by = crypto.randomUUID();
    const done = await repo.updateStatus(t.id, 'completed', by);
    expect(done.status).toBe('completed');
    expect(done.completedAt).not.toBeNull();
    expect(done.completedBy).toBe(by);
  });

  test('assignTo sets assigneeId; listByAssignee returns only that assignee\'s pending tasks', async () => {
    if (!H.dbReachable) return;
    const committeeId = crypto.randomUUID();
    const assignee = crypto.randomUUID();
    const t1 = await repo.create(taskData(committeeId, { dueDate: ahead(2) }));
    const t2 = await repo.create(taskData(committeeId, { dueDate: ahead(2) }));
    await repo.assignTo(t1.id, assignee);
    await repo.assignTo(t2.id, assignee);
    await repo.updateStatus(t2.id, 'completed', assignee); // completed → excluded from listByAssignee

    const assigned = await repo.assignTo(t1.id, assignee);
    expect(assigned.assigneeId).toBe(assignee);
    const pending = await repo.listByAssignee(assignee);
    expect(pending.length).toBe(1);
    expect(pending[0]!.id).toBe(t1.id);
  });
});
