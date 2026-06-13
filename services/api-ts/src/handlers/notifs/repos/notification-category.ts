/**
 * notification.type → preference category resolver (AHA FIX-004 / G4).
 *
 * Mirrors the canonical category map declared by the member-preferences UI in
 * `apps/memberry/src/features/communications/components/notification-preferences.tsx`
 * (the `CATEGORIES` constant). Keeping this table in sync with the frontend is
 * what makes a UI toggle actually suppress delivery: the UI writes a disable
 * for category `dues`; this resolver maps the `billing.*` / `dunning.*`
 * notification types back to `dues` so the delivery path can check it.
 *
 * | category       | notification.type prefixes / values        |
 * | -------------- | ------------------------------------------- |
 * | dues           | billing.*, dunning.*, and bare `billing`    |
 * | events         | event.*, booking.*                          |
 * | training       | training.*                                  |
 * | announcements  | system                                      |
 * | comms          | comms.*, waitlist.*, task.*                 |
 *
 * Anything unmapped (e.g. `security`) returns `null` — the caller treats a
 * null category as "no preference applies" and SENDS (fail-open).
 */

export type NotificationCategory =
  | 'dues'
  | 'events'
  | 'training'
  | 'announcements'
  | 'comms';

/**
 * Ordered prefix → category rules. A notification type matches a rule when it
 * equals the rule key (exact) or starts with `key + '.'` (namespaced). Exact
 * single-word types (`system`, `billing`) are handled by the equals branch.
 */
const PREFIX_RULES: Array<{ match: string; category: NotificationCategory }> = [
  { match: 'billing', category: 'dues' },
  { match: 'dunning', category: 'dues' },
  { match: 'event', category: 'events' },
  { match: 'booking', category: 'events' },
  { match: 'training', category: 'training' },
  { match: 'system', category: 'announcements' },
  { match: 'comms', category: 'comms' },
  { match: 'waitlist', category: 'comms' },
  { match: 'task', category: 'comms' },
];

/**
 * Resolve a notification `type` string to its preference category, or null if
 * the type maps to no category (fail-open — caller sends).
 *
 * Pure function. Case-insensitive on the leading segment.
 */
export function resolveNotificationCategory(type: string): NotificationCategory | null {
  if (!type) return null;
  const normalized = type.trim().toLowerCase();
  // Leading segment before the first dot (or the whole string if no dot).
  const head = normalized.split('.')[0] ?? normalized;
  for (const rule of PREFIX_RULES) {
    if (head === rule.match) return rule.category;
  }
  return null;
}
