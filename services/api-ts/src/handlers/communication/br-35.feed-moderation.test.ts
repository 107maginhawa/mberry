// Business Rules: [BR-35]
/**
 * [BR-35] Feed Content Moderation
 *
 * BR-35: "Officers can remove posts and comments from the professional feed
 * within their own org's context. Platform admins can remove content from any
 * org's feed. Members can report content for officer review. Reported content
 * remains visible to officers (flagged) while under review. All content removed
 * for policy violations is logged with the removal reason in the audit trail."
 *
 * Edge case: "A member whose post is removed receives an in-app notification
 * that their content was removed and the reason given. They are not shown who
 * reported it."
 */

import { describe, test, expect } from 'bun:test';

// ─── Pure rule functions (will be extracted to module when M13 is built) ───

type Role = 'member' | 'officer' | 'platform_admin';

interface FeedPost {
  id: string;
  authorId: string;
  organizationId: string;
  content: string;
  status: 'published' | 'flagged' | 'removed';
  reportedBy?: string[];
  removedReason?: string;
  removedBy?: string;
}

function canRemovePost(
  role: Role,
  userOrgId: string,
  post: FeedPost,
): boolean {
  if (role === 'platform_admin') return true;
  if (role === 'officer' && userOrgId === post.organizationId) return true;
  return false;
}

function reportPost(post: FeedPost, reporterId: string): FeedPost {
  return {
    ...post,
    status: 'flagged',
    reportedBy: [...(post.reportedBy ?? []), reporterId],
  };
}

function removePost(
  post: FeedPost,
  removedBy: string,
  reason: string,
): { post: FeedPost; auditEntry: object; notification: object } {
  return {
    post: {
      ...post,
      status: 'removed',
      removedReason: reason,
      removedBy,
    },
    auditEntry: {
      action: 'content_removed',
      postId: post.id,
      removedBy,
      reason,
      organizationId: post.organizationId,
      timestamp: new Date().toISOString(),
    },
    notification: {
      recipientId: post.authorId,
      type: 'content_removed',
      reason,
      // No reporter identity exposed
    },
  };
}

describe('[BR-35] Feed Content Moderation', () => {
  const basePost: FeedPost = {
    id: 'post-1',
    authorId: 'member-1',
    organizationId: 'org-1',
    content: 'Hello world',
    status: 'published',
  };

  // ─── Officer Removal: Own Org Only ─────────────────────────

  test('officer can remove posts within own org', () => {
    expect(canRemovePost('officer', 'org-1', basePost)).toBe(true);
  });

  test('officer cannot remove posts from other orgs', () => {
    expect(canRemovePost('officer', 'org-2', basePost)).toBe(false);
  });

  // ─── Platform Admin: Any Org ───────────────────────────────

  test('platform admin can remove posts from any org', () => {
    expect(canRemovePost('platform_admin', 'org-99', basePost)).toBe(true);
  });

  // ─── Members: Report Only ─────────────────────────────────

  test('members cannot remove posts', () => {
    expect(canRemovePost('member', 'org-1', basePost)).toBe(false);
  });

  test('member can report content — post becomes flagged', () => {
    const reported = reportPost(basePost, 'member-2');
    expect(reported.status).toBe('flagged');
    expect(reported.reportedBy).toContain('member-2');
  });

  test('flagged content remains visible to officers for review', () => {
    const reported = reportPost(basePost, 'member-2');
    // Flagged status means visible but marked for review
    expect(reported.status).toBe('flagged');
    expect(reported.content).toBe('Hello world');
  });

  // ─── Audit Trail ──────────────────────────────────────────

  test('removal creates audit log entry with reason', () => {
    const result = removePost(basePost, 'officer-1', 'Spam content');
    const audit = result.auditEntry as Record<string, unknown>;

    expect(audit.action).toBe('content_removed');
    expect(audit.postId).toBe('post-1');
    expect(audit.removedBy).toBe('officer-1');
    expect(audit.reason).toBe('Spam content');
    expect(audit.organizationId).toBe('org-1');
  });

  // ─── Edge Case: Notification Without Reporter Identity ────

  test('removed post notifies author with reason but NOT reporter identity', () => {
    const reported = reportPost(basePost, 'member-2');
    const result = removePost(reported, 'officer-1', 'Violates community guidelines');
    const notif = result.notification as Record<string, unknown>;

    expect(notif.recipientId).toBe('member-1');
    expect(notif.type).toBe('content_removed');
    expect(notif.reason).toBe('Violates community guidelines');
    // Must NOT expose who reported the content
    expect(notif).not.toHaveProperty('reportedBy');
    expect(notif).not.toHaveProperty('reporterId');
  });

  test('post status transitions: published → flagged → removed', () => {
    expect(basePost.status).toBe('published');

    const flagged = reportPost(basePost, 'member-2');
    expect(flagged.status).toBe('flagged');

    const result = removePost(flagged, 'officer-1', 'Policy violation');
    expect(result.post.status).toBe('removed');
  });
});
