/**
 * getNationalDashboard
 *
 * Returns cross-chapter aggregate metrics for a national association dashboard.
 *
 * BR-36: Accessible to platform admins and designated national officers only.
 * M14-R2: Chapters with <5 members are suppressed into a "Small chapters" combined category.
 * No individual member-level data is exposed.
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { DashboardRepository } from './repos/dashboard.repo';
import { auditAction } from '@/utils/audit';

const SMALL_CHAPTER_THRESHOLD = 5;

interface ChapterEntry {
  orgId: string;
  chapterName?: string;
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
  activityCount90d: number;
}

function anonymizeSmallChapters(chapters: ChapterEntry[]): ChapterEntry[] {
  const large = chapters.filter((c) => c.totalMembers >= SMALL_CHAPTER_THRESHOLD);
  const small = chapters.filter((c) => c.totalMembers < SMALL_CHAPTER_THRESHOLD);

  if (small.length === 0) return large;

  const combined: ChapterEntry = {
    orgId: 'small-chapters-combined',
    chapterName: 'Small chapters',
    totalMembers: small.reduce((s, c) => s + c.totalMembers, 0),
    activeMembers: small.reduce((s, c) => s + c.activeMembers, 0),
    graceMembers: small.reduce((s, c) => s + c.graceMembers, 0),
    lapsedMembers: small.reduce((s, c) => s + c.lapsedMembers, 0),
    suspendedMembers: small.reduce((s, c) => s + c.suspendedMembers, 0),
    totalCollected: small.reduce((s, c) => s + c.totalCollected, 0),
    totalExpected: small.reduce((s, c) => s + c.totalExpected, 0),
    collectionRate: 0,
    cpdComplianceRate: 0,
    avgCreditsPerMember: 0,
    activityCount90d: small.reduce((s, c) => s + c.activityCount90d, 0),
  };

  // Compute rates for the combined small-chapter bucket
  if (combined.totalExpected > 0) {
    combined.collectionRate = combined.totalCollected / combined.totalExpected;
  }
  if (combined.totalMembers > 0) {
    combined.cpdComplianceRate =
      small.reduce((s, c) => s + c.cpdComplianceRate * c.totalMembers, 0) / combined.totalMembers;
    combined.avgCreditsPerMember =
      small.reduce((s, c) => s + c.avgCreditsPerMember * c.totalMembers, 0) / combined.totalMembers;
  }

  return [...large, combined];
}

export async function getNationalDashboard(ctx: Context): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const associationId = ctx.req.param('associationId');
  const snapshotMonth = ctx.req.query('snapshotMonth') ?? new Date().toISOString().slice(0, 7);

  if (!associationId) {
    return ctx.json({ error: 'associationId is required' }, 400);
  }

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new DashboardRepository(db, logger);

  // ── Access control (BR-36) ───────────────────────────────────────────────
  const user = session.user as { id?: string; role?: string } | undefined;
  const isPlatformAdmin = user?.role === 'platform_admin' || user?.role === 'super';

  if (!isPlatformAdmin) {
    const memberId = user?.id;
    if (!memberId) return ctx.json({ error: 'Forbidden' }, 403);

    const isOfficer = await repo.isDesignatedNationalOfficer(memberId, associationId);
    if (!isOfficer) {
      return ctx.json({ error: 'Forbidden: national dashboard access requires platform admin or designated national officer role' }, 403);
    }
  }

  // ── Fetch chapter snapshots ──────────────────────────────────────────────
  const snapshots = await repo.listChapterSnapshots(associationId, snapshotMonth);

  const chapters: ChapterEntry[] = snapshots.map((s) => ({
    orgId: s.orgId,
    totalMembers: s.totalMembers,
    activeMembers: s.activeMembers ?? 0,
    graceMembers: s.graceMembers ?? 0,
    lapsedMembers: s.lapsedMembers ?? 0,
    suspendedMembers: s.suspendedMembers ?? 0,
    collectionRate: Number(s.collectionRate ?? 0),
    totalCollected: Number(s.totalCollected ?? 0),
    totalExpected: Number(s.totalExpected ?? 0),
    cpdComplianceRate: Number(s.cpdComplianceRate ?? 0),
    avgCreditsPerMember: Number(s.avgCreditsPerMember ?? 0),
    activityCount90d: s.activityCount90d ?? 0,
  }));

  // ── M14-R2: suppress small chapters ─────────────────────────────────────
  const visibleChapters = anonymizeSmallChapters(chapters);

  // ── Association-level aggregate ──────────────────────────────────────────
  const aggregate = await repo.getAssociationAggregate(associationId, snapshotMonth);

  // ── Audit ────────────────────────────────────────────────────────────────
  await auditAction(ctx, {
    action: 'create',
    resourceType: 'national_dashboard_view',
    resourceId: associationId,
    description: `National dashboard viewed for association ${associationId} (${snapshotMonth})`,
    details: { snapshotMonth, chapterCount: visibleChapters.length },
  });

  return ctx.json({
    data: {
      associationId,
      snapshotMonth,
      aggregate,
      chapters: visibleChapters,
    },
  }, 200);
}
