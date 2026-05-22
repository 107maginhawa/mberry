/**
 * AC-M13: Professional Feed Module — Pure Domain Logic Tests
 *
 * Covers:
 *   AC-M13-001: Org-scoped feed — posts visible only to org members
 *   AC-M13-002: Post validation — body ≤2000 chars, ≤4 images, post type required
 *   AC-M13-003: Officer-only network sharing — members cannot share to network
 *   AC-M13-004: Content moderation — officer can hide/remove, member can report
 *   AC-M13-005: Muting — muted author posts hidden from member's feed only
 */
import { describe, test, expect } from 'bun:test';

// ─── Domain Types ─────────────────────────────────────────

type PostType =
  | 'Announcement'
  | 'EventHighlight'
  | 'TrainingOpportunity'
  | 'Achievement'
  | 'ClinicalUpdate';

type PostVisibility = 'org' | 'network';
type PostStatus = 'draft' | 'published' | 'hidden' | 'removed';
type MemberStatus = 'active' | 'grace' | 'lapsed' | 'suspended';
type OrgRole = 'member' | 'officer';

interface Post {
  id: string;
  organizationId: string;
  authorId: string;
  postType: PostType | null;
  body: string;
  imageUrls: string[];
  visibility: PostVisibility;
  status: PostStatus;
}

interface MutePreference {
  personId: string;
  mutedPersonId: string;
  organizationId: string;
}

interface CreatePostInput {
  body: string;
  postType: PostType | null;
  imageUrls: string[];
  visibility: PostVisibility;
  actorRole: OrgRole;
  organizationId: string;
  authorId: string;
}

// ─── Domain Functions ─────────────────────────────────────

/**
 * AC-M13-001: Filter posts to org scope — only posts matching orgId are returned.
 */
function filterFeedByOrg(posts: Post[], organizationId: string, memberOrgId: string): Post[] {
  // Member must belong to the org they're viewing
  if (memberOrgId !== organizationId) {
    return [];
  }
  return posts.filter(
    (p) =>
      p.organizationId === organizationId &&
      (p.status === 'published' || p.visibility === 'network'),
  );
}

/**
 * AC-M13-002: Validate post input — body length, image count, post type required.
 */
function validatePostInput(
  input: CreatePostInput,
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (!input.postType) {
    errors.push('Post type is required.');
  }

  if (input.body.length === 0) {
    errors.push('Post body cannot be empty.');
  }

  if (input.body.length > 2000) {
    errors.push('Post body must be 2000 characters or fewer.');
  }

  if (input.imageUrls.length > 4) {
    errors.push('A post can have at most 4 images.');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true };
}

/**
 * AC-M13-003: Only officers can set visibility to "network".
 */
function assertNetworkVisibilityPermission(
  visibility: PostVisibility,
  role: OrgRole,
): { ok: true } | { ok: false; error: string } {
  if (visibility === 'network' && role !== 'officer') {
    return {
      ok: false,
      error: 'Only officers can share posts to the network.',
    };
  }
  return { ok: true };
}

/**
 * AC-M13-004: Moderation — officers can hide/remove; members can only report.
 */
type ModerationAction = 'hide' | 'remove' | 'unhide';

function assertModerationPermission(
  action: ModerationAction,
  role: OrgRole,
): { ok: true } | { ok: false; error: string } {
  if (role !== 'officer') {
    return {
      ok: false,
      error: `Only officers can perform moderation action "${action}".`,
    };
  }
  return { ok: true };
}

function applyModerationAction(
  post: Post,
  action: ModerationAction,
): { ok: true; newStatus: PostStatus } | { ok: false; error: string } {
  if (post.status === 'removed') {
    return { ok: false, error: 'Cannot moderate a removed post.' };
  }

  switch (action) {
    case 'hide':
      return { ok: true, newStatus: 'hidden' };
    case 'unhide':
      if (post.status !== 'hidden') {
        return { ok: false, error: 'Post is not hidden.' };
      }
      return { ok: true, newStatus: 'published' };
    case 'remove':
      return { ok: true, newStatus: 'removed' };
  }
}

/**
 * AC-M13-005: Filter muted author posts from a member's feed.
 */
function filterMutedPosts(
  posts: Post[],
  viewerId: string,
  mutePreferences: MutePreference[],
): Post[] {
  const mutedAuthorIds = new Set(
    mutePreferences
      .filter((m) => m.personId === viewerId)
      .map((m) => m.mutedPersonId),
  );

  return posts.filter((p) => !mutedAuthorIds.has(p.authorId));
}

// ─── Helpers ──────────────────────────────────────────────

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    organizationId: 'org-1',
    authorId: 'author-1',
    postType: 'Announcement',
    body: 'Hello members.',
    imageUrls: [],
    visibility: 'org',
    status: 'published',
    ...overrides,
  };
}

function makeCreateInput(overrides: Partial<CreatePostInput> = {}): CreatePostInput {
  return {
    body: 'Valid post body',
    postType: 'Announcement',
    imageUrls: [],
    visibility: 'org',
    actorRole: 'officer',
    organizationId: 'org-1',
    authorId: 'person-1',
    ...overrides,
  };
}

// ─── AC-M13-001: Org-Scoped Feed ──────────────────────────

describe('[AC-M13-001] Org-scoped feed', () => {
  const posts = [
    makePost({ id: 'p1', organizationId: 'org-1', status: 'published' }),
    makePost({ id: 'p2', organizationId: 'org-2', status: 'published' }),
    makePost({ id: 'p3', organizationId: 'org-1', status: 'hidden' }),
  ];

  test('member sees only published posts from their org', () => {
    const result = filterFeedByOrg(posts, 'org-1', 'org-1');
    expect(result.map((p) => p.id)).toContain('p1');
    expect(result.map((p) => p.id)).not.toContain('p2');
  });

  test('hidden posts excluded from member feed', () => {
    const result = filterFeedByOrg(posts, 'org-1', 'org-1');
    expect(result.map((p) => p.id)).not.toContain('p3');
  });

  test('member from different org gets empty feed', () => {
    const result = filterFeedByOrg(posts, 'org-1', 'org-2');
    expect(result).toHaveLength(0);
  });
});

// ─── AC-M13-002: Post Validation ──────────────────────────

describe('[AC-M13-002] Post validation', () => {
  test('valid post passes validation', () => {
    const input = makeCreateInput({ body: 'A'.repeat(100), imageUrls: ['img1.jpg'] });
    const result = validatePostInput(input);
    expect(result.ok).toBe(true);
  });

  test('body exceeding 2000 chars is rejected', () => {
    const input = makeCreateInput({ body: 'A'.repeat(2001) });
    const result = validatePostInput(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('2000'))).toBe(true);
    }
  });

  test('body exactly 2000 chars is valid', () => {
    const input = makeCreateInput({ body: 'A'.repeat(2000) });
    const result = validatePostInput(input);
    expect(result.ok).toBe(true);
  });

  test('more than 4 images is rejected', () => {
    const input = makeCreateInput({
      imageUrls: ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg'],
    });
    const result = validatePostInput(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('4 images'))).toBe(true);
    }
  });

  test('exactly 4 images is valid', () => {
    const input = makeCreateInput({
      imageUrls: ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'],
    });
    const result = validatePostInput(input);
    expect(result.ok).toBe(true);
  });

  test('missing post type is rejected', () => {
    const input = makeCreateInput({ postType: null });
    const result = validatePostInput(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('Post type'))).toBe(true);
    }
  });
});

// ─── AC-M13-003: Officer-Only Network Sharing ─────────────

describe('[AC-M13-003] Officer-only network sharing', () => {
  test('member cannot set visibility to network', () => {
    const result = assertNetworkVisibilityPermission('network', 'member');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('officers');
    }
  });

  test('officer can set visibility to network', () => {
    const result = assertNetworkVisibilityPermission('network', 'officer');
    expect(result.ok).toBe(true);
  });

  test('member can set visibility to org (default)', () => {
    const result = assertNetworkVisibilityPermission('org', 'member');
    expect(result.ok).toBe(true);
  });
});

// ─── AC-M13-004: Content Moderation ───────────────────────

describe('[AC-M13-004] Content moderation', () => {
  test('officer can hide a published post', () => {
    const permCheck = assertModerationPermission('hide', 'officer');
    expect(permCheck.ok).toBe(true);

    const post = makePost({ status: 'published' });
    const result = applyModerationAction(post, 'hide');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.newStatus).toBe('hidden');
    }
  });

  test('member cannot moderate a post', () => {
    const result = assertModerationPermission('hide', 'member');
    expect(result.ok).toBe(false);
  });

  test('officer can remove a published post (terminal)', () => {
    const post = makePost({ status: 'published' });
    const result = applyModerationAction(post, 'remove');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.newStatus).toBe('removed');
    }
  });

  test('cannot moderate an already-removed post', () => {
    const post = makePost({ status: 'removed' });
    const result = applyModerationAction(post, 'hide');
    expect(result.ok).toBe(false);
  });

  test('officer can unhide a hidden post', () => {
    const post = makePost({ status: 'hidden' });
    const result = applyModerationAction(post, 'unhide');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.newStatus).toBe('published');
    }
  });
});

// ─── AC-M13-005: Muting ───────────────────────────────────

describe('[AC-M13-005] Muting — muted author posts hidden from muter only', () => {
  const posts = [
    makePost({ id: 'p1', authorId: 'author-A' }),
    makePost({ id: 'p2', authorId: 'author-B' }),
    makePost({ id: 'p3', authorId: 'author-A' }),
  ];

  test('muted author posts excluded from muter feed', () => {
    const mutePrefs: MutePreference[] = [
      { personId: 'member-1', mutedPersonId: 'author-A', organizationId: 'org-1' },
    ];
    const result = filterMutedPosts(posts, 'member-1', mutePrefs);
    // member-1 muted author-A — p1 and p3 hidden
    expect(result.map((p) => p.id)).not.toContain('p1');
    expect(result.map((p) => p.id)).not.toContain('p3');
    expect(result.map((p) => p.id)).toContain('p2');
  });

  test('mute only affects the muter, not other members', () => {
    const mutePrefs: MutePreference[] = [
      { personId: 'member-1', mutedPersonId: 'author-A', organizationId: 'org-1' },
    ];
    // member-2 has no mutes
    const result = filterMutedPosts(posts, 'member-2', mutePrefs);
    expect(result.map((p) => p.id)).toContain('p1');
    expect(result.map((p) => p.id)).toContain('p3');
  });

  test('member with no mutes sees all posts', () => {
    const result = filterMutedPosts(posts, 'member-3', []);
    expect(result).toHaveLength(posts.length);
  });
});
