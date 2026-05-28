/**
 * Repository for National Dashboard module (M14).
 * Handles chapter snapshots, national officer access grants, and export logs.
 */

import { eq, and, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Logger } from '@/types/logger';
import {
  chapterSnapshots,
  nationalDashboardAccess,
  dashboardExportLogs,
  type ChapterSnapshot,
  type NewChapterSnapshot,
  type NationalDashboardAccess,
  type NewNationalDashboardAccess,
  type DashboardExportLog,
  type NewDashboardExportLog,
} from './dashboard-snapshot.schema';

// ---------------------------------------------------------------------------
// Aggregate shape returned by getAssociationAggregate
// ---------------------------------------------------------------------------

export interface AssociationAggregate {
  associationId: string;
  snapshotMonth: string;
  chapterCount: number;
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
  totalActivityCount90d: number;
}

export class DashboardRepository {
  constructor(private db: NodePgDatabase, private logger?: Logger) {}

  // ── Chapter Snapshots ────────────────────────────────────────────────────

  async listChapterSnapshots(associationId: string, snapshotMonth: string): Promise<ChapterSnapshot[]> {
    return this.db
      .select()
      .from(chapterSnapshots)
      .where(
        and(
          eq(chapterSnapshots.associationId, associationId),
          eq(chapterSnapshots.snapshotMonth, snapshotMonth),
        ),
      )
      .limit(200);
  }

  async createChapterSnapshot(data: NewChapterSnapshot): Promise<ChapterSnapshot> {
    const [row] = await this.db.insert(chapterSnapshots).values(data).returning();
    return row!;
  }

  /**
   * Compute cross-chapter aggregate for an association in a given month.
   * Uses weighted averages for rate fields (by totalMembers).
   */
  async getAssociationAggregate(
    associationId: string,
    snapshotMonth: string,
  ): Promise<AssociationAggregate> {
    const rows = await this.listChapterSnapshots(associationId, snapshotMonth);

    const totalMembers = rows.reduce((s, r) => s + r.totalMembers, 0);
    const activeMembers = rows.reduce((s, r) => s + (r.activeMembers ?? 0), 0);
    const graceMembers = rows.reduce((s, r) => s + (r.graceMembers ?? 0), 0);
    const lapsedMembers = rows.reduce((s, r) => s + (r.lapsedMembers ?? 0), 0);
    const suspendedMembers = rows.reduce((s, r) => s + (r.suspendedMembers ?? 0), 0);
    const totalCollected = rows.reduce((s, r) => s + Number(r.totalCollected ?? 0), 0);
    const totalExpected = rows.reduce((s, r) => s + Number(r.totalExpected ?? 0), 0);
    const collectionRate = totalExpected > 0 ? totalCollected / totalExpected : 0;

    // Weighted averages by totalMembers
    const cpdComplianceRate =
      totalMembers > 0
        ? rows.reduce((s, r) => s + Number(r.cpdComplianceRate ?? 0) * r.totalMembers, 0) / totalMembers
        : 0;

    const avgCreditsPerMember =
      totalMembers > 0
        ? rows.reduce((s, r) => s + Number(r.avgCreditsPerMember ?? 0) * r.totalMembers, 0) / totalMembers
        : 0;

    const totalActivityCount90d = rows.reduce((s, r) => s + (r.activityCount90d ?? 0), 0);

    return {
      associationId,
      snapshotMonth,
      chapterCount: rows.length,
      totalMembers,
      activeMembers,
      graceMembers,
      lapsedMembers,
      suspendedMembers,
      collectionRate,
      totalCollected,
      totalExpected,
      cpdComplianceRate,
      avgCreditsPerMember,
      totalActivityCount90d,
    };
  }

  // ── National Officer Access ──────────────────────────────────────────────

  /**
   * BR-36: Check if a member holds an active (not revoked) national dashboard
   * access grant for the given association.
   */
  async isDesignatedNationalOfficer(memberId: string, associationId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: nationalDashboardAccess.id })
      .from(nationalDashboardAccess)
      .where(
        and(
          eq(nationalDashboardAccess.memberId, memberId),
          eq(nationalDashboardAccess.associationId, associationId),
          isNull(nationalDashboardAccess.revokedAt),
        ),
      )
      .limit(1);
    return !!row;
  }

  async grantNationalAccess(data: NewNationalDashboardAccess): Promise<NationalDashboardAccess> {
    const [row] = await this.db.insert(nationalDashboardAccess).values(data).returning();
    return row!;
  }

  async revokeNationalAccess(id: string): Promise<NationalDashboardAccess | undefined> {
    const [row] = await this.db
      .update(nationalDashboardAccess)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(nationalDashboardAccess.id, id))
      .returning();
    return row;
  }

  // ── Export Logs ──────────────────────────────────────────────────────────

  async createExportLog(data: NewDashboardExportLog): Promise<DashboardExportLog> {
    const [row] = await this.db.insert(dashboardExportLogs).values(data).returning();
    return row!;
  }
}
