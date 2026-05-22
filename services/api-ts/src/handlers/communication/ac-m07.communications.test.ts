/**
 * AC-M07: Communications Module — Pure Domain Logic Tests
 *
 * Covers:
 *   AC-M07-001: In-app delivery is always included
 *   AC-M07-002: Email opt-out is respected
 *   AC-M07-003: Scheduled delivery (past-time rejection)
 *   AC-M07-004: Delivery stats tracking
 *   AC-M07-005: Suppressed members are skipped
 *   AC-M07-006: High-priority override ignores opt-out
 */
import { describe, test, expect } from 'bun:test';

// ─── Domain Types ────────────────────────────────────────

type Channel = 'in-app' | 'push' | 'email';
type MemberStatus = 'active' | 'deceased' | 'suppressed' | 'inactive';
type AnnouncementPriority = 'normal' | 'high';
type AnnouncementStatus = 'draft' | 'scheduled' | 'published' | 'archived';

interface MemberPreferences {
  personId: string;
  optedOutTopics: string[]; // topic slugs the member has opted out of
  disabledChannels: Channel[]; // channels globally disabled for the member
}

interface Member {
  personId: string;
  status: MemberStatus;
  preferences: MemberPreferences;
}

interface Announcement {
  id: string;
  priority: AnnouncementPriority;
  channels: Channel[]; // officer-selected channels
  scheduledAt: Date | null;
  status: AnnouncementStatus;
}

interface DeliveryRecord {
  announcementId: string;
  personId: string;
  channel: Channel;
  sentAt: Date;
  deliveredAt: Date | null;
  openedAt: Date | null;
}

interface DeliveryStats {
  sent: number;
  delivered: number;
  opened: number;
}

// ─── Domain Functions ─────────────────────────────────────

/**
 * AC-M07-001: In-app is always included regardless of officer channel selection.
 * Merges in-app into whatever channels the officer selected.
 */
function resolveDeliveryChannels(officerSelected: Channel[]): Channel[] {
  const channelSet = new Set<Channel>(officerSelected);
  channelSet.add('in-app'); // always on
  return Array.from(channelSet);
}

/**
 * AC-M07-002: Filter channels for a specific member based on preferences.
 * Email is skipped when the member has opted out of email.
 * In-app is never skipped (even if somehow in disabledChannels).
 */
function filterChannelsForMember(
  channels: Channel[],
  member: Member,
  topicSlug: string,
  priority: AnnouncementPriority,
): Channel[] {
  // AC-M07-005: suppressed/deceased members receive nothing
  if (member.status === 'deceased' || member.status === 'suppressed') {
    return [];
  }

  return channels.filter((ch) => {
    if (ch === 'in-app') return true; // AC-M07-001: always delivered

    // AC-M07-006: high-priority overrides opt-out for push
    if (priority === 'high' && ch === 'push') return true;

    // AC-M07-002: respect email opt-out per topic
    if (ch === 'email') {
      const topicOptedOut = member.preferences.optedOutTopics.includes(topicSlug);
      const channelDisabled = member.preferences.disabledChannels.includes('email');
      return !topicOptedOut && !channelDisabled;
    }

    // For other channels, respect global channel disabling
    if (member.preferences.disabledChannels.includes(ch)) return false;
    return true;
  });
}

/**
 * AC-M07-003: Validate that a scheduled time is in the future.
 * Returns an error string or null if valid.
 */
function validateScheduledAt(scheduledAt: Date, now: Date): string | null {
  if (scheduledAt.getTime() <= now.getTime()) {
    return 'Scheduled time must be in the future.';
  }
  return null;
}

/**
 * AC-M07-004: Compute delivery stats from delivery records.
 */
function computeDeliveryStats(records: DeliveryRecord[]): DeliveryStats {
  return {
    sent: records.length,
    delivered: records.filter((r) => r.deliveredAt !== null).length,
    opened: records.filter((r) => r.openedAt !== null).length,
  };
}

/**
 * AC-M07-005: Determine if a member should be skipped entirely.
 */
function isMemberSuppressed(member: Member): boolean {
  return member.status === 'deceased' || member.status === 'suppressed';
}

/**
 * AC-M07-006: High-priority notifications override push opt-out.
 */
function shouldDeliverPush(
  member: Member,
  priority: AnnouncementPriority,
): boolean {
  if (priority === 'high') return true;
  return !member.preferences.disabledChannels.includes('push');
}

// ─── Helpers ──────────────────────────────────────────────

function makePrefs(overrides: Partial<MemberPreferences> = {}): MemberPreferences {
  return {
    personId: 'person-test',
    optedOutTopics: [],
    disabledChannels: [],
    ...overrides,
  };
}

function makeMember(status: MemberStatus = 'active', prefs: Partial<MemberPreferences> = {}): Member {
  return {
    personId: 'person-test',
    status,
    preferences: makePrefs(prefs),
  };
}

// ─── AC-M07-001: In-App Always On ─────────────────────────

describe('[AC-M07-001] In-app delivery always included', () => {
  test('AC-M07-001: adds in-app when officer selects only push', () => {
    // Given: officer selects push only
    const selected: Channel[] = ['push'];
    // When: channels are resolved
    const channels = resolveDeliveryChannels(selected);
    // Then: in-app is also included
    expect(channels).toContain('in-app');
    expect(channels).toContain('push');
  });

  test('AC-M07-001: in-app already selected remains deduplicated', () => {
    // Given: officer explicitly selects in-app + email
    const selected: Channel[] = ['in-app', 'email'];
    // When: channels are resolved
    const channels = resolveDeliveryChannels(selected);
    // Then: no duplicate in-app
    const inAppCount = channels.filter((c) => c === 'in-app').length;
    expect(inAppCount).toBe(1);
  });

  test('AC-M07-001: even empty selection yields in-app', () => {
    // Given: officer selects no additional channels
    const channels = resolveDeliveryChannels([]);
    // Then: in-app is still delivered
    expect(channels).toEqual(['in-app']);
  });

  test('AC-M07-001: in-app never filtered for active member', () => {
    // Given: active member with email and push disabled
    const member = makeMember('active', { disabledChannels: ['email', 'push'] });
    const announcement: Channel[] = ['in-app', 'email', 'push'];
    // When: channels filtered
    const delivered = filterChannelsForMember(announcement, member, 'general', 'normal');
    // Then: in-app still delivered
    expect(delivered).toContain('in-app');
  });
});

// ─── AC-M07-002: Email Opt-Out Respected ──────────────────

describe('[AC-M07-002] Email opt-out respected', () => {
  test('AC-M07-002: member opted out of topic does not receive email', () => {
    // Given: member opted out of "dues-reminders" topic
    const member = makeMember('active', { optedOutTopics: ['dues-reminders'] });
    const channels: Channel[] = ['in-app', 'email'];
    // When: announcement targets "dues-reminders" topic
    const delivered = filterChannelsForMember(channels, member, 'dues-reminders', 'normal');
    // Then: email excluded, in-app still included
    expect(delivered).not.toContain('email');
    expect(delivered).toContain('in-app');
  });

  test('AC-M07-002: member opted out of different topic still receives email for this topic', () => {
    // Given: member opted out of "events" but announcement is for "announcements"
    const member = makeMember('active', { optedOutTopics: ['events'] });
    const channels: Channel[] = ['in-app', 'email'];
    // When: announcement targets "announcements" topic
    const delivered = filterChannelsForMember(channels, member, 'announcements', 'normal');
    // Then: email included (different topic)
    expect(delivered).toContain('email');
  });

  test('AC-M07-002: globally disabled email channel blocks all email', () => {
    // Given: member has globally disabled email channel
    const member = makeMember('active', { disabledChannels: ['email'] });
    const channels: Channel[] = ['in-app', 'email'];
    // When: any topic announcement
    const delivered = filterChannelsForMember(channels, member, 'any-topic', 'normal');
    // Then: email not delivered
    expect(delivered).not.toContain('email');
    expect(delivered).toContain('in-app');
  });

  test('AC-M07-002: member with no opt-outs receives all channels', () => {
    // Given: member with default preferences
    const member = makeMember('active');
    const channels: Channel[] = ['in-app', 'push', 'email'];
    // When: normal priority announcement
    const delivered = filterChannelsForMember(channels, member, 'general', 'normal');
    // Then: all channels delivered
    expect(delivered).toContain('in-app');
    expect(delivered).toContain('push');
    expect(delivered).toContain('email');
  });
});

// ─── AC-M07-003: Scheduled Delivery Validation ────────────

describe('[AC-M07-003] Scheduled delivery — past-time rejection', () => {
  test('AC-M07-003: future scheduled time is valid', () => {
    // Given: scheduled 1 hour in the future
    const now = new Date('2025-06-01T10:00:00Z');
    const scheduledAt = new Date('2025-06-01T11:00:00Z');
    // When: validated
    const error = validateScheduledAt(scheduledAt, now);
    // Then: no error
    expect(error).toBeNull();
  });

  test('AC-M07-003: past scheduled time is rejected', () => {
    // Given: scheduled 1 hour in the past
    const now = new Date('2025-06-01T10:00:00Z');
    const scheduledAt = new Date('2025-06-01T09:00:00Z');
    // When: validated
    const error = validateScheduledAt(scheduledAt, now);
    // Then: error returned
    expect(error).toBe('Scheduled time must be in the future.');
  });

  test('AC-M07-003: scheduled time equal to now is rejected', () => {
    // Given: scheduled exactly now (not strictly future)
    const now = new Date('2025-06-01T10:00:00Z');
    const scheduledAt = new Date('2025-06-01T10:00:00Z');
    // When: validated
    const error = validateScheduledAt(scheduledAt, now);
    // Then: error (must be strictly future)
    expect(error).not.toBeNull();
  });

  test('AC-M07-003: announcement scheduled far in future is valid', () => {
    // Given: scheduled 30 days out
    const now = new Date('2025-06-01T10:00:00Z');
    const scheduledAt = new Date('2025-07-01T10:00:00Z');
    // When: validated
    const error = validateScheduledAt(scheduledAt, now);
    // Then: valid
    expect(error).toBeNull();
  });
});

// ─── AC-M07-004: Delivery Stats ───────────────────────────

describe('[AC-M07-004] Delivery stats tracking', () => {
  const baseRecord = (overrides: Partial<DeliveryRecord> = {}): DeliveryRecord => ({
    announcementId: 'ann-1',
    personId: 'person-1',
    channel: 'in-app',
    sentAt: new Date(),
    deliveredAt: null,
    openedAt: null,
    ...overrides,
  });

  test('AC-M07-004: sent count equals total delivery records', () => {
    // Given: 3 delivery records
    const records = [baseRecord(), baseRecord({ personId: 'p2' }), baseRecord({ personId: 'p3' })];
    // When: stats computed
    const stats = computeDeliveryStats(records);
    // Then: sent = 3
    expect(stats.sent).toBe(3);
  });

  test('AC-M07-004: delivered count excludes null deliveredAt', () => {
    // Given: 3 sent, 2 delivered, 1 pending
    const records = [
      baseRecord({ deliveredAt: new Date() }),
      baseRecord({ personId: 'p2', deliveredAt: new Date() }),
      baseRecord({ personId: 'p3', deliveredAt: null }),
    ];
    // When: stats computed
    const stats = computeDeliveryStats(records);
    // Then: delivered = 2
    expect(stats.delivered).toBe(2);
  });

  test('AC-M07-004: opened count only counts records with openedAt set', () => {
    // Given: 3 delivered, 1 opened
    const now = new Date();
    const records = [
      baseRecord({ deliveredAt: now, openedAt: now }),
      baseRecord({ personId: 'p2', deliveredAt: now, openedAt: null }),
      baseRecord({ personId: 'p3', deliveredAt: now, openedAt: null }),
    ];
    // When: stats computed
    const stats = computeDeliveryStats(records);
    // Then: opened = 1
    expect(stats.opened).toBe(1);
    expect(stats.delivered).toBe(3);
  });

  test('AC-M07-004: empty records yield all-zero stats', () => {
    // Given: no delivery records yet
    const stats = computeDeliveryStats([]);
    // Then: all zeros
    expect(stats.sent).toBe(0);
    expect(stats.delivered).toBe(0);
    expect(stats.opened).toBe(0);
  });
});

// ─── AC-M07-005: Suppressed Members Skipped ───────────────

describe('[AC-M07-005] Suppressed members skipped on all channels', () => {
  test('AC-M07-005: deceased member is suppressed', () => {
    // Given: deceased member
    const member = makeMember('deceased');
    // When: suppression checked
    expect(isMemberSuppressed(member)).toBe(true);
    // Then: no channels delivered
    const channels = filterChannelsForMember(['in-app', 'push', 'email'], member, 'any', 'normal');
    expect(channels).toHaveLength(0);
  });

  test('AC-M07-005: suppressed member gets empty channel list', () => {
    // Given: suppressed member
    const member = makeMember('suppressed');
    // When: channels filtered
    const channels = filterChannelsForMember(['in-app', 'email'], member, 'any', 'normal');
    // Then: nothing delivered (not even in-app)
    expect(channels).toHaveLength(0);
  });

  test('AC-M07-005: inactive member is NOT suppressed (still receives in-app)', () => {
    // Given: inactive (not deceased/suppressed) member
    const member = makeMember('inactive');
    // When: suppression checked
    expect(isMemberSuppressed(member)).toBe(false);
    // Then: in-app still delivered
    const channels = filterChannelsForMember(['in-app'], member, 'any', 'normal');
    expect(channels).toContain('in-app');
  });

  test('AC-M07-005: active member is not suppressed', () => {
    // Given: active member
    const member = makeMember('active');
    expect(isMemberSuppressed(member)).toBe(false);
  });
});

// ─── AC-M07-006: High-Priority Override ───────────────────

describe('[AC-M07-006] High-priority overrides push opt-out', () => {
  test('AC-M07-006: high-priority push delivered even when member disabled push', () => {
    // Given: member has disabled push
    const member = makeMember('active', { disabledChannels: ['push'] });
    // When: announcement is high priority
    const shouldDeliver = shouldDeliverPush(member, 'high');
    // Then: push still delivered
    expect(shouldDeliver).toBe(true);
  });

  test('AC-M07-006: normal priority respects push opt-out', () => {
    // Given: member has disabled push
    const member = makeMember('active', { disabledChannels: ['push'] });
    // When: announcement is normal priority
    const shouldDeliver = shouldDeliverPush(member, 'normal');
    // Then: push not delivered
    expect(shouldDeliver).toBe(false);
  });

  test('AC-M07-006: high-priority push included via channel filter', () => {
    // Given: member with push disabled
    const member = makeMember('active', { disabledChannels: ['push'] });
    const channels: Channel[] = ['in-app', 'push'];
    // When: high-priority announcement
    const delivered = filterChannelsForMember(channels, member, 'security', 'high');
    // Then: push still included
    expect(delivered).toContain('push');
    expect(delivered).toContain('in-app');
  });

  test('AC-M07-006: high-priority does not override suppressed member', () => {
    // Given: deceased member (fully suppressed)
    const member = makeMember('deceased');
    const channels: Channel[] = ['in-app', 'push', 'email'];
    // When: even high-priority announcement
    const delivered = filterChannelsForMember(channels, member, 'security', 'high');
    // Then: nothing delivered (AC-M07-005 takes precedence)
    expect(delivered).toHaveLength(0);
  });
});
