import { eq, and, desc, like, sql, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { announcements, announcementStats, type Announcement, type NewAnnouncement, type AnnouncementStats } from './communications.schema';

export class CommunicationsRepository {
  constructor(private db: DatabaseInstance) {}

  async list(orgId: string, filters?: { status?: string; search?: string; limit?: number; offset?: number }) {
    const conditions: SQL<unknown>[] = [eq(announcements.organizationId, orgId)];
    if (filters?.status) conditions.push(eq(announcements.status, filters.status as any));
    if (filters?.search) conditions.push(like(announcements.title, `%${filters.search}%`));

    const [data, countResult] = await Promise.all([
      this.db.select().from(announcements)
        .where(and(...conditions))
        .orderBy(desc(announcements.createdAt))
        .limit(filters?.limit ?? 20)
        .offset(filters?.offset ?? 0),
      this.db.select({ count: sql<number>`count(*)::int` }).from(announcements).where(and(...conditions)),
    ]);
    return { data, total: countResult[0]?.count ?? 0 };
  }

  async get(id: string): Promise<(Announcement & { stats?: AnnouncementStats }) | undefined> {
    const [announcement] = await this.db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
    if (!announcement) return undefined;
    const [stats] = await this.db.select().from(announcementStats).where(eq(announcementStats.announcementId, id)).limit(1);
    return { ...announcement, stats: stats ?? undefined };
  }

  async create(data: NewAnnouncement): Promise<Announcement> {
    const [result] = await this.db.insert(announcements).values(data).returning();
    return result!;
  }

  async updateStatus(id: string, status: string, extra?: Partial<Announcement>): Promise<Announcement> {
    const [result] = await this.db.update(announcements)
      .set({ status: status as any, ...extra, updatedAt: new Date() })
      .where(eq(announcements.id, id)).returning();
    return result!;
  }

  async update(id: string, data: Partial<Announcement>): Promise<Announcement> {
    const [result] = await this.db.update(announcements)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(announcements.id, id)).returning();
    return result!;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(announcements).where(eq(announcements.id, id));
  }

  async createStats(announcementId: string, recipients: number, organizationId: string) {
    await this.db.insert(announcementStats).values({ announcementId, recipients, organizationId });
  }

  async getStats(orgId: string) {
    const [stats] = await this.db.select({
      totalThisMonth: sql<number>`count(CASE WHEN ${announcements.publishedAt} >= date_trunc('month', NOW()) THEN 1 END)::int`,
      totalRecipients: sql<number>`COALESCE(SUM(CASE WHEN ${announcements.status} = 'sent' THEN 1 ELSE 0 END), 0)::int`,
    }).from(announcements).where(eq(announcements.organizationId, orgId));
    return stats;
  }
}
