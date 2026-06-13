/**
 * NotificationPreferencePort — minimal slice of preference behavior consumed
 * by the notification delivery path (AHA FIX-004 / G4).
 *
 * Q3 DECISION (DECIDED): the communication-owned `person_subscription` table
 * is the canonical preference store of record. OneSignal is a delivery mirror.
 * The member-preferences UI already writes `person_subscription` (via
 * `/association/person-subscriptions/bulk-update`); this port lets the notifs
 * module READ it at delivery time WITHOUT importing communication repos
 * directly (hex boundary — mirrors feature-flag.port / platform-admin.port).
 *
 * Semantics (per-category, opt-out / fail-open):
 *   - Returns `true`  ⇒ category is enabled for the recipient → SEND.
 *   - Returns `false` ⇒ recipient has EXPLICITLY disabled this category
 *     (an `enabled = false` person_subscription row for a matching topic) → SKIP.
 *   - No matching subscription row ⇒ `true` (fail-open / opt-out model). Only
 *     an explicit disable suppresses. This deliberately does NOT replicate
 *     `announcementSend`'s blunt "any disabled subscription = global opt-out"
 *     bug — enforcement is PER-CATEGORY.
 *
 * The adapter (notificationPreferenceRepoPort in communication.repo.ts) maps a
 * preference category to a `subscription_topic` via the topic's `category`
 * column OR its `name` column (case-insensitive), because the seed data uses
 * both vocabularies for the same logical category (e.g. topic name `dues`
 * carries category `billing`; topic name `announcements` carries category
 * `general`). Matching either is the simplest correct interpretation of the
 * ambiguous topic→category linkage and stays fail-open on anything unmapped.
 * `[NEEDS CONFIRMATION]` once a single canonical topic↔category vocabulary is
 * locked in the data model.
 */
export interface NotificationPreferencePort {
  /**
   * True when the recipient has NOT explicitly disabled `category` (send),
   * false when an explicit `enabled = false` person_subscription exists for a
   * topic matching `category` (skip). Fail-open: true when no row matches or
   * on any lookup error.
   */
  isCategoryEnabledForPerson(
    personId: string,
    organizationId: string,
    category: string,
  ): Promise<boolean>;
}
