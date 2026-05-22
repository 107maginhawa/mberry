import { describe, test, expect } from 'bun:test';

// ─── Types ────────────────────────────────────────────────────────────────────

type JobPostingStatus = 'active' | 'expired' | 'pending_approval' | 'suspended';
type EmployerType = 'member' | 'external';
type MemberStatus = 'active' | 'inactive' | 'non_member';

interface JobPosting {
  id: string;
  title: string;
  employerId: string;
  employerType: EmployerType;
  status: JobPostingStatus;
  deadline: Date;
  requiresApproval: boolean;
  approvedAt?: Date;
  approvedBy?: string;
}

interface Member {
  id: string;
  status: MemberStatus;
  skillPreferences: string[];
}

interface JobAlert {
  memberId: string;
  jobId: string;
  matchedSkills: string[];
  notifiedAt: Date;
}

// ─── Pure Functions ───────────────────────────────────────────────────────────

function checkAndExpirePosting(posting: JobPosting, now: Date): JobPosting {
  if (posting.status === 'expired') return posting;
  if (now > posting.deadline) {
    return { ...posting, status: 'expired' };
  }
  return posting;
}

function createExternalEmployerListing(
  id: string,
  title: string,
  employerId: string,
  deadline: Date,
): JobPosting {
  return {
    id,
    title,
    employerId,
    employerType: 'external',
    status: 'pending_approval',
    deadline,
    requiresApproval: true,
  };
}

function canAccessJobBoard(member: Member): { allowed: boolean; reason?: string } {
  if (member.status !== 'active') {
    return { allowed: false, reason: 'members_only' };
  }
  return { allowed: true };
}

function extendJobPosting(
  posting: JobPosting,
  newDeadline: Date,
  officerId: string,
  now: Date,
): JobPosting {
  return {
    ...posting,
    status: 'active',
    deadline: newDeadline,
    approvedAt: now,
    approvedBy: officerId,
  };
}

function matchJobAlerts(
  member: Member,
  posting: JobPosting,
  now: Date,
): JobAlert | null {
  const matched = member.skillPreferences.filter((skill) =>
    posting.title.toLowerCase().includes(skill.toLowerCase()),
  );
  if (matched.length === 0) return null;
  return {
    memberId: member.id,
    jobId: posting.id,
    matchedSkills: matched,
    notifiedAt: now,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('[AC-M15-001] Auto-Expiry', () => {
  const activePosting: JobPosting = {
    id: 'job-001',
    title: 'Dentist Needed',
    employerId: 'emp-1',
    employerType: 'member',
    status: 'active',
    deadline: new Date('2026-06-01T00:00:00Z'),
    requiresApproval: false,
  };

  test('posting past deadline is set to expired', () => {
    const now = new Date('2026-06-02T00:00:00Z');
    const result = checkAndExpirePosting(activePosting, now);
    expect(result.status).toBe('expired');
  });

  test('posting before deadline stays active', () => {
    const now = new Date('2026-05-30T00:00:00Z');
    const result = checkAndExpirePosting(activePosting, now);
    expect(result.status).toBe('active');
  });

  test('already expired posting is not re-processed', () => {
    const expiredPosting: JobPosting = { ...activePosting, status: 'expired' };
    const now = new Date('2026-07-01T00:00:00Z');
    const result = checkAndExpirePosting(expiredPosting, now);
    expect(result.status).toBe('expired');
    // ensure it returned same object (no mutation)
    expect(result).toBe(expiredPosting);
  });
});

describe('[AC-M15-002] External Employer Approval', () => {
  test('external employer listing is created in pending_approval status', () => {
    const posting = createExternalEmployerListing(
      'job-ext-001',
      'Oral Surgeon',
      'ext-emp-1',
      new Date('2026-07-01T00:00:00Z'),
    );
    expect(posting.status).toBe('pending_approval');
    expect(posting.requiresApproval).toBe(true);
    expect(posting.employerType).toBe('external');
  });

  test('external listing is not immediately visible as active', () => {
    const posting = createExternalEmployerListing(
      'job-ext-002',
      'Orthodontist',
      'ext-emp-2',
      new Date('2026-08-01T00:00:00Z'),
    );
    expect(posting.status).not.toBe('active');
  });

  test('pending listing has no approval metadata yet', () => {
    const posting = createExternalEmployerListing(
      'job-ext-003',
      'Periodontist',
      'ext-emp-3',
      new Date('2026-08-01T00:00:00Z'),
    );
    expect(posting.approvedBy).toBeUndefined();
    expect(posting.approvedAt).toBeUndefined();
  });
});

describe('[AC-M15-003] Access Gating', () => {
  test('non-member is blocked from job board', () => {
    const nonMember: Member = { id: 'p-1', status: 'non_member', skillPreferences: [] };
    const result = canAccessJobBoard(nonMember);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('members_only');
  });

  test('inactive member is blocked from job board', () => {
    const inactive: Member = { id: 'p-2', status: 'inactive', skillPreferences: [] };
    const result = canAccessJobBoard(inactive);
    expect(result.allowed).toBe(false);
  });

  test('active member is allowed access', () => {
    const active: Member = { id: 'p-3', status: 'active', skillPreferences: [] };
    const result = canAccessJobBoard(active);
    expect(result.allowed).toBe(true);
  });
});

describe('[AC-M15-004] Extension', () => {
  const expiredPosting: JobPosting = {
    id: 'job-002',
    title: 'General Dentist',
    employerId: 'emp-2',
    employerType: 'member',
    status: 'expired',
    deadline: new Date('2026-04-01T00:00:00Z'),
    requiresApproval: false,
  };

  test('officer can extend expired posting with new deadline', () => {
    const newDeadline = new Date('2026-07-01T00:00:00Z');
    const now = new Date('2026-05-22T10:00:00Z');
    const result = extendJobPosting(expiredPosting, newDeadline, 'officer-1', now);
    expect(result.deadline).toEqual(newDeadline);
    expect(result.status).toBe('active');
  });

  test('extension records officer ID', () => {
    const result = extendJobPosting(
      expiredPosting,
      new Date('2026-07-01T00:00:00Z'),
      'officer-99',
      new Date(),
    );
    expect(result.approvedBy).toBe('officer-99');
  });

  test('extended posting is reactivated from expired', () => {
    const result = extendJobPosting(
      expiredPosting,
      new Date('2026-08-01T00:00:00Z'),
      'officer-1',
      new Date(),
    );
    expect(result.status).toBe('active');
  });
});

describe('[AC-M15-005] Job Alert Matching', () => {
  const posting: JobPosting = {
    id: 'job-003',
    title: 'Pediatric Dentist Specialist',
    employerId: 'emp-3',
    employerType: 'member',
    status: 'active',
    deadline: new Date('2026-08-01T00:00:00Z'),
    requiresApproval: false,
  };

  test('member with matching skill preference receives alert', () => {
    const member: Member = { id: 'p-10', status: 'active', skillPreferences: ['Pediatric'] };
    const now = new Date('2026-05-22T09:00:00Z');
    const alert = matchJobAlerts(member, posting, now);
    expect(alert).not.toBeNull();
    expect(alert!.memberId).toBe('p-10');
    expect(alert!.jobId).toBe('job-003');
    expect(alert!.matchedSkills).toContain('Pediatric');
  });

  test('member without matching skills gets no alert', () => {
    const member: Member = { id: 'p-11', status: 'active', skillPreferences: ['Orthodontics'] };
    const alert = matchJobAlerts(member, posting, new Date());
    expect(alert).toBeNull();
  });

  test('alert records notification timestamp', () => {
    const member: Member = { id: 'p-12', status: 'active', skillPreferences: ['Dentist'] };
    const now = new Date('2026-05-22T10:30:00Z');
    const alert = matchJobAlerts(member, posting, now);
    expect(alert).not.toBeNull();
    expect(alert!.notifiedAt).toEqual(now);
  });

  test('member with no skill preferences gets no alert', () => {
    const member: Member = { id: 'p-13', status: 'active', skillPreferences: [] };
    const alert = matchJobAlerts(member, posting, new Date());
    expect(alert).toBeNull();
  });
});
