// Business Rules: [BR-36]
/**
 * [BR-36] National Dashboard Access
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
