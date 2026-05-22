/**
 * [025] Election Officer Transition — Certification Flow
 *
 * Flow 6.5: certify results → auto-create officer terms → transition checklists
 * Cross-module: elections (M12) + governance (M4)
 *
 * Covers:
 * - Election certification: awaitingConfirmation → published + certifiedAt
 * - Auto-create officer terms for elected nominees
 * - End outgoing officer terms (status → completed, endDate set)
 * - Generate transition checklists for outgoing officers
 * - Reject certification when election not in awaitingConfirmation
 * - Reject certification when no elected nominees exist
 * - Cross-module transaction integrity
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { ElectionsRepository } from './repos/elections.repo';
import { OfficerTermRepository, TransitionChecklistRepository } from '../association:member/repos/governance.repo';
import { BusinessLogicError, NotFoundError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────

const ELECTION_ID = 'election-cert-1';
const ORG_ID = 'org-1';
const POSITION_PRESIDENT = 'pos-president';
const POSITION_TREASURER = 'pos-treasurer';
const NOMINEE_WINNER_1 = 'nominee-winner-1';
const NOMINEE_WINNER_2 = 'nominee-winner-2';
const PERSON_NEW_PRES = 'person-new-pres';
const PERSON_NEW_TREAS = 'person-new-treas';
const PERSON_OLD_PRES = 'person-old-pres';
const PERSON_OLD_TREAS = 'person-old-treas';

const baseElection = {
  id: ELECTION_ID,
  organizationId: ORG_ID,
  title: '2026 Board Election',
  type: 'officer',
  status: 'awaitingConfirmation',
  votingMode: 'online',
  nominationsOpenAt: new Date('2026-01-01'),
  nominationsCloseAt: new Date('2026-02-01'),
  votingOpenAt: new Date('2026-02-15'),
  votingCloseAt: new Date('2026-03-01'),
  publishedAt: null,
  positions: [
    { id: POSITION_PRESIDENT, title: 'President', sortOrder: 0 },
    { id: POSITION_TREASURER, title: 'Treasurer', sortOrder: 1 },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
};

const electedNominees = [
  {
    id: NOMINEE_WINNER_1,
    organizationId: ORG_ID,
    electionId: ELECTION_ID,
    positionId: POSITION_PRESIDENT,
    personId: PERSON_NEW_PRES,
    nominatedBy: 'someone',
    status: 'elected',
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  },
  {
    id: NOMINEE_WINNER_2,
    organizationId: ORG_ID,
    electionId: ELECTION_ID,
    positionId: POSITION_TREASURER,
    personId: PERSON_NEW_TREAS,
    nominatedBy: 'someone',
    status: 'elected',
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  },
];

const outgoingTermPres = {
  id: 'term-old-pres',
  positionId: POSITION_PRESIDENT,
  personId: PERSON_OLD_PRES,
  organizationId: ORG_ID,
  status: 'active',
  startDate: new Date('2024-01-01'),
  endDate: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
};

const outgoingTermTreas = {
  id: 'term-old-treas',
  positionId: POSITION_TREASURER,
  personId: PERSON_OLD_TREAS,
  organizationId: ORG_ID,
  status: 'active',
  startDate: new Date('2024-01-01'),
  endDate: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
};

const DEFAULT_CHECKLIST_ITEMS = [
  'Hand over account credentials and passwords',
  'Transfer financial records and bank access',
  'Provide status update on ongoing projects',
  'Update official contact information',
  'Brief incoming officer on pending matters',
];

// ─── Tests ──────────────────────────────────────────────

describe('[025] Election Certification Flow', () => {
  beforeEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(OfficerTermRepository);
    restoreRepo(TransitionChecklistRepository);
  });
  afterEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(OfficerTermRepository);
    restoreRepo(TransitionChecklistRepository);
  });

  test('certifies election: sets published status and publishedAt', async () => {
    let capturedUpdate: any;
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection }),
      listNominees: async () => electedNominees,
      update: async (_id: string, data: any) => {
        capturedUpdate = data;
        return { ...baseElection, ...data };
      },
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPosition: async () => undefined,
      create: async (data: any) => ({ id: 'new-term', ...data }),
    });
    stubRepo(TransitionChecklistRepository, {
      create: async (data: any) => ({ id: 'cl-1', ...data }),
    });

    const { certifyElection } = await import('./certifyElection');
    const ctx = makeCtx({ _params: { id: ELECTION_ID } });
    const response = await certifyElection(ctx);

    expect(response.status).toBe(200);
    expect(capturedUpdate.status).toBe('published');
    expect(capturedUpdate.publishedAt).toBeInstanceOf(Date);
  });

  test('auto-creates officer terms for each elected nominee', async () => {
    const createdTerms: any[] = [];
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection }),
      listNominees: async () => electedNominees,
      update: async (_id: string, data: any) => ({ ...baseElection, ...data }),
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPosition: async () => undefined,
      create: async (data: any) => {
        const term = { id: `term-${createdTerms.length}`, ...data };
        createdTerms.push(term);
        return term;
      },
    });
    stubRepo(TransitionChecklistRepository, {
      create: async (data: any) => ({ id: 'cl-1', ...data }),
    });

    const { certifyElection } = await import('./certifyElection');
    const ctx = makeCtx({ _params: { id: ELECTION_ID } });
    const response = await certifyElection(ctx);

    expect(response.status).toBe(200);
    expect(createdTerms).toHaveLength(2);

    // President term
    const presTerm = createdTerms.find(t => t.positionId === POSITION_PRESIDENT);
    expect(presTerm).toBeDefined();
    expect(presTerm.personId).toBe(PERSON_NEW_PRES);
    expect(presTerm.organizationId).toBe(ORG_ID);
    expect(presTerm.status).toBe('active');
    expect(presTerm.startDate).toBeInstanceOf(Date);

    // Treasurer term
    const treasTerm = createdTerms.find(t => t.positionId === POSITION_TREASURER);
    expect(treasTerm).toBeDefined();
    expect(treasTerm.personId).toBe(PERSON_NEW_TREAS);
    expect(treasTerm.status).toBe('active');
  });

  test('ends outgoing officer terms when position was occupied', async () => {
    const updatedTerms: any[] = [];
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection }),
      listNominees: async () => electedNominees,
      update: async (_id: string, data: any) => ({ ...baseElection, ...data }),
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPosition: async (posId: string) => {
        if (posId === POSITION_PRESIDENT) return outgoingTermPres;
        if (posId === POSITION_TREASURER) return outgoingTermTreas;
        return undefined;
      },
      update: async (id: string, data: any) => {
        updatedTerms.push({ id, ...data });
        return { id, ...data };
      },
      create: async (data: any) => ({ id: 'new-term', ...data }),
    });
    stubRepo(TransitionChecklistRepository, {
      create: async (data: any) => ({ id: 'cl-1', ...data }),
    });

    const { certifyElection } = await import('./certifyElection');
    const ctx = makeCtx({ _params: { id: ELECTION_ID } });
    await certifyElection(ctx);

    expect(updatedTerms).toHaveLength(2);

    const presUpdate = updatedTerms.find(t => t.id === 'term-old-pres');
    expect(presUpdate).toBeDefined();
    expect(presUpdate.status).toBe('completed');
    expect(presUpdate.endDate).toBeInstanceOf(Date);

    const treasUpdate = updatedTerms.find(t => t.id === 'term-old-treas');
    expect(treasUpdate).toBeDefined();
    expect(treasUpdate.status).toBe('completed');
    expect(treasUpdate.endDate).toBeInstanceOf(Date);
  });

  test('generates transition checklists for outgoing officers', async () => {
    const createdChecklists: any[] = [];
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection }),
      listNominees: async () => electedNominees,
      update: async (_id: string, data: any) => ({ ...baseElection, ...data }),
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPosition: async (posId: string) => {
        if (posId === POSITION_PRESIDENT) return outgoingTermPres;
        return undefined; // treasurer has no outgoing
      },
      update: async (id: string, data: any) => ({ id, ...data }),
      create: async (data: any) => ({ id: 'new-term', ...data }),
    });
    stubRepo(TransitionChecklistRepository, {
      create: async (data: any) => {
        const item = { id: `cl-${createdChecklists.length}`, ...data };
        createdChecklists.push(item);
        return item;
      },
    });

    const { certifyElection } = await import('./certifyElection');
    const ctx = makeCtx({ _params: { id: ELECTION_ID } });
    await certifyElection(ctx);

    // Should have checklist items for outgoing president only
    expect(createdChecklists.length).toBeGreaterThanOrEqual(DEFAULT_CHECKLIST_ITEMS.length);
    for (const cl of createdChecklists) {
      expect(cl.officerTermId).toBe('term-old-pres');
      expect(cl.organizationId).toBe(ORG_ID);
      expect(cl.status).toBe('pending');
    }
  });

  test('rejects certification when election not in awaitingConfirmation', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection, status: 'votingOpen' }),
    });

    const { certifyElection } = await import('./certifyElection');
    const ctx = makeCtx({ _params: { id: ELECTION_ID } });

    const err = await certifyElection(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect((err as BusinessLogicError).code).toBe('INVALID_CERTIFICATION_STATE');
  });

  test('rejects certification when no elected nominees', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection }),
      listNominees: async () => [
        { ...electedNominees[0], status: 'nominated' }, // not elected
        { ...electedNominees[1], status: 'declined' },
      ],
    });

    const { certifyElection } = await import('./certifyElection');
    const ctx = makeCtx({ _params: { id: ELECTION_ID } });

    const err = await certifyElection(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect((err as BusinessLogicError).code).toBe('NO_ELECTED_NOMINEES');
  });

  test('rejects certification for nonexistent election', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => undefined,
    });

    const { certifyElection } = await import('./certifyElection');
    const ctx = makeCtx({ _params: { id: 'nonexistent' } });

    const err = await certifyElection(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotFoundError);
  });

  test('skips outgoing term end when position had no active officer', async () => {
    const updatedTerms: any[] = [];
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection }),
      listNominees: async () => [electedNominees[0]], // only president winner
      update: async (_id: string, data: any) => ({ ...baseElection, ...data }),
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPosition: async () => undefined, // no outgoing officer
      update: async (id: string, data: any) => {
        updatedTerms.push({ id, ...data });
        return { id, ...data };
      },
      create: async (data: any) => ({ id: 'new-term', ...data }),
    });
    stubRepo(TransitionChecklistRepository, {
      create: async (data: any) => ({ id: 'cl-1', ...data }),
    });

    const { certifyElection } = await import('./certifyElection');
    const ctx = makeCtx({ _params: { id: ELECTION_ID } });
    const response = await certifyElection(ctx);

    expect(response.status).toBe(200);
    // No outgoing terms should be updated
    expect(updatedTerms).toHaveLength(0);
  });

  test('response includes certification summary with term counts', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection }),
      listNominees: async () => electedNominees,
      update: async (_id: string, data: any) => ({ ...baseElection, ...data }),
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPosition: async (posId: string) => {
        if (posId === POSITION_PRESIDENT) return outgoingTermPres;
        return undefined;
      },
      update: async (id: string, data: any) => ({ id, ...data }),
      create: async (data: any) => ({ id: 'new-term', ...data }),
    });
    stubRepo(TransitionChecklistRepository, {
      create: async (data: any) => ({ id: 'cl-1', ...data }),
    });

    const { certifyElection } = await import('./certifyElection');
    const ctx = makeCtx({ _params: { id: ELECTION_ID } });
    const response = await certifyElection(ctx);

    expect(response.status).toBe(200);
    const body = response.body.data;
    expect(body.termsCreated).toBe(2);
    expect(body.termsEnded).toBe(1);
    expect(body.checklistsGenerated).toBeGreaterThanOrEqual(1);
  });
});

describe('[025] Cross-module flow 6.5 integrity', () => {
  beforeEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(OfficerTermRepository);
    restoreRepo(TransitionChecklistRepository);
  });
  afterEach(() => {
    restoreRepo(ElectionsRepository);
    restoreRepo(OfficerTermRepository);
    restoreRepo(TransitionChecklistRepository);
  });

  test('new officer term notes reference election id', async () => {
    const createdTerms: any[] = [];
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection }),
      listNominees: async () => [electedNominees[0]],
      update: async (_id: string, data: any) => ({ ...baseElection, ...data }),
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPosition: async () => undefined,
      create: async (data: any) => {
        const term = { id: 'new-term', ...data };
        createdTerms.push(term);
        return term;
      },
    });
    stubRepo(TransitionChecklistRepository, {
      create: async (data: any) => ({ id: 'cl-1', ...data }),
    });

    const { certifyElection } = await import('./certifyElection');
    const ctx = makeCtx({ _params: { id: ELECTION_ID } });
    await certifyElection(ctx);

    expect(createdTerms).toHaveLength(1);
    expect(createdTerms[0].notes).toContain(ELECTION_ID);
  });

  test('already-published election rejects re-certification', async () => {
    stubRepo(ElectionsRepository, {
      get: async () => ({ ...baseElection, status: 'published', publishedAt: new Date() }),
    });

    const { certifyElection } = await import('./certifyElection');
    const ctx = makeCtx({ _params: { id: ELECTION_ID } });

    const err = await certifyElection(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect((err as BusinessLogicError).code).toBe('INVALID_CERTIFICATION_STATE');
  });
});
