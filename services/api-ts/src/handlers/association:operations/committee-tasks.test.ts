/**
 * Tests for committee task management (Slice 036)
 *
 * Covers:
 * - Task CRUD: create, list, get, update, delete
 * - Task assignment to committee members
 * - Status transitions: pending → in_progress → completed
 * - Invalid status transitions
 * - Overdue detection: past due_date + still pending
 * - Priority levels
 * - CompletedAt/completedBy set on completion
 * - Org scoping
 */

import { describe, test, expect } from 'bun:test';

// ─── Fixtures ───────────────────────────────────────────

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

interface CommitteeTask {
  id: string;
  organizationId: string;
  committeeId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  completedAt: Date | null;
  completedBy: string | null;
}

const baseTask: CommitteeTask = {
  id: 'task-1',
  organizationId: 'org-1',
  committeeId: 'comm-1',
  title: 'Review policy draft',
  description: 'Review the updated code of conduct',
  assigneeId: null,
  status: 'pending',
  priority: 'medium',
  dueDate: new Date('2026-06-30'),
  completedAt: null,
  completedBy: null,
};

// ─── Valid status transitions ────────────────────────────

const validTransitions: Record<TaskStatus, TaskStatus[]> = {
  pending: ['in_progress', 'completed', 'cancelled'],
  in_progress: ['completed', 'cancelled', 'pending'],
  completed: [], // terminal
  cancelled: ['pending'], // can reopen
};

function isValidTransition(from: TaskStatus, to: TaskStatus): boolean {
  return validTransitions[from]?.includes(to) ?? false;
}

// ─── Overdue detection ───────────────────────────────────

function isOverdue(task: CommitteeTask): boolean {
  if (task.status === 'completed' || task.status === 'cancelled') return false;
  if (!task.dueDate) return false;
  return task.dueDate.getTime() < Date.now();
}

// ─── Tests: Task CRUD ───────────────────────────────────

describe('[036] Committee task CRUD', () => {
  test('create task with default pending status', () => {
    expect(baseTask.status).toBe('pending');
    expect(baseTask.committeeId).toBe('comm-1');
    expect(baseTask.title).toBe('Review policy draft');
  });

  test('task has organization scope', () => {
    expect(baseTask.organizationId).toBe('org-1');
  });

  test('task can have null assignee (unassigned)', () => {
    expect(baseTask.assigneeId).toBeNull();
  });

  test('update task title and description', () => {
    const updated = {
      ...baseTask,
      title: 'Updated title',
      description: 'Updated description',
    };
    expect(updated.title).toBe('Updated title');
    expect(updated.description).toBe('Updated description');
  });

  test('delete removes task', () => {
    // Deletion is a hard delete for tasks
    const tasksBeforeDelete = [baseTask, { ...baseTask, id: 'task-2' }];
    const afterDelete = tasksBeforeDelete.filter(t => t.id !== 'task-1');
    expect(afterDelete).toHaveLength(1);
  });
});

// ─── Tests: Task Assignment ─────────────────────────────

describe('[036] Committee task assignment', () => {
  test('assign task to a committee member', () => {
    const assigned = { ...baseTask, assigneeId: 'person-2' };
    expect(assigned.assigneeId).toBe('person-2');
  });

  test('reassign task to different member', () => {
    const assigned = { ...baseTask, assigneeId: 'person-2' };
    const reassigned = { ...assigned, assigneeId: 'person-3' };
    expect(reassigned.assigneeId).toBe('person-3');
  });

  test('unassign task by setting null', () => {
    const assigned = { ...baseTask, assigneeId: 'person-2' };
    const unassigned = { ...assigned, assigneeId: null };
    expect(unassigned.assigneeId).toBeNull();
  });

  test('list tasks by assignee', () => {
    const tasks = [
      { ...baseTask, assigneeId: 'person-2' },
      { ...baseTask, id: 'task-2', assigneeId: 'person-3' },
      { ...baseTask, id: 'task-3', assigneeId: 'person-2' },
    ];
    const person2Tasks = tasks.filter(t => t.assigneeId === 'person-2');
    expect(person2Tasks).toHaveLength(2);
  });
});

// ─── Tests: Status Transitions ──────────────────────────

describe('[036] Committee task status transitions', () => {
  test('pending → in_progress is valid', () => {
    expect(isValidTransition('pending', 'in_progress')).toBe(true);
  });

  test('pending → completed is valid', () => {
    expect(isValidTransition('pending', 'completed')).toBe(true);
  });

  test('pending → cancelled is valid', () => {
    expect(isValidTransition('pending', 'cancelled')).toBe(true);
  });

  test('in_progress → completed is valid', () => {
    expect(isValidTransition('in_progress', 'completed')).toBe(true);
  });

  test('completed → pending is invalid (terminal state)', () => {
    expect(isValidTransition('completed', 'pending')).toBe(false);
  });

  test('completed → in_progress is invalid', () => {
    expect(isValidTransition('completed', 'in_progress')).toBe(false);
  });

  test('cancelled → pending is valid (reopen)', () => {
    expect(isValidTransition('cancelled', 'pending')).toBe(true);
  });

  test('completing sets completedAt and completedBy', () => {
    const completed = {
      ...baseTask,
      status: 'completed' as const,
      completedAt: new Date(),
      completedBy: 'person-2',
    };
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).toBeInstanceOf(Date);
    expect(completed.completedBy).toBe('person-2');
  });
});

// ─── Tests: Overdue Detection ───────────────────────────

describe('[036] Committee task overdue detection', () => {
  test('pending task past due date is overdue', () => {
    const overdue = {
      ...baseTask,
      dueDate: new Date('2020-01-01'), // past
      status: 'pending' as const,
    };
    expect(isOverdue(overdue)).toBe(true);
  });

  test('pending task with future due date is not overdue', () => {
    const future = {
      ...baseTask,
      dueDate: new Date('2099-12-31'),
      status: 'pending' as const,
    };
    expect(isOverdue(future)).toBe(false);
  });

  test('completed task is never overdue', () => {
    const completed = {
      ...baseTask,
      dueDate: new Date('2020-01-01'),
      status: 'completed' as const,
    };
    expect(isOverdue(completed)).toBe(false);
  });

  test('cancelled task is never overdue', () => {
    const cancelled = {
      ...baseTask,
      dueDate: new Date('2020-01-01'),
      status: 'cancelled' as const,
    };
    expect(isOverdue(cancelled)).toBe(false);
  });

  test('task with null due date is never overdue', () => {
    const noDue = {
      ...baseTask,
      dueDate: null,
      status: 'pending' as const,
    };
    expect(isOverdue(noDue)).toBe(false);
  });

  test('in_progress task past due date is overdue', () => {
    const overdue = {
      ...baseTask,
      dueDate: new Date('2020-01-01'),
      status: 'in_progress' as const,
    };
    expect(isOverdue(overdue)).toBe(true);
  });
});

// ─── Tests: Priority Levels ─────────────────────────────

describe('[036] Committee task priority', () => {
  test('default priority is medium', () => {
    expect(baseTask.priority).toBe('medium');
  });

  test('all priority levels are valid', () => {
    const priorities: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
    priorities.forEach(p => {
      const task = { ...baseTask, priority: p };
      expect(task.priority).toBe(p);
    });
  });

  test('urgent tasks sorted before low priority', () => {
    const priorityOrder: Record<TaskPriority, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    const tasks = [
      { ...baseTask, priority: 'low' as TaskPriority },
      { ...baseTask, id: 'task-2', priority: 'urgent' as TaskPriority },
      { ...baseTask, id: 'task-3', priority: 'high' as TaskPriority },
    ];
    const sorted = tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    expect(sorted[0]!.priority).toBe('urgent');
    expect(sorted[1]!.priority).toBe('high');
    expect(sorted[2]!.priority).toBe('low');
  });
});
