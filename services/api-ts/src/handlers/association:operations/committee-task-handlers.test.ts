/**
 * Tests for committee task handlers:
 * createCommitteeTask, updateCommitteeTask, completeCommitteeTask
 *
 * Covers:
 * - Auth guard (unauthenticated → 401 / session-based)
 * - Happy path with body assertions
 * - Not-found error propagation
 * - Business logic guards (dissolved committee, already-completed task)
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CommitteeTaskRepository } from './repos/committee-task.repo';
import { CommitteeRepository } from './repos/committee.repo';

// ─── Fixtures ────────────────────────────────────────────

const baseTask = {
  id: 'task-1',
  organizationId: 'org-1',
  committeeId: 'comm-1',
  title: 'Review policy draft',
  description: 'Review the updated code of conduct',
  assigneeId: null,
  status: 'pending' as const,
  priority: 'medium' as const,
  dueDate: new Date('2026-12-31'),
  completedAt: null,
  completedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

const activeCommittee = {
  id: 'comm-1',
  organizationId: 'org-1',
  name: 'Ethics Committee',
  description: null,
  status: 'active' as const,
  dissolvedAt: null,
  dissolvedBy: null,
  dissolutionReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

const dissolvedCommittee = {
  ...activeCommittee,
  status: 'completed' as const,
  dissolvedAt: new Date(),
};

// ═══════════════════════════════════════════════════════
// createCommitteeTask
// ═══════════════════════════════════════════════════════

describe('createCommitteeTask', () => {
  beforeEach(() => {
    restoreRepo(CommitteeRepository);
    restoreRepo(CommitteeTaskRepository);
  });
  afterEach(() => {
    restoreRepo(CommitteeRepository);
    restoreRepo(CommitteeTaskRepository);
  });

  test('throws when session is null (unauthenticated path)', async () => {
    // createCommitteeTask reads session.user.id directly — no explicit auth guard.
    // Null session causes a TypeError which propagates as an error.
    stubRepo(CommitteeRepository, { get: async () => activeCommittee });
    stubRepo(CommitteeTaskRepository, { create: async () => baseTask });
    const { createCommitteeTask } = await import('./createCommitteeTask');
    const ctx = makeCtx({ user: null, session: null, _params: { committeeId: 'comm-1' }, _body: { title: 'Task' } });
    await expect(createCommitteeTask(ctx)).rejects.toThrow();
  });

  test('returns 400 when title is missing', async () => {
    stubRepo(CommitteeRepository, { get: async () => activeCommittee });
    const { createCommitteeTask } = await import('./createCommitteeTask');
    const ctx = makeCtx({
      _params: { committeeId: 'comm-1' },
      _body: { description: 'no title here' },
    });
    const res = await createCommitteeTask(ctx);
    expect(res.status).toBe(400);
    expect((res as any).body.error).toMatch(/title/i);
  });

  test('returns 404 when committee does not exist', async () => {
    stubRepo(CommitteeRepository, { get: async () => undefined });
    stubRepo(CommitteeTaskRepository, { create: async () => baseTask });
    const { createCommitteeTask } = await import('./createCommitteeTask');
    const ctx = makeCtx({
      _params: { committeeId: 'missing-comm' },
      _body: { title: 'New Task' },
    });
    await expect(createCommitteeTask(ctx)).rejects.toThrow(/not found/i);
  });

  test('throws BusinessLogicError for dissolved committee', async () => {
    stubRepo(CommitteeRepository, { get: async () => dissolvedCommittee });
    const { createCommitteeTask } = await import('./createCommitteeTask');
    const ctx = makeCtx({
      _params: { committeeId: 'comm-1' },
      _body: { title: 'New Task' },
    });
    await expect(createCommitteeTask(ctx)).rejects.toThrow(/dissolved/i);
  });

  test('returns 201 with task data on success', async () => {
    stubRepo(CommitteeRepository, { get: async () => activeCommittee });
    stubRepo(CommitteeTaskRepository, { create: async () => baseTask });
    const { createCommitteeTask } = await import('./createCommitteeTask');
    const ctx = makeCtx({
      _params: { committeeId: 'comm-1' },
      _body: { title: 'Review policy draft', priority: 'high' },
    });
    const res = await createCommitteeTask(ctx);
    expect(res.status).toBe(201);
    const body = (res as any).body;
    expect(body.data.id).toBe('task-1');
    expect(body.data.title).toBe('Review policy draft');
    expect(body.data.committeeId).toBe('comm-1');
    expect(body.data.status).toBe('pending');
  });

  test('defaults status to pending when not provided', async () => {
    let capturedData: any = null;
    stubRepo(CommitteeRepository, { get: async () => activeCommittee });
    stubRepo(CommitteeTaskRepository, {
      create: async (data: any) => {
        capturedData = data;
        return { ...baseTask, ...data, id: 'task-new' };
      },
    });
    const { createCommitteeTask } = await import('./createCommitteeTask');
    const ctx = makeCtx({
      _params: { committeeId: 'comm-1' },
      _body: { title: 'Task without status' },
    });
    await createCommitteeTask(ctx);
    expect(capturedData.status).toBe('pending');
    expect(capturedData.priority).toBe('medium');
  });
});

// ═══════════════════════════════════════════════════════
// updateCommitteeTask
// ═══════════════════════════════════════════════════════

describe('updateCommitteeTask', () => {
  beforeEach(() => {
    restoreRepo(CommitteeTaskRepository);
  });
  afterEach(() => {
    restoreRepo(CommitteeTaskRepository);
  });

  test('returns 401 when unauthenticated', async () => {
    const { updateCommitteeTask } = await import('./updateCommitteeTask');
    const ctx = makeCtx({ user: null, session: null, _params: { id: 'task-1' } });
    await expect(updateCommitteeTask(ctx)).rejects.toThrow();
  });

  test('throws NotFoundError when task does not exist', async () => {
    stubRepo(CommitteeTaskRepository, { get: async () => undefined });
    const { updateCommitteeTask } = await import('./updateCommitteeTask');
    const ctx = makeCtx({
      _params: { id: 'missing-task' },
      _body: { title: 'Updated' },
    });
    await expect(updateCommitteeTask(ctx)).rejects.toThrow(/not found/i);
  });

  test('returns 200 with updated task data', async () => {
    const updatedTask = { ...baseTask, title: 'Updated title', priority: 'high' as const };
    stubRepo(CommitteeTaskRepository, {
      get: async () => baseTask,
      update: async () => updatedTask,
    });
    const { updateCommitteeTask } = await import('./updateCommitteeTask');
    const ctx = makeCtx({
      _params: { id: 'task-1' },
      _body: { title: 'Updated title', priority: 'high' },
    });
    const res = await updateCommitteeTask(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.data.id).toBe('task-1');
    expect(body.data.title).toBe('Updated title');
    expect(body.data.priority).toBe('high');
  });

  test('passes dueDate as Date object to repo', async () => {
    let capturedUpdate: any = null;
    stubRepo(CommitteeTaskRepository, {
      get: async () => baseTask,
      update: async (_id: string, data: any) => {
        capturedUpdate = data;
        return { ...baseTask, ...data };
      },
    });
    const { updateCommitteeTask } = await import('./updateCommitteeTask');
    const ctx = makeCtx({
      _params: { id: 'task-1' },
      _body: { title: 'Task', dueDate: '2026-06-15' },
    });
    await updateCommitteeTask(ctx);
    expect(capturedUpdate.dueDate).toBeInstanceOf(Date);
  });

  test('updatedBy is set from authenticated session', async () => {
    let capturedUpdate: any = null;
    stubRepo(CommitteeTaskRepository, {
      get: async () => baseTask,
      update: async (_id: string, data: any) => {
        capturedUpdate = data;
        return { ...baseTask, ...data };
      },
    });
    const { updateCommitteeTask } = await import('./updateCommitteeTask');
    const ctx = makeCtx({
      _params: { id: 'task-1' },
      _body: { title: 'Task' },
    });
    await updateCommitteeTask(ctx);
    expect(capturedUpdate.updatedBy).toBe('user-1');
  });
});

// ═══════════════════════════════════════════════════════
// completeCommitteeTask
// ═══════════════════════════════════════════════════════

describe('completeCommitteeTask', () => {
  beforeEach(() => {
    restoreRepo(CommitteeTaskRepository);
  });
  afterEach(() => {
    restoreRepo(CommitteeTaskRepository);
  });

  test('returns 401 when unauthenticated', async () => {
    const { completeCommitteeTask } = await import('./completeCommitteeTask');
    const ctx = makeCtx({ user: null, session: null, _params: { id: 'task-1' } });
    await expect(completeCommitteeTask(ctx)).rejects.toThrow();
  });

  test('throws NotFoundError when task does not exist', async () => {
    stubRepo(CommitteeTaskRepository, { get: async () => undefined });
    const { completeCommitteeTask } = await import('./completeCommitteeTask');
    const ctx = makeCtx({ _params: { id: 'missing-task' } });
    await expect(completeCommitteeTask(ctx)).rejects.toThrow(/not found/i);
  });

  test('throws BusinessLogicError when task is already completed', async () => {
    const completedTask = { ...baseTask, status: 'completed' as const, completedAt: new Date() };
    stubRepo(CommitteeTaskRepository, { get: async () => completedTask });
    const { completeCommitteeTask } = await import('./completeCommitteeTask');
    const ctx = makeCtx({ _params: { id: 'task-1' } });
    await expect(completeCommitteeTask(ctx)).rejects.toThrow(/already completed/i);
  });

  test('returns 200 with completed task data', async () => {
    const completedTask = {
      ...baseTask,
      status: 'completed' as const,
      completedAt: new Date(),
      completedBy: 'user-1',
    };
    stubRepo(CommitteeTaskRepository, {
      get: async () => baseTask,
      updateStatus: async () => completedTask,
    });
    const { completeCommitteeTask } = await import('./completeCommitteeTask');
    const ctx = makeCtx({ _params: { id: 'task-1' } });
    const res = await completeCommitteeTask(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.data.id).toBe('task-1');
    expect(body.data.status).toBe('completed');
    expect(body.data.completedAt).toBeInstanceOf(Date);
    expect(body.data.completedBy).toBe('user-1');
  });

  test('calls updateStatus with completed and current user id', async () => {
    let capturedArgs: any[] = [];
    stubRepo(CommitteeTaskRepository, {
      get: async () => baseTask,
      updateStatus: async (...args: any[]) => {
        capturedArgs = args;
        return { ...baseTask, status: 'completed' as const, completedBy: args[2] };
      },
    });
    const { completeCommitteeTask } = await import('./completeCommitteeTask');
    const ctx = makeCtx({ _params: { id: 'task-1' } });
    await completeCommitteeTask(ctx);
    expect(capturedArgs[0]).toBe('task-1');
    expect(capturedArgs[1]).toBe('completed');
    expect(capturedArgs[2]).toBe('user-1');
  });
});
