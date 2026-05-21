import { eq, and, desc, sql, ne } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  feedPosts,
  feedPostReactions,
  feedPostReports,
  feedMutedAuthors,
  type FeedPost,
  type NewFeedPost,
  type FeedPostReaction,
  type NewFeedPostReaction,
  type NewFeedPostReport,
  type NewFeedMutedAuthor,
} from './feed-post.schema';

export class FeedPostRepository {
  constructor(private db: DatabaseInstance) {}

  async list(orgId: string, filters?: { limit?: number; offset?: number }) {
    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(feedPosts)
        .where(and(eq(feedPosts.organizationId, orgId), eq(feedPosts.isRemoved, false)))
        .orderBy(desc(feedPosts.createdAt))
        .limit(filters?.limit ?? 20)
        .offset(filters?.offset ?? 0),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(feedPosts)
        .where(and(eq(feedPosts.organizationId, orgId), eq(feedPosts.isRemoved, false))),
    ]);
    return { data, total: countResult[0]?.count ?? 0 };
  }

  async get(id: string): Promise<FeedPost | undefined> {
    const [post] = await this.db.select().from(feedPosts).where(eq(feedPosts.id, id)).limit(1);
    return post;
  }

  async create(data: NewFeedPost): Promise<FeedPost> {
    const [result] = await this.db.insert(feedPosts).values(data).returning();
    return result!;
  }

  async update(id: string, data: Partial<FeedPost>): Promise<FeedPost> {
    const [result] = await this.db
      .update(feedPosts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(feedPosts.id, id))
      .returning();
    return result!;
  }

  async softDelete(id: string, removedBy: string, reason?: string): Promise<FeedPost> {
    const [result] = await this.db
      .update(feedPosts)
      .set({
        isRemoved: true,
        removedBy,
        removedReason: reason ?? null,
        status: 'removed',
        updatedAt: new Date(),
      })
      .where(eq(feedPosts.id, id))
      .returning();
    return result!;
  }

  async pin(id: string, orgId: string): Promise<FeedPost> {
    // Unpin any currently pinned post in this org
    await this.db
      .update(feedPosts)
      .set({ isPinned: false, updatedAt: new Date() })
      .where(and(eq(feedPosts.organizationId, orgId), eq(feedPosts.isPinned, true), ne(feedPosts.id, id)));

    const [result] = await this.db
      .update(feedPosts)
      .set({ isPinned: true, updatedAt: new Date() })
      .where(eq(feedPosts.id, id))
      .returning();
    return result!;
  }

  async addReaction(data: NewFeedPostReaction): Promise<FeedPostReaction> {
    const [result] = await this.db.insert(feedPostReactions).values(data).returning();
    return result!;
  }

  async removeReaction(postId: string, memberId: string): Promise<void> {
    await this.db
      .delete(feedPostReactions)
      .where(and(eq(feedPostReactions.postId, postId), eq(feedPostReactions.memberId, memberId)));
  }

  async addReport(data: NewFeedPostReport): Promise<void> {
    await this.db.insert(feedPostReports).values(data);
    await this.db
      .update(feedPosts)
      .set({
        reportCount: sql`${feedPosts.reportCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(feedPosts.id, data.postId));
  }

  async getReportCount(postId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(feedPostReports)
      .where(eq(feedPostReports.postId, postId));
    return result?.count ?? 0;
  }

  async muteAuthor(data: NewFeedMutedAuthor): Promise<void> {
    await this.db.insert(feedMutedAuthors).values(data);
  }

  async unmuteAuthor(memberId: string, mutedAuthorId: string, orgId: string): Promise<void> {
    await this.db
      .delete(feedMutedAuthors)
      .where(
        and(
          eq(feedMutedAuthors.memberId, memberId),
          eq(feedMutedAuthors.mutedAuthorId, mutedAuthorId),
          eq(feedMutedAuthors.organizationId, orgId),
        ),
      );
  }

  async getMutedAuthors(memberId: string, orgId: string): Promise<string[]> {
    const rows = await this.db
      .select({ mutedAuthorId: feedMutedAuthors.mutedAuthorId })
      .from(feedMutedAuthors)
      .where(and(eq(feedMutedAuthors.memberId, memberId), eq(feedMutedAuthors.organizationId, orgId)));
    return rows.map((r) => r.mutedAuthorId);
  }
}
