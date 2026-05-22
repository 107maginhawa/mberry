/**
 * AC-M19: Committee Management Module — Pure Domain Logic Tests
 *
 * Covers:
 *   AC-M19-001: Committee CRUD with chairperson required
 *   AC-M19-002: Dissolution preserves history (BR-39)
 *   AC-M19-003: Task lifecycle — pending→in_progress→completed
 *   AC-M19-004: Member assignment — add/remove with role
 *   AC-M19-005: Dissolved committee blocks mutations
 *   AC-M19-006: Only one chairperson per committee
 */
import { describe, test, expect } from 'bun:test';

// ─── Domain Types ─────────────────────────────────────────

type CommitteeStatus = 'active' | 'expired' | 'dissolved';
type CommitteeMemberRole = 'chairperson' | 'vice_chair' | 'secretary' | 'member';
type TaskStatus = 'pending' | 'in_progress' | 'completed';
type TaskPriority = 'low' | 'medium' | 'high';

interface Committee {
  id: string;
  organizationId: string;
  name: string;
  status: CommitteeStatus;
  dissolvedAt: Date | null;
  dissolvedBy: string | null;
  dissolutionReason: string | null;
}

interface CommitteeMember {
  id: string;
  committeeId: string;
  personId: string;
  role: CommitteeMemberRole;
  assignedAt: Date;
  removedAt: Date | null;
  active: boolean;
}

interface CommitteeTask {
  id: string;
  committeeId: string;
  title: string;
  assigneeId: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  completedAt: Date | null;
  completedBy: string | null;
}

interface CreateCommitteeInput {
  name: string;
  organizationId: string;
  chairpersonId: string | null;
}

// ─── Domain Functions ─────────────────────────────────────

/**
 * AC-M19-001: Validate committee creation requires a chairperson.
 */
function validateCreateCommittee(
  input: CreateCommitteeInput,
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (!input.name || input.name.trim().length === 0) {
    errors.push('Committee name is required.');
  }

  if (!input.chairpersonId) {
    errors.push('A chairperson must be assigned when creating a committee.');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true };
}

/**
 * AC-M19-002: Dissolve committee — sets status, preserves all data (BR-39).
 */
interface DissolutionResult {
  committee: Committee;
  membersRevoked: string[]; // personIds who lost workspace access
}

function dissolveCommittee(
  committee: Committee,
  dissolvedBy: string,
  reason: string,
  now: Date,
  members: CommitteeMember[],
): DissolutionResult {
  const dissolved: Committee = {
    ...committee,
    status: 'dissolved',
    dissolvedAt: now,
    dissolvedBy,
    dissolutionReason: reason,
  };

  // Members lose workspace access but data is preserved (BR-39)
  const membersRevoked = members
    .filter((m) => m.active)
    .map((m) => m.personId);

  return { committee: dissolved, membersRevoked };
}

/**
 * AC-M19-003: Task lifecycle transitions.
 */
const VALID_TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['in_progress', 'completed'],
  in_progress: ['completed'],
  completed: [], // terminal
};

function transitionTask(
  task: CommitteeTask,
  targetStatus: TaskStatus,
  completedBy?: string,
  now?: Date,
): { ok: true; task: CommitteeTask } | { ok: false; error: string } {
  const allowed = VALID_TASK_TRANSITIONS[task.status];
  if (!allowed.includes(targetStatus)) {
    return {
      ok: false,
      error: `Cannot transition task from "${task.status}" to "${targetStatus}".`,
    };
  }

  const updated: CommitteeTask = {
    ...task,
    status: targetStatus,
    completedAt: targetStatus === 'completed' ? (now ?? new Date()) : task.completedAt,
    completedBy: targetStatus === 'completed' ? (completedBy ?? null) : task.completedBy,
  };

  return { ok: true, task: updated };
}

/**
 * AC-M19-004: Add/remove member from committee with role.
 */
function addMemberToCommittee(
  committeeId: string,
  personId: string,
  role: CommitteeMemberRole,
  now: Date,
): CommitteeMember {
  return {
    id: `mem-${personId}`,
    committeeId,
    personId,
    role,
    assignedAt: now,
    removedAt: null,
    active: true,
  };
}

function removeMemberFromCommittee(
  member: CommitteeMember,
  now: Date,
): CommitteeMember {
  return { ...member, removedAt: now, active: false };
}

/**
 * AC-M19-005: Dissolved committee blocks all mutations.
 */
function assertCommitteeActive(
  committee: Committee,
): { ok: true } | { ok: false; error: string } {
  if (committee.status === 'dissolved') {
    return {
      ok: false,
      error: 'This committee has been dissolved. No further changes are allowed.',
    };
  }
  return { ok: true };
}

/**
 * AC-M19-006: Only one chairperson per committee — reject second chairperson assignment.
 */
function assertSingleChairperson(
  members: CommitteeMember[],
  newRole: CommitteeMemberRole,
): { ok: true } | { ok: false; error: string } {
  if (newRole !== 'chairperson') {
    return { ok: true };
  }

  const existingChair = members.find(
    (m) => m.role === 'chairperson' && m.active,
  );

  if (existingChair) {
    return {
      ok: false,
      error: `Committee already has a chairperson (member ${existingChair.personId}). Remove or reassign before assigning a new one.`,
    };
  }

  return { ok: true };
}

// ─── Helpers ──────────────────────────────────────────────

function makeCommittee(
  status: CommitteeStatus = 'active',
  overrides: Partial<Committee> = {},
): Committee {
  return {
    id: 'committee-1',
    organizationId: 'org-1',
    name: 'Finance Committee',
    status,
    dissolvedAt: null,
    dissolvedBy: null,
    dissolutionReason: null,
    ...overrides,
  };
}

function makeMember(
  role: CommitteeMemberRole = 'member',
  overrides: Partial<CommitteeMember> = {},
): CommitteeMember {
  return {
    id: 'cm-1',
    committeeId: 'committee-1',
    personId: 'person-1',
    role,
    assignedAt: new Date(),
    removedAt: null,
    active: true,
    ...overrides,
  };
}

function makeTask(
  status: TaskStatus = 'pending',
  overrides: Partial<CommitteeTask> = {},
): CommitteeTask {
  return {
    id: 'task-1',
    committeeId: 'committee-1',
    title: 'Review budget',
    assigneeId: 'person-1',
    status,
    priority: 'medium',
    dueDate: null,
    completedAt: null,
    completedBy: null,
    ...overrides,
  };
}

// ─── AC-M19-001: Committee CRUD with Chairperson Required ──

describe('[AC-M19-001] Committee CRUD — chairperson required', () => {
  test('valid committee input with chairperson passes', () => {
    const result = validateCreateCommittee({
      name: 'Finance Committee',
      organizationId: 'org-1',
      chairpersonId: 'person-1',
    });
    expect(result.ok).toBe(true);
  });

  test('missing chairperson blocks creation', () => {
    const result = validateCreateCommittee({
      name: 'Finance Committee',
      organizationId: 'org-1',
      chairpersonId: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('chairperson'))).toBe(true);
    }
  });

  test('missing name blocks creation', () => {
    const result = validateCreateCommittee({
      name: '',
      organizationId: 'org-1',
      chairpersonId: 'person-1',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('name'))).toBe(true);
    }
  });

  test('both name and chairperson missing returns both errors', () => {
    const result = validateCreateCommittee({
      name: '',
      organizationId: 'org-1',
      chairpersonId: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(2);
    }
  });
});

// ─── AC-M19-002: Dissolution Preserves History ────────────

describe('[AC-M19-002] Dissolution preserves history (BR-39)', () => {
  test('dissolution sets status to dissolved and records metadata', () => {
    const committee = makeCommittee('active');
    const members = [makeMember('chairperson'), makeMember('member', { id: 'cm-2', personId: 'person-2' })];
    const now = new Date('2026-06-01T10:00:00Z');

    const result = dissolveCommittee(committee, 'officer-1', 'Project completed', now, members);

    expect(result.committee.status).toBe('dissolved');
    expect(result.committee.dissolvedAt).toEqual(now);
    expect(result.committee.dissolvedBy).toBe('officer-1');
    expect(result.committee.dissolutionReason).toBe('Project completed');
  });

  test('dissolution revokes access for all active members', () => {
    const committee = makeCommittee('active');
    const members = [
      makeMember('chairperson', { personId: 'person-1' }),
      makeMember('member', { id: 'cm-2', personId: 'person-2' }),
      // One already removed member
      makeMember('member', { id: 'cm-3', personId: 'person-3', active: false, removedAt: new Date() }),
    ];

    const result = dissolveCommittee(committee, 'officer-1', 'reason', new Date(), members);

    // Only active members lose access; inactive already removed
    expect(result.membersRevoked).toContain('person-1');
    expect(result.membersRevoked).toContain('person-2');
    expect(result.membersRevoked).not.toContain('person-3');
  });

  test('committee name and data preserved post-dissolution (not deleted)', () => {
    const committee = makeCommittee('active', { name: 'Budget Task Force' });
    const result = dissolveCommittee(committee, 'officer-1', 'done', new Date(), []);
    // Name and id preserved — data not wiped
    expect(result.committee.name).toBe('Budget Task Force');
    expect(result.committee.id).toBe('committee-1');
  });
});

// ─── AC-M19-003: Task Lifecycle ───────────────────────────

describe('[AC-M19-003] Task lifecycle — pending→in_progress→completed', () => {
  test('pending task can transition to in_progress', () => {
    const task = makeTask('pending');
    const result = transitionTask(task, 'in_progress');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.task.status).toBe('in_progress');
    }
  });

  test('in_progress task can transition to completed', () => {
    const now = new Date();
    const task = makeTask('in_progress');
    const result = transitionTask(task, 'completed', 'person-1', now);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.task.status).toBe('completed');
      expect(result.task.completedAt).toEqual(now);
      expect(result.task.completedBy).toBe('person-1');
    }
  });

  test('pending task can skip directly to completed', () => {
    const task = makeTask('pending');
    const result = transitionTask(task, 'completed');
    expect(result.ok).toBe(true);
  });

  test('completed task cannot be re-opened (terminal)', () => {
    const task = makeTask('completed');
    const result = transitionTask(task, 'in_progress');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('completed');
    }
  });

  test('in_progress cannot go back to pending', () => {
    const task = makeTask('in_progress');
    const result = transitionTask(task, 'pending');
    expect(result.ok).toBe(false);
  });
});

// ─── AC-M19-004: Member Assignment ────────────────────────

describe('[AC-M19-004] Member assignment — add/remove with role', () => {
  test('member added with default member role', () => {
    const now = new Date();
    const member = addMemberToCommittee('committee-1', 'person-5', 'member', now);
    expect(member.personId).toBe('person-5');
    expect(member.role).toBe('member');
    expect(member.active).toBe(true);
    expect(member.removedAt).toBeNull();
  });

  test('member added as vice_chair', () => {
    const member = addMemberToCommittee('committee-1', 'person-6', 'vice_chair', new Date());
    expect(member.role).toBe('vice_chair');
  });

  test('removing member preserves record (sets removedAt, active=false)', () => {
    const member = makeMember('member', { personId: 'person-7' });
    const now = new Date('2026-06-01T00:00:00Z');
    const removed = removeMemberFromCommittee(member, now);
    expect(removed.active).toBe(false);
    expect(removed.removedAt).toEqual(now);
    // History preserved — record still exists
    expect(removed.personId).toBe('person-7');
    expect(removed.committeeId).toBe('committee-1');
  });
});

// ─── AC-M19-005: Dissolved Committee Blocks Mutations ─────

describe('[AC-M19-005] Dissolved committee blocks mutations', () => {
  test('dissolved committee blocks adding members', () => {
    const committee = makeCommittee('dissolved');
    const result = assertCommitteeActive(committee);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('dissolved');
    }
  });

  test('active committee allows mutations', () => {
    const committee = makeCommittee('active');
    const result = assertCommitteeActive(committee);
    expect(result.ok).toBe(true);
  });

  test('expired committee is still mutable (not yet dissolved)', () => {
    const committee = makeCommittee('expired');
    const result = assertCommitteeActive(committee);
    expect(result.ok).toBe(true);
  });
});

// ─── AC-M19-006: Only One Chairperson Per Committee ───────

describe('[AC-M19-006] Only one chairperson per committee', () => {
  test('adding chairperson to committee with no existing chair succeeds', () => {
    const members: CommitteeMember[] = [makeMember('member')];
    const result = assertSingleChairperson(members, 'chairperson');
    expect(result.ok).toBe(true);
  });

  test('adding second chairperson is rejected when one already exists', () => {
    const members: CommitteeMember[] = [makeMember('chairperson', { personId: 'person-1' })];
    const result = assertSingleChairperson(members, 'chairperson');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('chairperson');
    }
  });

  test('adding non-chairperson role when chairperson exists is allowed', () => {
    const members: CommitteeMember[] = [makeMember('chairperson')];
    const result = assertSingleChairperson(members, 'member');
    expect(result.ok).toBe(true);
  });

  test('removed (inactive) chairperson does not block new chairperson assignment', () => {
    const members: CommitteeMember[] = [
      makeMember('chairperson', {
        personId: 'old-chair',
        active: false,
        removedAt: new Date(),
      }),
    ];
    const result = assertSingleChairperson(members, 'chairperson');
    // Inactive chair doesn't count — slot is open
    expect(result.ok).toBe(true);
  });
});
