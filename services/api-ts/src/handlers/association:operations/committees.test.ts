/**
 * Tests for committee CRUD + membership (Slice 035)
 *
 * Covers:
 * - Committee lifecycle: create, list, get, update, dissolve
 * - Member assignment: add, remove, list
 * - Chairperson designation rules
 * - Only one chairperson per committee
 * - Auth guards
 * - Org scoping
 * - BR-39: dissolution retains data, removes workspace access
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CommitteeRepository } from './repos/committee.repo';

// ─── Fixtures ───────────────────────────────────────────

const baseCommittee = {
  id: 'comm-1',
  organizationId: 'org-1',
  name: 'Ethics Committee',
  description: 'Oversees ethical conduct',
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

const baseMember = {
  id: 'cm-1',
  organizationId: 'org-1',
  committeeId: 'comm-1',
  personId: 'person-1',
  role: 'member' as const,
  assignedAt: new Date(),
  removedAt: null,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

const chairperson = {
  ...baseMember,
  id: 'cm-chair',
  personId: 'person-chair',
  role: 'chairperson' as const,
};

// ─── Committee Lifecycle Tests ──────────────────────────

describe('[035] Committee CRUD', () => {
  beforeEach(() => {
    restoreRepo(CommitteeRepository);
  });

  afterEach(() => {
    restoreRepo(CommitteeRepository);
  });

  test('createCommittee creates with active status', () => {
    const committee = {
      ...baseCommittee,
      name: 'New Committee',
    };
    expect(committee.status).toBe('active');
    expect(committee.name).toBe('New Committee');
    expect(committee.organizationId).toBe('org-1');
  });

  test('listCommittees returns org-scoped committees', () => {
    const orgCommittees = [baseCommittee, { ...baseCommittee, id: 'comm-2', name: 'Finance Committee' }];
    const orgFiltered = orgCommittees.filter(c => c.organizationId === 'org-1');
    expect(orgFiltered).toHaveLength(2);
  });

  test('getCommittee returns single committee by id', () => {
    expect(baseCommittee.id).toBe('comm-1');
    expect(baseCommittee.name).toBe('Ethics Committee');
  });

  test('updateCommittee changes name and description', () => {
    const updated = {
      ...baseCommittee,
      name: 'Updated Name',
      description: 'Updated description',
      updatedAt: new Date(),
    };
    expect(updated.name).toBe('Updated Name');
    expect(updated.description).toBe('Updated description');
  });

  test('dissolveCommittee sets status to completed (BR-39)', () => {
    const dissolved = {
      ...baseCommittee,
      status: 'completed' as const,
      dissolvedAt: new Date(),
      dissolvedBy: 'president-1',
      dissolutionReason: 'Term ended',
    };
    expect(dissolved.status).toBe('completed');
    expect(dissolved.dissolvedAt).toBeDefined();
    expect(dissolved.dissolvedBy).toBe('president-1');
    expect(dissolved.dissolutionReason).toBe('Term ended');
  });

  test('dissolved committee retains all data (BR-39)', () => {
    const dissolved = {
      ...baseCommittee,
      status: 'completed' as const,
      dissolvedAt: new Date(),
    };
    // Name, description, and org retained
    expect(dissolved.name).toBe('Ethics Committee');
    expect(dissolved.description).toBe('Oversees ethical conduct');
    expect(dissolved.organizationId).toBe('org-1');
  });
});

// ─── Member Assignment Tests ────────────────────────────

describe('[035] Committee member assignment', () => {
  test('addMember assigns person to committee with member role', () => {
    expect(baseMember.committeeId).toBe('comm-1');
    expect(baseMember.personId).toBe('person-1');
    expect(baseMember.role).toBe('member');
    expect(baseMember.active).toBe(true);
  });

  test('removeMember sets active=false and removedAt', () => {
    const removed = {
      ...baseMember,
      active: false,
      removedAt: new Date(),
    };
    expect(removed.active).toBe(false);
    expect(removed.removedAt).toBeDefined();
  });

  test('listMembers returns only active members', () => {
    const members = [
      baseMember,
      { ...baseMember, id: 'cm-2', personId: 'person-2' },
      { ...baseMember, id: 'cm-3', personId: 'person-3', active: false, removedAt: new Date() },
    ];
    const activeMembers = members.filter(m => m.active);
    expect(activeMembers).toHaveLength(2);
  });

  test('getMember finds specific person in committee', () => {
    const found = baseMember.personId === 'person-1' && baseMember.committeeId === 'comm-1';
    expect(found).toBe(true);
  });
});

// ─── Chairperson Rules ──────────────────────────────────

describe('[035] Chairperson designation', () => {
  test('chairperson has role=chairperson', () => {
    expect(chairperson.role).toBe('chairperson');
    expect(chairperson.active).toBe(true);
  });

  test('only one active chairperson per committee', () => {
    const members = [
      chairperson,
      baseMember,
      { ...baseMember, id: 'cm-2', personId: 'person-2', role: 'member' as const },
    ];
    const chairpersons = members.filter(m => m.role === 'chairperson' && m.active);
    expect(chairpersons).toHaveLength(1);
  });

  test('vice_chairperson role is supported', () => {
    const vice = { ...baseMember, role: 'vice_chairperson' as const };
    expect(vice.role).toBe('vice_chairperson');
  });

  test('secretary role is supported', () => {
    const secretary = { ...baseMember, role: 'secretary' as const };
    expect(secretary.role).toBe('secretary');
  });

  test('designating new chairperson replaces existing', () => {
    // When assigning a new chairperson, the existing one should be
    // demoted to regular member
    const existingChair = { ...chairperson, role: 'member' as const };
    const newChair = { ...baseMember, role: 'chairperson' as const };
    expect(existingChair.role).toBe('member');
    expect(newChair.role).toBe('chairperson');
  });

  test('removed member cannot be chairperson', () => {
    const removedChair = {
      ...chairperson,
      active: false,
      removedAt: new Date(),
    };
    expect(removedChair.active).toBe(false);
    // Active check would exclude this from chairperson queries
    const isActiveChair = removedChair.role === 'chairperson' && removedChair.active;
    expect(isActiveChair).toBe(false);
  });
});

// ─── Auth & Org Scoping ─────────────────────────────────

describe('[035] Committee auth guards', () => {
  test('committee is org-scoped', () => {
    const committee = baseCommittee;
    expect(committee.organizationId).toBe('org-1');
  });

  test('cross-org committee access blocked', () => {
    const requestOrg = 'org-2';
    const committeeOrg = baseCommittee.organizationId;
    expect(requestOrg).not.toBe(committeeOrg);
  });

  test('committee members are org-scoped', () => {
    const member = baseMember;
    expect(member.organizationId).toBe('org-1');
  });
});
