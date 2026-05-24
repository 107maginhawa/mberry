/**
 * certifyElection — Flow 6.5: Election Officer Transition
 *
 * Certifies election results and performs cross-module officer transition:
 * 1. Validates election is in awaitingConfirmation state
 * 2. Filters elected nominees
 * 3. For each elected nominee's position:
 *    a. End outgoing officer term (status → completed, endDate set)
 *    b. Generate transition checklist for outgoing officer
 *    c. Create new active officer term for winner
 * 4. Update election status to published with publishedAt
 *
 * Cross-module: elections (M12) + governance (M4)
 */

import type { Context } from 'hono';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { ElectionsRepository } from './repos/elections.repo';
import { OfficerTermRepository, TransitionChecklistRepository } from '../association:member/repos/governance.repo';

const DEFAULT_CHECKLIST_ITEMS = [
  'Hand over account credentials and passwords',
  'Transfer financial records and bank access',
  'Provide status update on ongoing projects',
  'Update official contact information',
  'Brief incoming officer on pending matters',
];

export async function certifyElection(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const id = ctx.req.param('id')!;

  const electionRepo = new ElectionsRepository(db);
  const termRepo = new OfficerTermRepository(db);
  const checklistRepo = new TransitionChecklistRepository(db);

  // 1. Load and validate election
  const election = await electionRepo.get(id);
  if (!election) throw new NotFoundError('Election not found');

  if (election.status !== 'awaitingConfirmation') {
    throw new BusinessLogicError(
      `Cannot certify election in '${election.status}' state. Election must be in 'awaitingConfirmation'.`,
      'INVALID_CERTIFICATION_STATE',
    );
  }

  // 2. Get elected nominees only
  const allNominees = await electionRepo.listNominees(id);
  const electedNominees = allNominees.filter(n => n.status === 'elected');

  if (electedNominees.length === 0) {
    throw new BusinessLogicError(
      'Cannot certify election: no nominees have been marked as elected. Mark winners before certifying.',
      'NO_ELECTED_NOMINEES',
    );
  }

  // 3. Process each elected nominee — officer transition
  let termsCreated = 0;
  let termsEnded = 0;
  let checklistsGenerated = 0;

  for (const nominee of electedNominees) {
    // 3a. Find and end outgoing officer
    const outgoing = await termRepo.findActiveByPosition(nominee.positionId);
    if (outgoing) {
      await termRepo.update(outgoing.id, {
        status: 'completed',
        endDate: new Date(),
      });
      termsEnded++;

      // 3b. Generate transition checklist for outgoing officer
      for (const item of DEFAULT_CHECKLIST_ITEMS) {
        await checklistRepo.create({
          officerTermId: outgoing.id,
          organizationId: election.organizationId,
          item,
          status: 'pending',
        });
        checklistsGenerated++;
      }
    }

    // 3c. Create new active officer term for winner
    await termRepo.create({
      positionId: nominee.positionId,
      personId: nominee.personId,
      organizationId: election.organizationId,
      status: 'active',
      startDate: new Date(),
      notes: `Elected via election ${election.id}`,
    });
    termsCreated++;
  }

  // 4. Publish election
  const updated = await electionRepo.update(id, {
    status: 'published',
    publishedAt: new Date(),
  });

  return ctx.json({
    data: {
      ...updated,
      termsCreated,
      termsEnded,
      checklistsGenerated,
    },
  }, 200);
}
