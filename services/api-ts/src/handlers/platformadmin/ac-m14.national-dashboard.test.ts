/**
 * AC-M14: National Dashboard Module — Pure Domain Logic Tests
 *
 * Covers:
 *   AC-M14-001: National aggregation — cross-chapter metrics aggregated correctly
 *   AC-M14-002: Access scoping — national officers see own association only
 *   AC-M14-003: Privacy suppression — chapters <5 members combined into "Small chapters"
 *   AC-M14-004: Export audit — all exports logged with who/when/what
 *   AC-M14-005: Data accuracy — member status totals equal total members
 */
import { describe, test, expect } from 'bun:test';

// ─── Domain Types ─────────────────────────────────────────

type UserRole = 'national_officer' | 'platform_admin' | 'chapter_officer' | 'member';

interface ChapterSnapshot {
  organizationId: string;
  associationId: string;
  name: string;
  totalMembers: number;
  activeMembers: number;
  graceMembers: number;
  lapsedMembers: number;
  suspendedMembers: number;
  collectionRatePct: number; // 0-100
  creditCompliancePct: number; // 0-100
  totalRevenueCents: number;
  eventCount: number;
}

interface AssociationSummary {
  associationId: string;
  totalMembers: number;
  activeMembers: number;
  avgCollectionRatePct: number;
  avgCreditCompliancePct: number;
  totalRevenueCents: number;
  chapterCount: number;
}

interface ExportAuditLog {
  exportedBy: string;
  associationId: string;
  format: 'csv' | 'pdf';
  exportedAt: Date;
  rowCount: number;
}

interface AccessContext {
  userId: string;
  role: UserRole;
  associationId: string | null; // null for platform_admin (cross-association)
}

// ─── Domain Functions ─────────────────────────────────────

/**
 * AC-M14-001: Aggregate chapter snapshots into association-level summary.
 */
function aggregateAssociationMetrics(chapters: ChapterSnapshot[]): AssociationSummary {
  if (chapters.length === 0) {
    return {
      associationId: '',
      totalMembers: 0,
      activeMembers: 0,
      avgCollectionRatePct: 0,
      avgCreditCompliancePct: 0,
      totalRevenueCents: 0,
      chapterCount: 0,
    };
  }

  const associationId = chapters[0].associationId;
  const totalMembers = chapters.reduce((sum, c) => sum + c.totalMembers, 0);
  const activeMembers = chapters.reduce((sum, c) => sum + c.activeMembers, 0);
  const totalRevenueCents = chapters.reduce((sum, c) => sum + c.totalRevenueCents, 0);
  const avgCollectionRatePct =
    chapters.reduce((sum, c) => sum + c.collectionRatePct, 0) / chapters.length;
  const avgCreditCompliancePct =
    chapters.reduce((sum, c) => sum + c.creditCompliancePct, 0) / chapters.length;

  return {
    associationId,
    totalMembers,
    activeMembers,
    avgCollectionRatePct,
    avgCreditCompliancePct,
    totalRevenueCents,
    chapterCount: chapters.length,
  };
}

/**
 * AC-M14-002: Access scoping — national officers can only see their own association.
 */
function assertDashboardAccess(
  ctx: AccessContext,
  requestedAssociationId: string,
): { ok: true } | { ok: false; error: string } {
  if (ctx.role === 'platform_admin') {
    // Platform admin sees all associations
    return { ok: true };
  }

  if (ctx.role === 'national_officer') {
    if (ctx.associationId !== requestedAssociationId) {
      return {
        ok: false,
        error: 'National officers can only view their own association dashboard.',
      };
    }
    return { ok: true };
  }

  return {
    ok: false,
    error: 'National officer access required.',
  };
}

/**
 * AC-M14-003: Privacy suppression — chapters with < 5 members get suppressed metrics.
 */
const PRIVACY_THRESHOLD = 5;

interface DisplayChapter {
  organizationId: string | null; // null when suppressed/combined
  name: string;
  totalMembers: number;
  suppressed: boolean;
  metrics: Partial<ChapterSnapshot> | null;
}

function applyPrivacySuppression(chapters: ChapterSnapshot[]): DisplayChapter[] {
  const visible: DisplayChapter[] = [];
  let suppressedTotal = 0;
  let suppressedCount = 0;

  for (const chapter of chapters) {
    if (chapter.totalMembers < PRIVACY_THRESHOLD) {
      suppressedTotal += chapter.totalMembers;
      suppressedCount++;
    } else {
      visible.push({
        organizationId: chapter.organizationId,
        name: chapter.name,
        totalMembers: chapter.totalMembers,
        suppressed: false,
        metrics: chapter,
      });
    }
  }

  if (suppressedCount > 0) {
    visible.push({
      organizationId: null,
      name: 'Small chapters',
      totalMembers: suppressedTotal,
      suppressed: true,
      metrics: null,
    });
  }

  return visible;
}

/**
 * AC-M14-004: Log export action for audit trail.
 */
function recordExportAudit(
  exportedBy: string,
  associationId: string,
  format: 'csv' | 'pdf',
  rowCount: number,
  now: Date,
): ExportAuditLog {
  return { exportedBy, associationId, format, exportedAt: now, rowCount };
}

/**
 * AC-M14-005: Member status totals must equal totalMembers.
 */
function validateMemberStatusTotals(
  snapshot: ChapterSnapshot,
): { ok: true } | { ok: false; error: string; expected: number; actual: number } {
  const actual =
    snapshot.activeMembers +
    snapshot.graceMembers +
    snapshot.lapsedMembers +
    snapshot.suspendedMembers;

  if (actual !== snapshot.totalMembers) {
    return {
      ok: false,
      error: `Status totals (${actual}) do not match totalMembers (${snapshot.totalMembers}).`,
      expected: snapshot.totalMembers,
      actual,
    };
  }

  return { ok: true };
}

// ─── Helpers ──────────────────────────────────────────────

function makeChapter(overrides: Partial<ChapterSnapshot> = {}): ChapterSnapshot {
  return {
    organizationId: 'org-1',
    associationId: 'assoc-1',
    name: 'Chapter A',
    totalMembers: 100,
    activeMembers: 80,
    graceMembers: 10,
    lapsedMembers: 7,
    suspendedMembers: 3,
    collectionRatePct: 85,
    creditCompliancePct: 90,
    totalRevenueCents: 500_000,
    eventCount: 5,
    ...overrides,
  };
}

function makeCtx(role: UserRole, associationId: string | null = 'assoc-1'): AccessContext {
  return { userId: 'user-1', role, associationId };
}

// ─── AC-M14-001: National Aggregation ─────────────────────

describe('[AC-M14-001] National aggregation — cross-chapter metrics', () => {
  test('sums member counts across all chapters', () => {
    const chapters = [
      makeChapter({ organizationId: 'org-1', totalMembers: 100, activeMembers: 80 }),
      makeChapter({ organizationId: 'org-2', totalMembers: 200, activeMembers: 160 }),
      makeChapter({ organizationId: 'org-3', totalMembers: 50, activeMembers: 40 }),
    ];
    const summary = aggregateAssociationMetrics(chapters);
    expect(summary.totalMembers).toBe(350);
    expect(summary.activeMembers).toBe(280);
    expect(summary.chapterCount).toBe(3);
  });

  test('sums revenue across chapters', () => {
    const chapters = [
      makeChapter({ totalRevenueCents: 100_000 }),
      makeChapter({ organizationId: 'org-2', totalRevenueCents: 200_000 }),
    ];
    const summary = aggregateAssociationMetrics(chapters);
    expect(summary.totalRevenueCents).toBe(300_000);
  });

  test('averages collection rate correctly', () => {
    const chapters = [
      makeChapter({ collectionRatePct: 80 }),
      makeChapter({ organizationId: 'org-2', collectionRatePct: 100 }),
    ];
    const summary = aggregateAssociationMetrics(chapters);
    expect(summary.avgCollectionRatePct).toBe(90);
  });

  test('empty chapters return zeroed summary', () => {
    const summary = aggregateAssociationMetrics([]);
    expect(summary.totalMembers).toBe(0);
    expect(summary.chapterCount).toBe(0);
  });
});

// ─── AC-M14-002: Access Scoping ───────────────────────────

describe('[AC-M14-002] Access scoping — national officers see own association only', () => {
  test('national officer can access own association', () => {
    const ctx = makeCtx('national_officer', 'assoc-1');
    const result = assertDashboardAccess(ctx, 'assoc-1');
    expect(result.ok).toBe(true);
  });

  test('national officer cannot access another association', () => {
    const ctx = makeCtx('national_officer', 'assoc-1');
    const result = assertDashboardAccess(ctx, 'assoc-2');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('own association');
    }
  });

  test('platform admin can access any association', () => {
    const ctx = makeCtx('platform_admin', null);
    const result = assertDashboardAccess(ctx, 'assoc-2');
    expect(result.ok).toBe(true);
  });

  test('chapter officer cannot access national dashboard', () => {
    const ctx = makeCtx('chapter_officer', 'assoc-1');
    const result = assertDashboardAccess(ctx, 'assoc-1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('National officer');
    }
  });
});

// ─── AC-M14-003: Privacy Suppression ─────────────────────

describe('[AC-M14-003] Privacy suppression — chapters <5 members combined', () => {
  test('chapter with >=5 members shown normally', () => {
    const chapters = [makeChapter({ totalMembers: 10, name: 'Big Chapter' })];
    const result = applyPrivacySuppression(chapters);
    expect(result).toHaveLength(1);
    expect(result[0].suppressed).toBe(false);
    expect(result[0].name).toBe('Big Chapter');
    expect(result[0].metrics).not.toBeNull();
  });

  test('chapter with <5 members merged into "Small chapters"', () => {
    const chapters = [
      makeChapter({ organizationId: 'org-1', totalMembers: 3, name: 'Tiny A' }),
      makeChapter({ organizationId: 'org-2', totalMembers: 4, name: 'Tiny B' }),
    ];
    const result = applyPrivacySuppression(chapters);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Small chapters');
    expect(result[0].suppressed).toBe(true);
    expect(result[0].totalMembers).toBe(7);
    expect(result[0].metrics).toBeNull();
    expect(result[0].organizationId).toBeNull();
  });

  test('mix of large and small chapters — small combined, large shown', () => {
    const chapters = [
      makeChapter({ organizationId: 'org-1', totalMembers: 50, name: 'Main Chapter' }),
      makeChapter({ organizationId: 'org-2', totalMembers: 2, name: 'Micro A' }),
      makeChapter({ organizationId: 'org-3', totalMembers: 3, name: 'Micro B' }),
    ];
    const result = applyPrivacySuppression(chapters);
    // 1 large + 1 combined small
    expect(result).toHaveLength(2);
    const large = result.find((r) => !r.suppressed);
    const small = result.find((r) => r.suppressed);
    expect(large?.name).toBe('Main Chapter');
    expect(small?.totalMembers).toBe(5);
  });

  test('chapter with exactly 5 members is NOT suppressed', () => {
    const chapters = [makeChapter({ totalMembers: 5 })];
    const result = applyPrivacySuppression(chapters);
    expect(result[0].suppressed).toBe(false);
  });
});

// ─── AC-M14-004: Export Audit ─────────────────────────────

describe('[AC-M14-004] Export audit — exports logged with who/when/what', () => {
  test('export audit log captures all required fields', () => {
    const now = new Date('2026-06-01T09:00:00Z');
    const log = recordExportAudit('user-national-1', 'assoc-1', 'csv', 350, now);
    expect(log.exportedBy).toBe('user-national-1');
    expect(log.associationId).toBe('assoc-1');
    expect(log.format).toBe('csv');
    expect(log.rowCount).toBe(350);
    expect(log.exportedAt).toEqual(now);
  });

  test('pdf export is also logged', () => {
    const now = new Date();
    const log = recordExportAudit('user-1', 'assoc-2', 'pdf', 100, now);
    expect(log.format).toBe('pdf');
  });

  test('export log timestamp is exact request time', () => {
    const before = new Date();
    const now = new Date();
    const log = recordExportAudit('user-1', 'assoc-1', 'csv', 0, now);
    expect(log.exportedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});

// ─── AC-M14-005: Data Accuracy ────────────────────────────

describe('[AC-M14-005] Data accuracy — status totals equal totalMembers', () => {
  test('snapshot with consistent status totals passes validation', () => {
    const snapshot = makeChapter({
      totalMembers: 100,
      activeMembers: 80,
      graceMembers: 10,
      lapsedMembers: 7,
      suspendedMembers: 3,
    });
    const result = validateMemberStatusTotals(snapshot);
    expect(result.ok).toBe(true);
  });

  test('snapshot with incorrect status totals fails validation', () => {
    const snapshot = makeChapter({
      totalMembers: 100,
      activeMembers: 80,
      graceMembers: 10,
      lapsedMembers: 5, // 80+10+5+3 = 98, not 100
      suspendedMembers: 3,
    });
    const result = validateMemberStatusTotals(snapshot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.expected).toBe(100);
      expect(result.actual).toBe(98);
    }
  });

  test('zero-member chapter is consistent', () => {
    const snapshot = makeChapter({
      totalMembers: 0,
      activeMembers: 0,
      graceMembers: 0,
      lapsedMembers: 0,
      suspendedMembers: 0,
    });
    const result = validateMemberStatusTotals(snapshot);
    expect(result.ok).toBe(true);
  });
});
