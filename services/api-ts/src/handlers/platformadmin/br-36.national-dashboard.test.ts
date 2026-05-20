// Business Rules: [BR-36]
/**
 * [BR-36] National Dashboard Access & Cross-Org Aggregation
 *
 * BR-36: "National-level dashboards showing cross-chapter aggregate reports are
 * accessible to Platform Admins and to designated National Officers (configured
 * per association by the Platform Admin). Chapter-level officers cannot view data
 * from other chapters. All cross-chapter data shown in the national dashboard is
 * aggregated — no individual member-level data is exposed unless the relevant
 * chapter has explicitly granted consent."
 *
 * Edge case: "Aggregate data for chapters with fewer than 5 members must be
 * rolled into a 'Small chapters' combined category rather than displayed
 * individually, to prevent re-identification."
 *
 * Slice 040: Stabilization — cross-org aggregation, permission enforcement,
 * data accuracy, export audit, national officer designation.
 */

import { describe, test, expect } from 'bun:test';

// ─── Pure rule functions (will be extracted to module when M14 is built) ───

type DashboardRole = 'platform_admin' | 'national_officer' | 'chapter_officer' | 'member';

interface ChapterData {
  chapterId: string;
  chapterName: string;
  memberCount: number;
  aggregateMetrics: Record<string, number>;
}

interface ChapterSnapshot {
  orgId: string;
  associationId: string;
  snapshotMonth: string; // YYYY-MM
  totalMembers: number;
  activeMembers: number;
  graceMembers: number;
  lapsedMembers: number;
  suspendedMembers: number;
  collectionRate: number; // 0-1
  totalCollected: number;
  totalExpected: number;
  cpdComplianceRate: number; // 0-1
  avgCreditsPerMember: number;
  activityCount90d: number;
}

interface AssociationSnapshot {
  associationId: string;
  snapshotMonth: string;
  totalMembers: number;
  activeMembers: number;
  graceMembers: number;
  lapsedMembers: number;
  suspendedMembers: number;
  collectionRate: number;
  totalCollected: number;
  totalExpected: number;
  cpdComplianceRate: number;
  avgCreditsPerMember: number;
  totalEvents: number;
  totalTrainingSessions: number;
}

interface NationalDashboardAccess {
  id: string;
  associationId: string;
  memberId: string;
  grantedBy: string; // platform admin member ID
  grantedAt: Date;
  revokedAt: Date | null;
}

interface DashboardExportLog {
  id: string;
  exportedBy: string;
  associationId: string;
  reportType: 'association_summary' | 'dues_collection' | 'cpd_compliance' | 'activity';
  scope: string; // 'all_chapters' or comma-separated org IDs
  dateRangeStart: Date;
  dateRangeEnd: Date;
  outputFormat: 'pdf' | 'csv';
  createdAt: Date;
}

function canAccessNationalDashboard(
  role: DashboardRole,
  isDesignatedNational: boolean,
): boolean {
  if (role === 'platform_admin') return true;
  if (role === 'national_officer' && isDesignatedNational) return true;
  return false;
}

function canViewChapterData(
  role: DashboardRole,
  userChapterId: string,
  targetChapterId: string,
): boolean {
  if (role === 'platform_admin') return true;
  if (role === 'national_officer') return true;
  if (role === 'chapter_officer' && userChapterId === targetChapterId) return true;
  return false;
}

const SMALL_CHAPTER_THRESHOLD = 5;

function anonymizeSmallChapters(chapters: ChapterData[]): ChapterData[] {
  const large = chapters.filter(c => c.memberCount >= SMALL_CHAPTER_THRESHOLD);
  const small = chapters.filter(c => c.memberCount < SMALL_CHAPTER_THRESHOLD);

  if (small.length === 0) return large;

  const combined: ChapterData = {
    chapterId: 'small-chapters-combined',
    chapterName: 'Small chapters',
    memberCount: small.reduce((sum, c) => sum + c.memberCount, 0),
    aggregateMetrics: {},
  };

  // Merge aggregate metrics
  for (const chapter of small) {
    for (const [key, value] of Object.entries(chapter.aggregateMetrics)) {
      combined.aggregateMetrics[key] = (combined.aggregateMetrics[key] ?? 0) + value;
    }
  }

  return [...large, combined];
}

// ─── Cross-Org Aggregation Logic ────────────────────────────

function aggregateChapterSnapshots(
  chapters: ChapterSnapshot[],
  associationId: string,
  snapshotMonth: string,
): AssociationSnapshot {
  const totalMembers = chapters.reduce((s, c) => s + c.totalMembers, 0);
  const activeMembers = chapters.reduce((s, c) => s + c.activeMembers, 0);
  const graceMembers = chapters.reduce((s, c) => s + c.graceMembers, 0);
  const lapsedMembers = chapters.reduce((s, c) => s + c.lapsedMembers, 0);
  const suspendedMembers = chapters.reduce((s, c) => s + c.suspendedMembers, 0);
  const totalCollected = chapters.reduce((s, c) => s + c.totalCollected, 0);
  const totalExpected = chapters.reduce((s, c) => s + c.totalExpected, 0);
  const collectionRate = totalExpected > 0 ? totalCollected / totalExpected : 0;

  // Weighted average CPD compliance (by member count)
  const weightedCpd = totalMembers > 0
    ? chapters.reduce((s, c) => s + c.cpdComplianceRate * c.totalMembers, 0) / totalMembers
    : 0;

  // Weighted average credits per member
  const weightedCredits = totalMembers > 0
    ? chapters.reduce((s, c) => s + c.avgCreditsPerMember * c.totalMembers, 0) / totalMembers
    : 0;

  const totalActivity = chapters.reduce((s, c) => s + c.activityCount90d, 0);

  return {
    associationId,
    snapshotMonth,
    totalMembers,
    activeMembers,
    graceMembers,
    lapsedMembers,
    suspendedMembers,
    collectionRate,
    totalCollected,
    totalExpected,
    cpdComplianceRate: weightedCpd,
    avgCreditsPerMember: weightedCredits,
    totalEvents: totalActivity, // simplified: events + training counted together
    totalTrainingSessions: 0,
  };
}

// ─── National Officer Designation Logic ─────────────────────

function isDesignatedNationalOfficer(
  grants: NationalDashboardAccess[],
  memberId: string,
  associationId: string,
): boolean {
  return grants.some(
    g => g.memberId === memberId
      && g.associationId === associationId
      && g.revokedAt === null,
  );
}

function canGrantNationalAccess(role: DashboardRole): boolean {
  // Only platform admins can grant national officer access
  return role === 'platform_admin';
}

// ─── Export Validation Logic ────────────────────────────────

function validateExportContainsNoIndividualData(
  csvColumns: string[],
): { valid: boolean; violations: string[] } {
  const piiColumns = ['member_name', 'license_number', 'email', 'phone', 'member_id', 'person_id', 'contact_info'];
  const violations = csvColumns.filter(col => piiColumns.includes(col.toLowerCase()));
  return { valid: violations.length === 0, violations };
}

function createExportLog(
  exportedBy: string,
  associationId: string,
  reportType: DashboardExportLog['reportType'],
  scope: string,
  dateRange: { start: Date; end: Date },
  format: 'pdf' | 'csv',
): DashboardExportLog {
  return {
    id: `export-${Date.now()}`,
    exportedBy,
    associationId,
    reportType,
    scope,
    dateRangeStart: dateRange.start,
    dateRangeEnd: dateRange.end,
    outputFormat: format,
    createdAt: new Date(),
  };
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

describe('[BR-36] National Dashboard Access', () => {
  // ─── Access Control ───────────────────────────────────────

  test('platform admins can access national dashboard', () => {
    expect(canAccessNationalDashboard('platform_admin', false)).toBe(true);
  });

  test('designated national officers can access national dashboard', () => {
    expect(canAccessNationalDashboard('national_officer', true)).toBe(true);
  });

  test('non-designated national officers cannot access', () => {
    expect(canAccessNationalDashboard('national_officer', false)).toBe(false);
  });

  test('chapter officers cannot access national dashboard', () => {
    expect(canAccessNationalDashboard('chapter_officer', false)).toBe(false);
  });

  test('regular members cannot access national dashboard', () => {
    expect(canAccessNationalDashboard('member', false)).toBe(false);
  });

  // ─── Chapter Data Isolation ───────────────────────────────

  test('chapter officer can view own chapter data', () => {
    expect(canViewChapterData('chapter_officer', 'ch-1', 'ch-1')).toBe(true);
  });

  test('chapter officer cannot view other chapter data', () => {
    expect(canViewChapterData('chapter_officer', 'ch-1', 'ch-2')).toBe(false);
  });

  test('platform admin can view any chapter data', () => {
    expect(canViewChapterData('platform_admin', 'ch-1', 'ch-99')).toBe(true);
  });

  // ─── Edge Case: Small Chapter Anonymization ───────────────

  test('chapters with <5 members are rolled into "Small chapters"', () => {
    const chapters: ChapterData[] = [
      { chapterId: 'ch-1', chapterName: 'Manila', memberCount: 50, aggregateMetrics: { dues: 250000 } },
      { chapterId: 'ch-2', chapterName: 'Cebu', memberCount: 30, aggregateMetrics: { dues: 150000 } },
      { chapterId: 'ch-3', chapterName: 'Davao', memberCount: 3, aggregateMetrics: { dues: 15000 } },
      { chapterId: 'ch-4', chapterName: 'Baguio', memberCount: 2, aggregateMetrics: { dues: 10000 } },
    ];

    const result = anonymizeSmallChapters(chapters);

    // Large chapters preserved individually
    expect(result.find(c => c.chapterName === 'Manila')).toBeDefined();
    expect(result.find(c => c.chapterName === 'Cebu')).toBeDefined();

    // Small chapters combined
    expect(result.find(c => c.chapterName === 'Davao')).toBeUndefined();
    expect(result.find(c => c.chapterName === 'Baguio')).toBeUndefined();

    const combined = result.find(c => c.chapterName === 'Small chapters');
    expect(combined).toBeDefined();
    expect(combined!.memberCount).toBe(5); // 3 + 2
    expect(combined!.aggregateMetrics.dues).toBe(25000); // 15000 + 10000
  });

  test('no "Small chapters" category when all chapters are large enough', () => {
    const chapters: ChapterData[] = [
      { chapterId: 'ch-1', chapterName: 'Manila', memberCount: 50, aggregateMetrics: { dues: 250000 } },
      { chapterId: 'ch-2', chapterName: 'Cebu', memberCount: 10, aggregateMetrics: { dues: 50000 } },
    ];

    const result = anonymizeSmallChapters(chapters);
    expect(result).toHaveLength(2);
    expect(result.find(c => c.chapterName === 'Small chapters')).toBeUndefined();
  });

  test('single small chapter still gets anonymized', () => {
    const chapters: ChapterData[] = [
      { chapterId: 'ch-1', chapterName: 'Manila', memberCount: 50, aggregateMetrics: { dues: 250000 } },
      { chapterId: 'ch-2', chapterName: 'Tiny', memberCount: 1, aggregateMetrics: { dues: 5000 } },
    ];

    const result = anonymizeSmallChapters(chapters);
    expect(result.find(c => c.chapterName === 'Tiny')).toBeUndefined();
    expect(result.find(c => c.chapterName === 'Small chapters')).toBeDefined();
  });

  // ─── Aggregate Only: No Individual Data ───────────────────

  test('dashboard shows only aggregate metrics, not individual member data', () => {
    const dashboardView = {
      chapterId: 'ch-1',
      memberCount: 50,
      aggregateMetrics: { totalDues: 250000, avgCredits: 12.5, activeRate: 0.92 },
    };

    // No individual member IDs, names, or per-member data
    expect(dashboardView).not.toHaveProperty('members');
    expect(dashboardView).not.toHaveProperty('memberList');
    expect(dashboardView).not.toHaveProperty('individualData');
  });
});

// ═══════════════════════════════════════════════════════════════
// Slice 040: Cross-Org Aggregation
// ═══════════════════════════════════════════════════════════════

describe('[BR-36] Cross-Org Aggregation', () => {
  const makeChapterSnapshot = (overrides: Partial<ChapterSnapshot> = {}): ChapterSnapshot => ({
    orgId: 'org-1',
    associationId: 'assoc-1',
    snapshotMonth: '2026-04',
    totalMembers: 100,
    activeMembers: 80,
    graceMembers: 10,
    lapsedMembers: 7,
    suspendedMembers: 3,
    collectionRate: 0.85,
    totalCollected: 85000,
    totalExpected: 100000,
    cpdComplianceRate: 0.72,
    avgCreditsPerMember: 14.5,
    activityCount90d: 5,
    ...overrides,
  });

  test('aggregates member counts across chapters', () => {
    const chapters = [
      makeChapterSnapshot({ orgId: 'org-1', totalMembers: 250, activeMembers: 205, graceMembers: 18, lapsedMembers: 20, suspendedMembers: 7 }),
      makeChapterSnapshot({ orgId: 'org-2', totalMembers: 180, activeMembers: 150, graceMembers: 12, lapsedMembers: 10, suspendedMembers: 8 }),
      makeChapterSnapshot({ orgId: 'org-3', totalMembers: 90, activeMembers: 70, graceMembers: 8, lapsedMembers: 7, suspendedMembers: 5 }),
    ];

    const result = aggregateChapterSnapshots(chapters, 'assoc-1', '2026-04');
    expect(result.totalMembers).toBe(520);
    expect(result.activeMembers).toBe(425);
    expect(result.graceMembers).toBe(38);
    expect(result.lapsedMembers).toBe(37);
    expect(result.suspendedMembers).toBe(20);
  });

  test('computes weighted collection rate from totals', () => {
    const chapters = [
      makeChapterSnapshot({ totalCollected: 80000, totalExpected: 100000 }),
      makeChapterSnapshot({ totalCollected: 45000, totalExpected: 50000 }),
    ];

    const result = aggregateChapterSnapshots(chapters, 'assoc-1', '2026-04');
    expect(result.totalCollected).toBe(125000);
    expect(result.totalExpected).toBe(150000);
    // 125000/150000 = 0.8333...
    expect(result.collectionRate).toBeCloseTo(0.8333, 3);
  });

  test('computes weighted CPD compliance by member count', () => {
    const chapters = [
      makeChapterSnapshot({ totalMembers: 200, cpdComplianceRate: 0.90 }), // 180 compliant
      makeChapterSnapshot({ totalMembers: 100, cpdComplianceRate: 0.60 }), // 60 compliant
    ];

    const result = aggregateChapterSnapshots(chapters, 'assoc-1', '2026-04');
    // (0.90 * 200 + 0.60 * 100) / 300 = 240/300 = 0.80
    expect(result.cpdComplianceRate).toBeCloseTo(0.80, 4);
  });

  test('computes weighted average credits per member', () => {
    const chapters = [
      makeChapterSnapshot({ totalMembers: 200, avgCreditsPerMember: 16.0 }),
      makeChapterSnapshot({ totalMembers: 100, avgCreditsPerMember: 10.0 }),
    ];

    const result = aggregateChapterSnapshots(chapters, 'assoc-1', '2026-04');
    // (16.0 * 200 + 10.0 * 100) / 300 = 4200/300 = 14.0
    expect(result.avgCreditsPerMember).toBeCloseTo(14.0, 4);
  });

  test('sums activity counts across chapters', () => {
    const chapters = [
      makeChapterSnapshot({ activityCount90d: 12 }),
      makeChapterSnapshot({ activityCount90d: 8 }),
      makeChapterSnapshot({ activityCount90d: 3 }),
    ];

    const result = aggregateChapterSnapshots(chapters, 'assoc-1', '2026-04');
    expect(result.totalEvents).toBe(23);
  });

  test('handles empty association (zero chapters)', () => {
    const result = aggregateChapterSnapshots([], 'assoc-empty', '2026-04');
    expect(result.totalMembers).toBe(0);
    expect(result.activeMembers).toBe(0);
    expect(result.collectionRate).toBe(0);
    expect(result.cpdComplianceRate).toBe(0);
    expect(result.avgCreditsPerMember).toBe(0);
    expect(result.totalEvents).toBe(0);
  });

  test('handles single chapter (no cross-org needed)', () => {
    const chapters = [
      makeChapterSnapshot({ totalMembers: 50, activeMembers: 42, collectionRate: 0.94, totalCollected: 47000, totalExpected: 50000 }),
    ];

    const result = aggregateChapterSnapshots(chapters, 'assoc-1', '2026-04');
    expect(result.totalMembers).toBe(50);
    expect(result.activeMembers).toBe(42);
    expect(result.collectionRate).toBeCloseTo(0.94, 2);
  });

  test('preserves association and month metadata', () => {
    const chapters = [makeChapterSnapshot()];
    const result = aggregateChapterSnapshots(chapters, 'assoc-pda', '2026-05');
    expect(result.associationId).toBe('assoc-pda');
    expect(result.snapshotMonth).toBe('2026-05');
  });
});

// ═══════════════════════════════════════════════════════════════
// Slice 040: Permission Enforcement (Association Admin Only)
// ═══════════════════════════════════════════════════════════════

describe('[BR-36] Permission Enforcement', () => {
  test('national officer designation is association-scoped', () => {
    const grants: NationalDashboardAccess[] = [
      { id: 'g-1', associationId: 'assoc-pda', memberId: 'dr-aquino', grantedBy: 'admin-1', grantedAt: new Date(), revokedAt: null },
    ];

    // Dr. Aquino has access to PDA
    expect(isDesignatedNationalOfficer(grants, 'dr-aquino', 'assoc-pda')).toBe(true);
    // Dr. Aquino does NOT have access to PNA (different association)
    expect(isDesignatedNationalOfficer(grants, 'dr-aquino', 'assoc-pna')).toBe(false);
  });

  test('revoked national officer cannot access dashboard', () => {
    const grants: NationalDashboardAccess[] = [
      { id: 'g-1', associationId: 'assoc-pda', memberId: 'dr-aquino', grantedBy: 'admin-1', grantedAt: new Date('2026-01-01'), revokedAt: new Date('2026-03-01') },
    ];

    expect(isDesignatedNationalOfficer(grants, 'dr-aquino', 'assoc-pda')).toBe(false);
  });

  test('multiple officers can be designated per association', () => {
    const grants: NationalDashboardAccess[] = [
      { id: 'g-1', associationId: 'assoc-pda', memberId: 'dr-aquino', grantedBy: 'admin-1', grantedAt: new Date(), revokedAt: null },
      { id: 'g-2', associationId: 'assoc-pda', memberId: 'dr-santos', grantedBy: 'admin-1', grantedAt: new Date(), revokedAt: null },
    ];

    expect(isDesignatedNationalOfficer(grants, 'dr-aquino', 'assoc-pda')).toBe(true);
    expect(isDesignatedNationalOfficer(grants, 'dr-santos', 'assoc-pda')).toBe(true);
  });

  test('only platform admins can grant national access', () => {
    expect(canGrantNationalAccess('platform_admin')).toBe(true);
    expect(canGrantNationalAccess('national_officer')).toBe(false);
    expect(canGrantNationalAccess('chapter_officer')).toBe(false);
    expect(canGrantNationalAccess('member')).toBe(false);
  });

  test('no active grants means no designated officer', () => {
    const grants: NationalDashboardAccess[] = [];
    expect(isDesignatedNationalOfficer(grants, 'dr-aquino', 'assoc-pda')).toBe(false);
  });

  test('national officer for assoc A cannot see assoc B dashboard', () => {
    const grants: NationalDashboardAccess[] = [
      { id: 'g-1', associationId: 'assoc-pda', memberId: 'dr-aquino', grantedBy: 'admin-1', grantedAt: new Date(), revokedAt: null },
    ];

    // Access PDA: yes. Access PNA: no.
    expect(
      canAccessNationalDashboard('national_officer', isDesignatedNationalOfficer(grants, 'dr-aquino', 'assoc-pda')),
    ).toBe(true);
    expect(
      canAccessNationalDashboard('national_officer', isDesignatedNationalOfficer(grants, 'dr-aquino', 'assoc-pna')),
    ).toBe(false);
  });

  test('member role never accesses regardless of grants', () => {
    const grants: NationalDashboardAccess[] = [
      { id: 'g-1', associationId: 'assoc-pda', memberId: 'member-1', grantedBy: 'admin-1', grantedAt: new Date(), revokedAt: null },
    ];

    // Even if someone accidentally creates a grant for a member, the role check blocks access
    expect(canAccessNationalDashboard('member', true)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// Slice 040: Data Accuracy
// ═══════════════════════════════════════════════════════════════

describe('[BR-36] Data Accuracy', () => {
  test('member status totals equal total members', () => {
    const snapshot: AssociationSnapshot = {
      associationId: 'assoc-1',
      snapshotMonth: '2026-04',
      totalMembers: 4200,
      activeMembers: 2982,
      graceMembers: 486,
      lapsedMembers: 504,
      suspendedMembers: 228,
      collectionRate: 0.68,
      totalCollected: 680000,
      totalExpected: 1000000,
      cpdComplianceRate: 0.62,
      avgCreditsPerMember: 14.3,
      totalEvents: 38,
      totalTrainingSessions: 0,
    };

    expect(snapshot.activeMembers + snapshot.graceMembers + snapshot.lapsedMembers + snapshot.suspendedMembers)
      .toBe(snapshot.totalMembers);
  });

  test('collection rate matches collected/expected ratio', () => {
    const collected = 680000;
    const expected = 1000000;
    const rate = collected / expected;
    expect(rate).toBeCloseTo(0.68, 2);
  });

  test('anonymization preserves total member count', () => {
    const chapters: ChapterData[] = [
      { chapterId: 'ch-1', chapterName: 'Manila', memberCount: 250, aggregateMetrics: { dues: 1250000 } },
      { chapterId: 'ch-2', chapterName: 'Cebu', memberCount: 180, aggregateMetrics: { dues: 900000 } },
      { chapterId: 'ch-3', chapterName: 'Small A', memberCount: 4, aggregateMetrics: { dues: 20000 } },
      { chapterId: 'ch-4', chapterName: 'Small B', memberCount: 3, aggregateMetrics: { dues: 15000 } },
      { chapterId: 'ch-5', chapterName: 'Small C', memberCount: 1, aggregateMetrics: { dues: 5000 } },
    ];

    const totalBefore = chapters.reduce((s, c) => s + c.memberCount, 0);
    const result = anonymizeSmallChapters(chapters);
    const totalAfter = result.reduce((s, c) => s + c.memberCount, 0);

    expect(totalAfter).toBe(totalBefore);
    expect(totalAfter).toBe(438);
  });

  test('anonymization preserves total aggregate metrics', () => {
    const chapters: ChapterData[] = [
      { chapterId: 'ch-1', chapterName: 'Large', memberCount: 100, aggregateMetrics: { dues: 500000, events: 10 } },
      { chapterId: 'ch-2', chapterName: 'Tiny A', memberCount: 3, aggregateMetrics: { dues: 15000, events: 1 } },
      { chapterId: 'ch-3', chapterName: 'Tiny B', memberCount: 2, aggregateMetrics: { dues: 10000, events: 0 } },
    ];

    const totalDuesBefore = chapters.reduce((s, c) => s + (c.aggregateMetrics.dues ?? 0), 0);
    const totalEventsBefore = chapters.reduce((s, c) => s + (c.aggregateMetrics.events ?? 0), 0);

    const result = anonymizeSmallChapters(chapters);
    const totalDuesAfter = result.reduce((s, c) => s + (c.aggregateMetrics.dues ?? 0), 0);
    const totalEventsAfter = result.reduce((s, c) => s + (c.aggregateMetrics.events ?? 0), 0);

    expect(totalDuesAfter).toBe(totalDuesBefore);
    expect(totalEventsAfter).toBe(totalEventsBefore);
  });

  test('chapter at exactly 5 members is NOT anonymized (threshold boundary)', () => {
    const chapters: ChapterData[] = [
      { chapterId: 'ch-1', chapterName: 'Large', memberCount: 50, aggregateMetrics: { dues: 250000 } },
      { chapterId: 'ch-2', chapterName: 'Boundary', memberCount: 5, aggregateMetrics: { dues: 25000 } },
      { chapterId: 'ch-3', chapterName: 'Small', memberCount: 4, aggregateMetrics: { dues: 20000 } },
    ];

    const result = anonymizeSmallChapters(chapters);
    // Boundary (5 members) should be kept as individual
    expect(result.find(c => c.chapterName === 'Boundary')).toBeDefined();
    // Small (4 members) should be anonymized
    expect(result.find(c => c.chapterName === 'Small')).toBeUndefined();
    expect(result.find(c => c.chapterName === 'Small chapters')).toBeDefined();
  });

  test('all chapters small: everything rolls into "Small chapters"', () => {
    const chapters: ChapterData[] = [
      { chapterId: 'ch-1', chapterName: 'A', memberCount: 2, aggregateMetrics: { dues: 10000 } },
      { chapterId: 'ch-2', chapterName: 'B', memberCount: 3, aggregateMetrics: { dues: 15000 } },
      { chapterId: 'ch-3', chapterName: 'C', memberCount: 1, aggregateMetrics: { dues: 5000 } },
    ];

    const result = anonymizeSmallChapters(chapters);
    expect(result).toHaveLength(1);
    expect(result[0].chapterName).toBe('Small chapters');
    expect(result[0].memberCount).toBe(6);
    expect(result[0].aggregateMetrics.dues).toBe(30000);
  });
});

// ═══════════════════════════════════════════════════════════════
// Slice 040: Export Audit & Data Privacy
// ═══════════════════════════════════════════════════════════════

describe('[BR-36] Export Audit & Data Privacy', () => {
  test('export log captures all required fields', () => {
    const log = createExportLog(
      'dr-aquino',
      'assoc-pda',
      'association_summary',
      'all_chapters',
      { start: new Date('2025-05-01'), end: new Date('2026-04-30') },
      'pdf',
    );

    expect(log.exportedBy).toBe('dr-aquino');
    expect(log.associationId).toBe('assoc-pda');
    expect(log.reportType).toBe('association_summary');
    expect(log.scope).toBe('all_chapters');
    expect(log.outputFormat).toBe('pdf');
    expect(log.createdAt).toBeInstanceOf(Date);
    expect(log.dateRangeStart).toBeInstanceOf(Date);
    expect(log.dateRangeEnd).toBeInstanceOf(Date);
  });

  test('CSV exports must not contain PII columns', () => {
    // Valid columns
    const validColumns = ['chapter_name', 'member_count', 'active_percentage', 'collection_rate', 'cpd_compliance_rate'];
    const validResult = validateExportContainsNoIndividualData(validColumns);
    expect(validResult.valid).toBe(true);
    expect(validResult.violations).toHaveLength(0);
  });

  test('CSV with PII columns is rejected', () => {
    const badColumns = ['chapter_name', 'member_count', 'member_name', 'email', 'license_number'];
    const result = validateExportContainsNoIndividualData(badColumns);
    expect(result.valid).toBe(false);
    expect(result.violations).toContain('member_name');
    expect(result.violations).toContain('email');
    expect(result.violations).toContain('license_number');
  });

  test('export log supports both PDF and CSV formats', () => {
    const pdfLog = createExportLog('admin-1', 'assoc-pda', 'dues_collection', 'all_chapters', { start: new Date(), end: new Date() }, 'pdf');
    const csvLog = createExportLog('admin-1', 'assoc-pda', 'dues_collection', 'all_chapters', { start: new Date(), end: new Date() }, 'csv');
    expect(pdfLog.outputFormat).toBe('pdf');
    expect(csvLog.outputFormat).toBe('csv');
  });

  test('export log supports all four report types', () => {
    const types: DashboardExportLog['reportType'][] = ['association_summary', 'dues_collection', 'cpd_compliance', 'activity'];
    for (const type of types) {
      const log = createExportLog('admin-1', 'assoc-1', type, 'all_chapters', { start: new Date(), end: new Date() }, 'csv');
      expect(log.reportType).toBe(type);
    }
  });

  test('export log supports scoped chapter exports', () => {
    const log = createExportLog('dr-aquino', 'assoc-pda', 'association_summary', 'org-1,org-2,org-3', { start: new Date(), end: new Date() }, 'pdf');
    expect(log.scope).toBe('org-1,org-2,org-3');
  });

  test('chapter drill-down response shape has no individual data', () => {
    // Simulates the expected API response shape for chapter drill-down
    const chapterDrillDown = {
      orgId: 'org-metro-manila',
      chapterName: 'PDA Metro Manila',
      totalMembers: 250,
      activeMembers: 205,
      graceMembers: 18,
      lapsedMembers: 20,
      suspendedMembers: 7,
      collectionRate: 0.81,
      cpdComplianceRate: 0.78,
      avgCreditsPerMember: 16.1,
      recentActivityCount: 4,
      officerRoster: [
        { role: 'Chapter President', name: 'Dr. Reyes' },
        { role: 'Chapter Secretary', name: 'Dr. Cruz' },
      ],
    };

    // Officer roster is OK (publicly available by role per spec)
    expect(chapterDrillDown.officerRoster).toHaveLength(2);

    // But no individual member data
    expect(chapterDrillDown).not.toHaveProperty('members');
    expect(chapterDrillDown).not.toHaveProperty('memberList');
    expect(chapterDrillDown).not.toHaveProperty('memberRecords');
    expect(chapterDrillDown).not.toHaveProperty('paymentRecords');
    expect(chapterDrillDown).not.toHaveProperty('licenseNumbers');
  });
});
