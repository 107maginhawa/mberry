/**
 * Layer 7: association:member + onboarding coverage seeding
 *
 * Seeds FK-coherent, idempotent data for currently-unseeded tables:
 *   - affiliationTransfers  (member moving between chapters)
 *   - royaltySplits         (dues revenue share national/chapter)
 *   - disciplinaryActions   (warnings / suspensions / probation)
 *   - transitionChecklists  (officer handover items)
 *   - onboardingStates      (resumable onboarding wizard, one per org)
 *
 * Every block is idempotent (existence check before insert) and wrapped in
 * its own try/catch so a missing parent table or migration never throws out
 * of the function — it just logs and continues.
 *
 * NOTE: the module dir name intentionally contains a colon: `association:member`.
 */

import { sql } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/node-postgres';
import { daysAgo, daysFromNow, dateStr } from './helpers';

import {
  affiliationTransfers,
  royaltySplits,
} from '@/handlers/association:member/repos/chapters.schema';
import {
  disciplinaryActions,
  transitionChecklists,
} from '@/handlers/association:member/repos/governance.schema';
import { onboardingStates } from '@/handlers/onboarding/repos/onboarding.schema';

interface IdRow {
  rows: Array<{ id: string }>;
}

export async function seedMemberGovernanceCoverage(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  presidentPersonId: string,
  memberPersonIds: string[],
) {
  console.log('  Member + onboarding coverage (transfers, royalties, discipline, checklists, onboarding)...');

  // ─── affiliationTransfers ───────────────────────────────
  // Need ≥2 distinct chapters (from / to). Chapter FK columns are not
  // db-enforced; fall back to distinct organization ids if only one
  // chapter exists in chapter_affiliation.
  try {
    const chapterRes = (await db.execute(
      sql`SELECT DISTINCT chapter_id AS id FROM chapter_affiliation WHERE organization_id = ${orgId} LIMIT 4`,
    )) as unknown as IdRow;
    let chapterIds = (chapterRes.rows ?? []).map((r) => r.id);

    if (chapterIds.length < 2) {
      // Use other organizations as stand-in target chapters.
      const orgRes = (await db.execute(
        sql`SELECT id FROM organization LIMIT 4`,
      )) as unknown as IdRow;
      const orgIds = (orgRes.rows ?? []).map((r) => r.id);
      const merged = new Set<string>([...chapterIds, ...orgIds]);
      chapterIds = Array.from(merged);
    }

    if (chapterIds.length < 2) {
      console.log('    (affiliation transfers skipped: need ≥2 distinct chapters)');
    } else if (memberPersonIds.length === 0) {
      console.log('    (affiliation transfers skipped: no member persons)');
    } else {
      const fromChapter = chapterIds[0]!;
      const toChapter = chapterIds[1]!;
      type TransferStatus = NonNullable<typeof affiliationTransfers.$inferInsert['status']>;
      const transfers: Array<{
        marker: string;
        status: TransferStatus;
        completedAt: Date | null;
        approvedBySource: string | null;
        approvedByTarget: string | null;
        daysBack: number;
      }> = [
        { marker: 'SEED-XFER-REQUESTED', status: 'requested', completedAt: null, approvedBySource: null, approvedByTarget: null, daysBack: 5 },
        { marker: 'SEED-XFER-APPROVED', status: 'approved', completedAt: null, approvedBySource: presidentPersonId, approvedByTarget: presidentPersonId, daysBack: 20 },
        { marker: 'SEED-XFER-COMPLETED', status: 'completed', completedAt: daysAgo(10), approvedBySource: presidentPersonId, approvedByTarget: presidentPersonId, daysBack: 30 },
      ];

      let inserted = 0;
      for (let i = 0; i < transfers.length; i++) {
        const t = transfers[i]!;
        const personId = memberPersonIds[i % memberPersonIds.length]!;
        const existing = (await db.execute(
          sql`SELECT id FROM affiliation_transfer WHERE organization_id = ${orgId} AND person_id = ${personId} AND status = ${t.status}::transfer_status LIMIT 1`,
        )) as unknown as IdRow;
        if ((existing.rows?.length ?? 0) === 0) {
          await db.insert(affiliationTransfers).values({
            organizationId: orgId,
            personId,
            fromChapterId: fromChapter,
            toChapterId: toChapter,
            requestedAt: daysAgo(t.daysBack),
            requestedBy: personId,
            approvedBySource: t.approvedBySource,
            approvedByTarget: t.approvedByTarget,
            status: t.status,
            completedAt: t.completedAt,
          });
          inserted++;
        }
      }
      console.log(`    ✓ affiliation transfers (${inserted} new: requested, approved, completed)`);
    }
  } catch (e) {
    console.log(`    (affiliation transfers failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  // ─── royaltySplits ──────────────────────────────────────
  try {
    const memRes = (await db.execute(
      sql`SELECT id FROM membership WHERE organization_id = ${orgId} LIMIT 3`,
    )) as unknown as IdRow;
    const membershipIds = (memRes.rows ?? []).map((r) => r.id);

    const chapterRes = (await db.execute(
      sql`SELECT DISTINCT chapter_id AS id FROM chapter_affiliation WHERE organization_id = ${orgId} LIMIT 1`,
    )) as unknown as IdRow;
    const chapterId = chapterRes.rows?.[0]?.id ?? orgId;

    if (membershipIds.length === 0) {
      console.log('    (royalty splits skipped: no membership rows)');
    } else {
      // Realistic revenue shares — national/chapter sum to 100.
      const splits = [
        { national: 60, chapter: 40 },
        { national: 70, chapter: 30 },
        { national: 50, chapter: 50 },
      ];
      let inserted = 0;
      for (let i = 0; i < membershipIds.length && i < splits.length; i++) {
        const membershipId = membershipIds[i]!;
        const s = splits[i]!;
        const existing = (await db.execute(
          sql`SELECT id FROM royalty_split WHERE organization_id = ${orgId} AND membership_id = ${membershipId} LIMIT 1`,
        )) as unknown as IdRow;
        if ((existing.rows?.length ?? 0) === 0) {
          await db.insert(royaltySplits).values({
            organizationId: orgId,
            membershipId,
            nationalOrgId: orgId,
            chapterId,
            splitPercentNational: s.national,
            splitPercentChapter: s.chapter,
            effectiveDate: dateStr(daysAgo(90)),
          });
          inserted++;
        }
      }
      console.log(`    ✓ royalty splits (${inserted} new: 60/40, 70/30, 50/50)`);
    }
  } catch (e) {
    console.log(`    (royalty splits failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  // ─── disciplinaryActions ────────────────────────────────
  try {
    if (memberPersonIds.length === 0) {
      console.log('    (disciplinary actions skipped: no member persons)');
    } else {
      type ActionType = NonNullable<typeof disciplinaryActions.$inferInsert['actionType']>;
      const actions: Array<{
        marker: string;
        actionType: ActionType;
        reason: string;
        effectiveDaysBack: number;
        expiresAt: Date | null;
      }> = [
        { marker: 'SEED-DISC-WARNING', actionType: 'warning', reason: 'Repeated late dues payments despite reminders.', effectiveDaysBack: 45, expiresAt: null },
        { marker: 'SEED-DISC-SUSPENSION', actionType: 'suspension', reason: 'Violation of code of conduct at the regional convention.', effectiveDaysBack: 30, expiresAt: daysFromNow(60) },
        { marker: 'SEED-DISC-PROBATION', actionType: 'probation', reason: 'Failure to meet mandatory CPD credit requirements for the cycle.', effectiveDaysBack: 15, expiresAt: daysFromNow(90) },
      ];

      let inserted = 0;
      for (let i = 0; i < actions.length; i++) {
        const a = actions[i]!;
        const targetPersonId = memberPersonIds[i % memberPersonIds.length]!;
        const existing = (await db.execute(
          sql`SELECT id FROM disciplinary_action WHERE organization_id = ${orgId} AND target_person_id = ${targetPersonId} AND action_type = ${a.actionType}::disciplinary_action_type LIMIT 1`,
        )) as unknown as IdRow;
        if ((existing.rows?.length ?? 0) === 0) {
          await db.insert(disciplinaryActions).values({
            organizationId: orgId,
            targetPersonId,
            issuedBy: presidentPersonId,
            actionType: a.actionType,
            reason: a.reason,
            effectiveDate: daysAgo(a.effectiveDaysBack),
            expiresAt: a.expiresAt,
            notes: `Seed disciplinary record — ${a.actionType}.`,
          });
          inserted++;
        }
      }
      console.log(`    ✓ disciplinary actions (${inserted} new: warning, suspension, probation)`);
    }
  } catch (e) {
    console.log(`    (disciplinary actions failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  // ─── transitionChecklists ───────────────────────────────
  // Officer handover items keyed to existing officer_term rows.
  try {
    const termRes = (await db.execute(
      sql`SELECT id FROM officer_term WHERE organization_id = ${orgId} LIMIT 2`,
    )) as unknown as IdRow;
    const termIds = (termRes.rows ?? []).map((r) => r.id);

    if (termIds.length === 0) {
      console.log('    (transition checklists skipped: no officer terms)');
    } else {
      type ChecklistStatus = NonNullable<typeof transitionChecklists.$inferInsert['status']>;
      const items: Array<{ item: string; status: ChecklistStatus }> = [
        { item: 'Hand over financial records and bank signatory authority', status: 'completed' },
        { item: 'Transfer custody of official seal and documents', status: 'pending' },
        { item: 'Brief incoming officer on ongoing committee work', status: 'pending' },
      ];

      let inserted = 0;
      for (let ti = 0; ti < termIds.length; ti++) {
        const officerTermId = termIds[ti]!;
        for (let ii = 0; ii < items.length; ii++) {
          const it = items[ii]!;
          const existing = (await db.execute(
            sql`SELECT id FROM transition_checklist WHERE officer_term_id = ${officerTermId} AND item = ${it.item} LIMIT 1`,
          )) as unknown as IdRow;
          if ((existing.rows?.length ?? 0) === 0) {
            await db.insert(transitionChecklists).values({
              officerTermId,
              organizationId: orgId,
              item: it.item,
              status: it.status,
              completedAt: it.status === 'completed' ? daysAgo(7) : null,
              completedBy: it.status === 'completed' ? presidentPersonId : null,
              notes: it.status === 'completed' ? 'Verified during handover meeting.' : null,
            });
            inserted++;
          }
        }
      }
      console.log(`    ✓ transition checklists (${inserted} new across ${termIds.length} term(s))`);
    }
  } catch (e) {
    console.log(`    (transition checklists failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  // ─── onboardingStates ───────────────────────────────────
  // UNIQUE(organizationId): at most ONE state per org. Seed for every
  // existing org to distribute wizard-step coverage (in-progress + complete).
  try {
    const orgRes = (await db.execute(
      sql`SELECT id FROM organization LIMIT 4`,
    )) as unknown as IdRow;
    const orgIds = (orgRes.rows ?? []).map((r) => r.id);
    // Ensure the param org is covered first.
    const targetOrgs = Array.from(new Set<string>([orgId, ...orgIds]));

    if (targetOrgs.length === 0) {
      console.log('    (onboarding states skipped: no organizations)');
    } else {
      // currentStep 1-5; stepsCompleted = prior steps; completedAt set when done.
      const profiles = [
        { currentStep: 5, stepsCompleted: [1, 2, 3, 4, 5], done: true },
        { currentStep: 3, stepsCompleted: [1, 2], done: false },
        { currentStep: 1, stepsCompleted: [] as number[], done: false },
        { currentStep: 4, stepsCompleted: [1, 2, 3], done: false },
      ];

      let inserted = 0;
      for (let i = 0; i < targetOrgs.length; i++) {
        const oid = targetOrgs[i]!;
        const p = profiles[i % profiles.length]!;
        const existing = (await db.execute(
          sql`SELECT id FROM onboarding_state WHERE organization_id = ${oid} LIMIT 1`,
        )) as unknown as IdRow;
        if ((existing.rows?.length ?? 0) === 0) {
          await db.insert(onboardingStates).values({
            organizationId: oid,
            currentStep: p.currentStep,
            stepsCompleted: p.stepsCompleted,
            completedAt: p.done ? daysAgo(2) : null,
          });
          inserted++;
        }
      }
      console.log(`    ✓ onboarding states (${inserted} new; one per org due to unique constraint)`);
    }
  } catch (e) {
    console.log(`    (onboarding states failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  console.log('  Member + onboarding coverage complete.');
}
