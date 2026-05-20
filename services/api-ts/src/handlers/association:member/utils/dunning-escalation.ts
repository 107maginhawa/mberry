/**
 * Dunning Escalation Logic — GAP-012
 *
 * Determines dunning stage based on days overdue,
 * selects appropriate template, and handles exclusions
 * for deceased/suppressed/departed members.
 *
 * Stage boundaries (configurable per org in future):
 *   Stage 1: 0-29 days overdue  (friendly reminder)
 *   Stage 2: 30-59 days overdue (second notice)
 *   Stage 3: 60-89 days overdue (urgent notice)
 *   Stage 4: 90-119 days overdue (final warning)
 *   Stage 5: 120+ days overdue  (termination notice)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DunningMemberContext {
  personId: string;
  membershipId: string;
  status: string;
  isSuppressed: boolean;
}

export interface DunningTemplateConfig {
  id: string;
  stage: number;
  daysAfterDue: number;
  channel: 'email' | 'sms' | 'letter';
  name: string;
  status: 'active' | 'inactive';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Membership statuses that should be excluded from dunning communications */
export const DUNNING_EXCLUSION_STATUSES = ['deceased', 'resigned', 'expelled'] as const;

/** Default stage boundaries (days overdue -> stage number) */
const STAGE_BOUNDARIES = [
  { minDays: 0, maxDays: 29, stage: 1 },
  { minDays: 30, maxDays: 59, stage: 2 },
  { minDays: 60, maxDays: 89, stage: 3 },
  { minDays: 90, maxDays: 119, stage: 4 },
  { minDays: 120, maxDays: Infinity, stage: 5 },
] as const;

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Determine dunning stage based on days overdue.
 * Returns null if not yet overdue (negative days).
 */
export function getDunningStageForMember(daysOverdue: number): number | null {
  if (daysOverdue < 0) return null;

  for (const boundary of STAGE_BOUNDARIES) {
    if (daysOverdue >= boundary.minDays && daysOverdue <= boundary.maxDays) {
      return boundary.stage;
    }
  }

  return 5; // fallback for very large values
}

/**
 * Select the appropriate active dunning template for a given stage.
 * Returns null if no active template exists for the stage.
 */
export function selectDunningTemplate(
  templates: DunningTemplateConfig[],
  stage: number,
): DunningTemplateConfig | null {
  const matching = templates.filter(
    t => t.stage === stage && t.status === 'active',
  );
  return matching.length > 0 ? (matching[0] as DunningTemplateConfig) : null;
}

/**
 * Check whether a member should be excluded from dunning.
 * Excludes deceased, resigned, expelled members and suppressed contacts.
 */
export function shouldExcludeFromDunning(member: DunningMemberContext): boolean {
  if (member.isSuppressed) return true;
  if ((DUNNING_EXCLUSION_STATUSES as readonly string[]).includes(member.status)) return true;
  return false;
}
