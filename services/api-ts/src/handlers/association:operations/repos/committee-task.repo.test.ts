/**
 * Unit suite for CommitteeTaskRepository (fake-DB harness, see ./__fake-db).
 * Covers task CRUD, status transitions, assignment, and the overdue/assignee
 * list paths.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { CommitteeTaskRepository } from './committee-task.repo';
import { committeeTasks } from './committee-task.schema';
import { makeFakeDb, type FakeDb } from './__fake-db';

let fake: FakeDb;
let repo: CommitteeTaskRepository;

beforeEach(() => {
  fake = makeFakeDb();
  repo = new CommitteeTaskRepository(fake.db);
});

describe('CommitteeTaskRepository', () => {
  test('list returns tasks for a committee', async () => {
    fake.seed(committeeTasks, [{ id: 't1', committeeId: 'c1' }]);
    expect(await repo.list('c1')).toHaveLength(1);
  });

  test('get returns a task or undefined', async () => {
    fake.seed(committeeTasks, [{ id: 't1', title: 'Audit' }]);
    expect((await repo.get('t1'))?.title).toBe('Audit');
    fake.seed(committeeTasks, []);
    expect(await repo.get('x')).toBeUndefined();
  });

  test('create inserts a task', async () => {
    const t = await repo.create({ committeeId: 'c1', title: 'New' } as any);
    expect(t.id).toBeDefined();
    expect(fake.rows(committeeTasks)).toHaveLength(1);
  });

  test('update sets fields + updatedAt', async () => {
    fake.seed(committeeTasks, [{ id: 't1', title: 'Old' }]);
    const out = await repo.update('t1', { title: 'Edited' });
    expect(out.title).toBe('Edited');
    expect(out.updatedAt).toBeInstanceOf(Date);
  });

  test('delete clears the matching row', async () => {
    fake.seed(committeeTasks, [{ id: 't1' }]);
    await repo.delete('t1');
    expect(fake.rows(committeeTasks)).toHaveLength(0);
  });

  test('updateStatus to completed records completedAt + completedBy', async () => {
    fake.seed(committeeTasks, [{ id: 't1', status: 'pending' }]);
    const out = await repo.updateStatus('t1', 'completed', 'officer-3');
    expect(out.status).toBe('completed');
    expect(out.completedAt).toBeInstanceOf(Date);
    expect(out.completedBy).toBe('officer-3');
  });

  test('updateStatus to completed without completedBy stores null', async () => {
    fake.seed(committeeTasks, [{ id: 't1', status: 'pending' }]);
    const out = await repo.updateStatus('t1', 'completed');
    expect(out.completedBy).toBeNull();
  });

  test('updateStatus to non-completed leaves completion fields untouched', async () => {
    fake.seed(committeeTasks, [{ id: 't1', status: 'pending' }]);
    const out = await repo.updateStatus('t1', 'in_progress');
    expect(out.status).toBe('in_progress');
    expect(out.completedAt).toBeUndefined();
  });

  test('assignTo sets assigneeId', async () => {
    fake.seed(committeeTasks, [{ id: 't1' }]);
    const out = await repo.assignTo('t1', 'person-7');
    expect(out.assigneeId).toBe('person-7');
  });

  test('listOverdue returns pending past-due tasks', async () => {
    fake.seed(committeeTasks, [
      { id: 't1', committeeId: 'c1', status: 'pending', dueDate: new Date(0) },
    ]);
    expect(await repo.listOverdue('c1')).toHaveLength(1);
  });

  test('listByAssignee returns pending tasks for an assignee', async () => {
    fake.seed(committeeTasks, [
      { id: 't1', assigneeId: 'p1', status: 'pending' },
    ]);
    expect(await repo.listByAssignee('p1')).toHaveLength(1);
  });
});
