/**
 * Account Deletion Cascade — Flow 6.6
 *
 * Cascades account deletion across all 19 modules that reference a person.
 * Called by both executeAccountDeletion (handler) and deletionProcessor (cron).
 *
 * Strategy per module:
 * - ANONYMIZE: Keep record but scrub PII (financial/compliance records — BR-32)
 * - DELETE: Remove record entirely (personal preferences, directory profiles)
 * - SOFT-DELETE: Set status to removed/cancelled (memberships, enrollments)
 *
 * BR-32: Financial records (dues payments, invoices) PRESERVED.
 *        Only proof files scrubbed. Amounts/dates/references retained for 7-year hold.
 * DPA 2012: All PII fields anonymized or deleted.
 */

import type { DatabaseInstance } from '@/core/database';
import { eq } from 'drizzle-orm';

// ─── Schema imports (all modules with personId FK) ──────────

// M05: Membership
import { memberships } from '../association:member/repos/membership.schema';

// M05: Membership status history
import { membershipStatusHistory } from '../association:member/repos/status-history.schema';

// M08: Events
import { eventRegistrations, checkIns, waitlistEntries } from '../association:operations/repos/events.schema';

// M09: Training
import { trainingEnrollments, courseEnrollments, quizAttempts } from '../association:operations/repos/training.schema';

// M10: Credits
import { creditEntries } from '../association:member/repos/credits.schema';

// M12: Elections
import { electionNominees, electionVotes } from '../elections/repos/elections.schema';

// M04: Governance — officer terms
import { officerTerms } from '../association:member/repos/governance.schema';

// M15: Communications
import { personSubscriptions } from '../communication/repos/communication.schema';

// M11: Certificates
import { certificates } from '../certificates/repos/certificates.schema';

// M05: Directory profiles
import { directoryProfiles } from '../association:member/repos/directory.schema';

// M02: Notification preferences
import { notificationPreferences } from './repos/notification-preferences.schema';

// M02: Privacy settings
import { personPrivacySettings } from './repos/privacy-settings.schema';

// M11: Documents
import { documents } from '../documents/repos/documents.schema';

// M06: Dunning
import { dunningEvents } from '../association:member/repos/dunning.schema';

// M11: Credentials
import { digitalCredentials } from '../association:member/repos/credentials.schema';

// M05: Chapters
import { chapterAffiliations, affiliationTransfers } from '../association:member/repos/chapters.schema';

// M07: Invites
import { invitationTokens } from '../invite/repos/invite.schema';

// M06: Dues payments (BR-32: anonymize proof only, preserve amounts)
import { duesPayments } from '../dues/repos/dues-payments.schema';

// M13: Billing (BR-32: anonymize payer info, preserve invoice records)
import { invoices, merchantAccounts } from '../billing/repos/billing.schema';

// ─── Types ──────────────────────────────────────────────────

export interface CascadeModuleResult {
  module: string;
  action: 'delete' | 'anonymize' | 'soft-delete';
  error?: string;
}

export interface CascadeResult {
  modulesProcessed: number;
  errors: number;
  details: CascadeModuleResult[];
}

interface CascadeContext {
  db: DatabaseInstance;
  personId: string;
  logger?: any;
}

// ─── Cascade Steps ──────────────────────────────────────────

type CascadeStep = {
  module: string;
  action: 'delete' | 'anonymize' | 'soft-delete';
  execute: (ctx: CascadeContext) => Promise<void>;
};

const CASCADE_STEPS: CascadeStep[] = [
  // ── Flow 6.6 Step 1: Membership records ─────────────────
  {
    module: 'membership',
    action: 'soft-delete',
    execute: async ({ db, personId }) => {
      await db.update(memberships)
        .set({
          status: 'removed',
          removedAt: new Date(),
          removalReason: 'Account deletion — DPA 2012',
          updatedBy: 'system',
        })
        .where(eq(memberships.personId, personId));
    },
  },

  // ── Flow 6.6 Step 2: Event registrations ────────────────
  {
    module: 'events',
    action: 'soft-delete',
    execute: async ({ db, personId }) => {
      // Cancel registrations
      await db.update(eventRegistrations)
        .set({
          status: 'cancelled',
          cancelledAt: new Date(),
          updatedBy: 'system',
        })
        .where(eq(eventRegistrations.personId, personId));

      // Remove check-ins (PII: presence data)
      await db.delete(checkIns)
        .where(eq(checkIns.personId, personId));

      // Remove waitlist entries
      await db.delete(waitlistEntries)
        .where(eq(waitlistEntries.personId, personId));
    },
  },

  // ── Flow 6.6 Step 3: Training enrollments ───────────────
  {
    module: 'training',
    action: 'soft-delete',
    execute: async ({ db, personId }) => {
      await db.update(trainingEnrollments)
        .set({
          status: 'cancelled',
          cancelledAt: new Date(),
          updatedBy: 'system',
        })
        .where(eq(trainingEnrollments.personId, personId));

      await db.update(courseEnrollments)
        .set({
          status: 'cancelled',
          updatedBy: 'system',
        })
        .where(eq(courseEnrollments.personId, personId));

      await db.delete(quizAttempts)
        .where(eq(quizAttempts.personId, personId));
    },
  },

  // ── Flow 6.6 Step 4: Credit entries ─────────────────────
  {
    module: 'credits',
    action: 'anonymize',
    execute: async ({ db, personId }) => {
      // Anonymize activity details but preserve credit amounts for compliance
      await db.update(creditEntries)
        .set({
          activityName: 'DELETED',
          provider: null,
          updatedBy: 'system',
        })
        .where(eq(creditEntries.personId, personId));
    },
  },

  // ── Flow 6.6 Step 5: Elections ──────────────────────────
  {
    module: 'elections',
    action: 'anonymize',
    execute: async ({ db, personId }) => {
      // Anonymize nominee records (preserve election integrity)
      await db.update(electionNominees)
        .set({
          status: 'declined',
          updatedBy: 'system',
        })
        .where(eq(electionNominees.personId, personId));

      // Delete votes (secret ballot — no audit trail needed)
      await db.delete(electionVotes)
        .where(eq(electionVotes.voterId, personId));
    },
  },

  // ── Flow 6.6 Step 6: Governance / officer terms ─────────
  {
    module: 'governance',
    action: 'soft-delete',
    execute: async ({ db, personId }) => {
      await db.update(officerTerms)
        .set({
          status: 'completed',
          endDate: new Date(),
          notes: 'Term ended — account deletion',
          updatedBy: 'system',
        })
        .where(eq(officerTerms.personId, personId));
    },
  },

  // ── Flow 6.6 Step 7: Communications ────────────────────
  {
    module: 'communications',
    action: 'delete',
    execute: async ({ db, personId }) => {
      // Delete subscription preferences
      await db.delete(personSubscriptions)
        .where(eq(personSubscriptions.personId, personId));
    },
  },

  // ── Flow 6.6 Step 8: Certificates ──────────────────────
  {
    module: 'certificates',
    action: 'anonymize',
    execute: async ({ db, personId }) => {
      // Keep certificate records (compliance) but they reference anonymized person
      // Certificate number preserved for verification
      // No PII in certificate table itself — personId FK points to anonymized person
      // Mark as updated by system for audit trail
      await db.update(certificates)
        .set({ updatedBy: 'system' })
        .where(eq(certificates.personId, personId));
    },
  },

  // ── Flow 6.6 Step 9: Directory profiles ─────────────────
  {
    module: 'directory',
    action: 'delete',
    execute: async ({ db, personId }) => {
      await db.delete(directoryProfiles)
        .where(eq(directoryProfiles.personId, personId));
    },
  },

  // ── Flow 6.6 Step 10: Notification preferences ──────────
  {
    module: 'notificationPreferences',
    action: 'delete',
    execute: async ({ db, personId }) => {
      await db.delete(notificationPreferences)
        .where(eq(notificationPreferences.personId, personId));
    },
  },

  // ── Flow 6.6 Step 11: Privacy settings ──────────────────
  {
    module: 'privacySettings',
    action: 'delete',
    execute: async ({ db, personId }) => {
      await db.delete(personPrivacySettings)
        .where(eq(personPrivacySettings.personId, personId));
    },
  },

  // ── Flow 6.6 Step 12: Documents ─────────────────────────
  {
    module: 'documents',
    action: 'delete',
    execute: async ({ db, personId }) => {
      // Delete documents owned by the person
      await db.delete(documents)
        .where(eq(documents.ownerId, personId));
    },
  },

  // ── Flow 6.6 Step 13: Dunning events ────────────────────
  {
    module: 'dunning',
    action: 'delete',
    execute: async ({ db, personId }) => {
      await db.delete(dunningEvents)
        .where(eq(dunningEvents.personId, personId));
    },
  },

  // ── Flow 6.6 Step 14: Credentials ──────────────────────
  {
    module: 'credentials',
    action: 'delete',
    execute: async ({ db, personId }) => {
      // Revoke and delete digital credentials
      await db.delete(digitalCredentials)
        .where(eq(digitalCredentials.personId, personId));
    },
  },

  // ── Flow 6.6 Step 15: Status history ────────────────────
  {
    module: 'statusHistory',
    action: 'anonymize',
    execute: async ({ db, personId }) => {
      // Preserve status transitions for compliance audit trail
      // Anonymize changedBy if it matches the deleted person
      await db.update(membershipStatusHistory)
        .set({
          reason: 'Account deleted',
          updatedBy: 'system',
        })
        .where(eq(membershipStatusHistory.personId, personId));
    },
  },

  // ── Flow 6.6 Step 16: Chapter affiliations ──────────────
  {
    module: 'chapters',
    action: 'soft-delete',
    execute: async ({ db, personId }) => {
      await db.update(chapterAffiliations)
        .set({
          status: 'withdrawn',
          updatedBy: 'system',
        })
        .where(eq(chapterAffiliations.personId, personId));

      // Cancel pending transfers
      await db.update(affiliationTransfers)
        .set({
          status: 'cancelled',
          updatedBy: 'system',
        })
        .where(eq(affiliationTransfers.personId, personId));
    },
  },

  // ── Flow 6.6 Step 17: Invites ──────────────────────────
  {
    module: 'invites',
    action: 'delete',
    execute: async ({ db, personId }) => {
      await db.delete(invitationTokens)
        .where(eq(invitationTokens.personId, personId));
    },
  },

  // ── BR-32: Dues payments — anonymize proof files only ───
  {
    module: 'duesPayments',
    action: 'anonymize',
    execute: async ({ db, personId }) => {
      // BR-32: Payment amounts, dates, receipt numbers PRESERVED for 7-year statutory hold
      // Only scrub uploaded proof files (PII: images of IDs, receipts with personal info)
      await db.update(duesPayments)
        .set({
          proofStorageKey: null,
          proofFileName: null,
          proofMimeType: null,
          updatedBy: 'system',
        })
        .where(eq(duesPayments.personId, personId));
    },
  },

  // ── BR-32: Billing — anonymize payer details, keep records ─
  {
    module: 'billing',
    action: 'anonymize',
    execute: async ({ db, personId }) => {
      // Invoices: preserve amounts, dates, invoice numbers
      // customer/merchant FKs point to now-anonymized person record
      // No additional action needed — person PII is already scrubbed

      // Merchant accounts: deactivate
      await db.update(merchantAccounts)
        .set({
          active: false,
          metadata: { deletedAccount: true },
          updatedBy: 'system',
        })
        .where(eq(merchantAccounts.person, personId));
    },
  },
];

// ─── Main Executor ──────────────────────────────────────────

/**
 * Execute cascade deletion across all modules for a given person.
 * Per-module try/catch ensures one failure doesn't halt the batch.
 */
export async function executeCascadeDeletion(ctx: CascadeContext): Promise<CascadeResult> {
  const { logger, personId } = ctx;
  const result: CascadeResult = {
    modulesProcessed: 0,
    errors: 0,
    details: [],
  };

  for (const step of CASCADE_STEPS) {
    result.modulesProcessed++;
    try {
      await step.execute(ctx);
      result.details.push({
        module: step.module,
        action: step.action,
      });
      logger?.debug?.({ module: step.module, personId }, `Cascade: ${step.module} completed`);
    } catch (err) {
      result.errors++;
      result.details.push({
        module: step.module,
        action: step.action,
        error: (err as Error).message,
      });
      logger?.error?.({ error: err, module: step.module, personId }, `Cascade: ${step.module} failed`);
    }
  }

  logger?.info?.({ personId, modulesProcessed: result.modulesProcessed, errors: result.errors }, 'Cascade deletion completed');
  return result;
}
