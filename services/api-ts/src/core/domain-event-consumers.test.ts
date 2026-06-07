/**
 * Tests for registerDomainEventConsumers
 *
 * The consumer registers a handler for dues.payment.recorded that
 * updates the membership duesExpiryDate when a payment includes a new expiry.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { DomainEventBus, domainEvents } from './domain-events';
import { registerDomainEventConsumers, type DomainEventMembershipRepo } from './domain-event-consumers';
import { SYSTEM_USER_ID } from './constants';

// ── person.deleted cascade — schema imports (mirror domain-event-consumers.ts) ──
import { memberships } from './schema-registry';
import { membershipStatusHistory } from '@/handlers/association:member/repos/status-history.schema';
import { checkIns, waitlistEntries } from '@/handlers/association:operations/repos/events.schema';
import { courseEnrollments, quizAttempts } from '@/handlers/association:operations/repos/training.schema';
import { creditEntries } from '@/handlers/association:member/repos/credits.schema';
import { electionNominees, electionVotes } from '@/handlers/elections/repos/elections.schema';
import { officerTerms } from '@/handlers/association:member/repos/governance.schema';
import { personSubscriptions } from '@/handlers/communication/repos/communication.schema';
import { certificates } from '@/handlers/member/certificates/repos/certificates.schema';
import { directoryProfiles } from '@/handlers/association:member/repos/directory.schema';
import { notificationPreferences } from '@/handlers/person/repos/notification-preferences.schema';
import { personPrivacySettings } from '@/handlers/person/repos/privacy-settings.schema';
import { documents } from '@/handlers/documents/repos/documents.schema';
import { dunningEvents } from '@/handlers/association:member/repos/dunning.schema';
import { digitalCredentials } from '@/handlers/association:member/repos/credentials.schema';
import { chapterAffiliations, affiliationTransfers } from '@/handlers/association:member/repos/chapters.schema';
import { duesPayments } from '@/handlers/association:member/repos/dues-payments.schema';
import { merchantAccounts } from '@/handlers/billing/repos/billing.schema';
import { trainingEnrollments, eventRegistrations } from './schema-registry';
import { invitationTokens } from './schema-registry';

const mockDb = {
  insert: () => ({ values: () => Promise.resolve() }),
  select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
} as any;

// ---------------------------------------------------------------------------
// Cascade-capturing db mock — records every update/delete/insert chain by
// table reference, so per-subscriber tests can filter their own calls.
// ---------------------------------------------------------------------------

type CascadeCall = { op: 'update' | 'delete' | 'insert'; table: any; set?: any; values?: any };

function makeCascadeCapturingDb() {
  const calls: CascadeCall[] = [];
  const db = {
    update(table: any) {
      const call: CascadeCall = { op: 'update', table };
      calls.push(call);
      return {
        set(values: any) {
          call.set = values;
          return {
            where: (_cond: any) => Promise.resolve(),
          };
        },
      };
    },
    delete(table: any) {
      const call: CascadeCall = { op: 'delete', table };
      calls.push(call);
      return {
        where: (_cond: any) => Promise.resolve(),
      };
    },
    insert(table: any) {
      const call: CascadeCall = { op: 'insert', table };
      calls.push(call);
      return {
        values: async (v: any) => {
          call.values = v;
        },
      };
    },
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
  };
  return { db: db as any, calls };
}

function findCall(calls: CascadeCall[], op: CascadeCall['op'], table: any): CascadeCall | undefined {
  return calls.find((c) => c.op === op && c.table === table);
}

// Mock-Classification: APPROPRIATE — cross-module domain event glue layer

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger() {
  return {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  };
}

function makeMembershipRepo(overrides: Partial<DomainEventMembershipRepo> = {}): DomainEventMembershipRepo {
  return {
    findByPersonAndOrg: mock(async () => null),
    updateOneById: mock(async () => ({})),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerDomainEventConsumers', () => {
  let logger: ReturnType<typeof makeLogger>;

  beforeEach(() => {
    logger = makeLogger();
    domainEvents.reset();
  });

  test('registers handler for dues.payment.recorded', async () => {
    const mockFindByPersonAndOrg = mock(async () => null);
    const membershipRepo = makeMembershipRepo({ findByPersonAndOrg: mockFindByPersonAndOrg });

    registerDomainEventConsumers({ membershipRepo, db: mockDb }, logger as any);

    await domainEvents.emit('dues.payment.recorded', {
      paymentId: 'pay-1',
      personId: 'person-1',
      organizationId: 'org-1',
      amount: 500,
      newExpiryDate: '2027-01-01',
    });

    expect(mockFindByPersonAndOrg).toHaveBeenCalledWith('person-1', 'org-1');
  });

  test('skips membership update when newExpiryDate is null', async () => {
    const mockFindByPersonAndOrg = mock(async () => null);
    const membershipRepo = makeMembershipRepo({ findByPersonAndOrg: mockFindByPersonAndOrg });

    registerDomainEventConsumers({ membershipRepo, db: mockDb }, logger as any);

    await domainEvents.emit('dues.payment.recorded', {
      paymentId: 'pay-2',
      personId: 'person-2',
      organizationId: 'org-2',
      amount: 100,
      newExpiryDate: null,
    });

    expect(mockFindByPersonAndOrg).not.toHaveBeenCalled();
  });

  test('logs warning when membership not found for person+org', async () => {
    const membershipRepo = makeMembershipRepo();

    registerDomainEventConsumers({ membershipRepo, db: mockDb }, logger as any);

    await domainEvents.emit('dues.payment.recorded', {
      paymentId: 'pay-3',
      personId: 'person-missing',
      organizationId: 'org-missing',
      amount: 200,
      newExpiryDate: '2027-06-01',
    });

    expect(logger.warn).toHaveBeenCalled();
  });

  test('updates duesExpiryDate when membership found', async () => {
    const mockUpdateOneById = mock(async () => ({}));
    const membershipRepo = makeMembershipRepo({
      findByPersonAndOrg: mock(async () => ({ id: 'mem-1' })),
      updateOneById: mockUpdateOneById,
    });

    registerDomainEventConsumers({ membershipRepo, db: mockDb }, logger as any);

    await domainEvents.emit('dues.payment.recorded', {
      paymentId: 'pay-4',
      personId: 'person-4',
      organizationId: 'org-4',
      amount: 1000,
      newExpiryDate: '2028-01-01',
    });

    expect(mockUpdateOneById).toHaveBeenCalledWith('mem-1', expect.objectContaining({
      duesExpiryDate: '2028-01-01',
    }));
    expect(logger.info).toHaveBeenCalled();
  });

  // ─── [EM-M06] Wave 26 — dues lifecycle notification consumers ───────────

  function makeCapturingDb(inserted: any[]) {
    return {
      insert: () => ({ values: async (v: any) => { inserted.push(v); } }),
      select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
    } as any;
  }

  test('dues.payment.refunded → inserts refund notification for member', async () => {
    const inserted: any[] = [];
    registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db: makeCapturingDb(inserted) }, logger as any);

    await domainEvents.emit('dues.payment.refunded', {
      paymentId: 'pay-1',
      personId: 'person-1',
      organizationId: 'org-1',
      refundAmount: 5000,
      isFullRefund: true,
    });

    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      organizationId: 'org-1',
      recipient: 'person-1',
      relatedEntityType: 'dues-payment',
      relatedEntity: 'pay-1',
    });
  });

  test('dues.invoice.generated → inserts new-invoice notification for member', async () => {
    const inserted: any[] = [];
    registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db: makeCapturingDb(inserted) }, logger as any);

    await domainEvents.emit('dues.invoice.generated', {
      invoiceId: 'inv-1',
      organizationId: 'org-1',
      personId: 'person-2',
      amount: 5000,
      dueDate: '2026-12-31',
    });

    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      organizationId: 'org-1',
      recipient: 'person-2',
      relatedEntityType: 'dues-invoice',
      relatedEntity: 'inv-1',
    });
  });

  test('dues.payment.proof.rejected → inserts resubmit-proof notification for member', async () => {
    const inserted: any[] = [];
    registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db: makeCapturingDb(inserted) }, logger as any);

    await domainEvents.emit('dues.payment.proof.rejected', {
      paymentId: 'pay-3',
      personId: 'person-3',
      organizationId: 'org-1',
      reason: 'Blurry receipt',
    });

    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      organizationId: 'org-1',
      recipient: 'person-3',
      relatedEntityType: 'dues-payment',
      relatedEntity: 'pay-3',
    });
    expect(inserted[0].message).toContain('Blurry receipt');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // person.deleted cascade — 9 subscribers (P1.6)
  // Mirrors CASCADE_STEPS from former accountDeletionCascade. Each test
  // emits one person.deleted and asserts the relevant module's table writes.
  // ─────────────────────────────────────────────────────────────────────────

  const PERSON_ID = '00000000-0000-0000-0000-0000000000aa';
  const personDeletedPayload = {
    personId: PERSON_ID,
    scheduledAt: new Date('2026-06-06T00:00:00.000Z').toISOString(),
  };

  test('person.deleted → association:member — soft-deletes/anonymizes 10 tables', async () => {
    const { db, calls } = makeCascadeCapturingDb();
    registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db }, logger as any);

    await domainEvents.emit('person.deleted', personDeletedPayload);

    // memberships: soft-delete
    const mem = findCall(calls, 'update', memberships);
    expect(mem?.set).toMatchObject({
      status: 'removed',
      removalReason: 'Account deletion — DPA 2012',
      updatedBy: SYSTEM_USER_ID,
    });
    expect(mem?.set.removedAt).toBeInstanceOf(Date);

    // membership status history: anonymize reason
    expect(findCall(calls, 'update', membershipStatusHistory)?.set).toMatchObject({
      reason: 'Account deleted',
      updatedBy: SYSTEM_USER_ID,
    });

    // credit entries: anonymize
    expect(findCall(calls, 'update', creditEntries)?.set).toMatchObject({
      activityName: 'DELETED',
      provider: null,
      updatedBy: SYSTEM_USER_ID,
    });

    // officer terms: soft-delete
    expect(findCall(calls, 'update', officerTerms)?.set).toMatchObject({
      status: 'completed',
      notes: 'Term ended — account deletion',
      updatedBy: SYSTEM_USER_ID,
    });

    // directoryProfiles, dunningEvents, digitalCredentials: hard delete
    expect(findCall(calls, 'delete', directoryProfiles)).toBeDefined();
    expect(findCall(calls, 'delete', dunningEvents)).toBeDefined();
    expect(findCall(calls, 'delete', digitalCredentials)).toBeDefined();

    // chapterAffiliations: soft-delete
    expect(findCall(calls, 'update', chapterAffiliations)?.set).toMatchObject({
      status: 'withdrawn',
      updatedBy: SYSTEM_USER_ID,
    });

    // affiliationTransfers: soft-delete
    expect(findCall(calls, 'update', affiliationTransfers)?.set).toMatchObject({
      status: 'cancelled',
      updatedBy: SYSTEM_USER_ID,
    });

    // duesPayments: anonymize proof (BR-32 preserves amounts)
    expect(findCall(calls, 'update', duesPayments)?.set).toMatchObject({
      proofStorageKey: null,
      proofFileName: null,
      proofMimeType: null,
      updatedBy: SYSTEM_USER_ID,
    });
  });

  test('person.deleted → association:operations — cancels events + training', async () => {
    const { db, calls } = makeCascadeCapturingDb();
    registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db }, logger as any);

    await domainEvents.emit('person.deleted', personDeletedPayload);

    // eventRegistrations: cancelled + cancelledAt + updatedBy
    const reg = findCall(calls, 'update', eventRegistrations);
    expect(reg?.set).toMatchObject({ status: 'cancelled', updatedBy: SYSTEM_USER_ID });
    expect(reg?.set.cancelledAt).toBeInstanceOf(Date);

    // checkIns, waitlistEntries: hard delete
    expect(findCall(calls, 'delete', checkIns)).toBeDefined();
    expect(findCall(calls, 'delete', waitlistEntries)).toBeDefined();

    // trainingEnrollments: cancelled + cancelledAt
    const tEnroll = findCall(calls, 'update', trainingEnrollments);
    expect(tEnroll?.set).toMatchObject({ status: 'cancelled', updatedBy: SYSTEM_USER_ID });
    expect(tEnroll?.set.cancelledAt).toBeInstanceOf(Date);

    // courseEnrollments: cancelled
    expect(findCall(calls, 'update', courseEnrollments)?.set).toMatchObject({
      status: 'cancelled',
      updatedBy: SYSTEM_USER_ID,
    });

    // quizAttempts: hard delete
    expect(findCall(calls, 'delete', quizAttempts)).toBeDefined();
  });

  test('person.deleted → elections — declines nominees, deletes votes', async () => {
    const { db, calls } = makeCascadeCapturingDb();
    registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db }, logger as any);

    await domainEvents.emit('person.deleted', personDeletedPayload);

    expect(findCall(calls, 'update', electionNominees)?.set).toMatchObject({
      status: 'declined',
      updatedBy: SYSTEM_USER_ID,
    });
    expect(findCall(calls, 'delete', electionVotes)).toBeDefined();
  });

  test('person.deleted → certificates — stamps updatedBy=system (retain for compliance)', async () => {
    const { db, calls } = makeCascadeCapturingDb();
    registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db }, logger as any);

    await domainEvents.emit('person.deleted', personDeletedPayload);

    const cert = findCall(calls, 'update', certificates);
    expect(cert?.set).toEqual({ updatedBy: SYSTEM_USER_ID });
    expect(findCall(calls, 'delete', certificates)).toBeUndefined();
  });

  test('person.deleted → communication — deletes personSubscriptions', async () => {
    const { db, calls } = makeCascadeCapturingDb();
    registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db }, logger as any);

    await domainEvents.emit('person.deleted', personDeletedPayload);

    expect(findCall(calls, 'delete', personSubscriptions)).toBeDefined();
  });

  test('person.deleted → documents — deletes documents owned by person', async () => {
    const { db, calls } = makeCascadeCapturingDb();
    registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db }, logger as any);

    await domainEvents.emit('person.deleted', personDeletedPayload);

    expect(findCall(calls, 'delete', documents)).toBeDefined();
  });

  test('person.deleted → invite — deletes invitation tokens', async () => {
    const { db, calls } = makeCascadeCapturingDb();
    registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db }, logger as any);

    await domainEvents.emit('person.deleted', personDeletedPayload);

    expect(findCall(calls, 'delete', invitationTokens)).toBeDefined();
  });

  test('person.deleted → billing — deactivates merchant accounts (BR-32 preserves invoices)', async () => {
    const { db, calls } = makeCascadeCapturingDb();
    registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db }, logger as any);

    await domainEvents.emit('person.deleted', personDeletedPayload);

    expect(findCall(calls, 'update', merchantAccounts)?.set).toMatchObject({
      active: false,
      metadata: { deletedAccount: true },
      updatedBy: SYSTEM_USER_ID,
    });
  });

  test('person.deleted → person — deletes notification prefs + privacy settings', async () => {
    const { db, calls } = makeCascadeCapturingDb();
    registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db }, logger as any);

    await domainEvents.emit('person.deleted', personDeletedPayload);

    expect(findCall(calls, 'delete', notificationPreferences)).toBeDefined();
    expect(findCall(calls, 'delete', personPrivacySettings)).toBeDefined();
  });

  test('person.deleted — subscriber failure in one module does not block others', async () => {
    // Force assoc:member update(memberships) to throw; assert later subscribers still ran.
    const calls: CascadeCall[] = [];
    let memCount = 0;
    const db = {
      update(table: any) {
        const call: CascadeCall = { op: 'update', table };
        calls.push(call);
        return {
          set(values: any) {
            call.set = values;
            return {
              where: (_cond: any) => {
                if (table === memberships && memCount++ === 0) {
                  return Promise.reject(new Error('synthetic db failure'));
                }
                return Promise.resolve();
              },
            };
          },
        };
      },
      delete(table: any) {
        calls.push({ op: 'delete', table });
        return { where: (_c: any) => Promise.resolve() };
      },
      insert(table: any) {
        const call: CascadeCall = { op: 'insert', table };
        calls.push(call);
        return { values: async (v: any) => { call.values = v; } };
      },
      select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
    } as any;

    registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db }, logger as any);

    await domainEvents.emit('person.deleted', personDeletedPayload);

    // assoc:member failed at memberships — but later subscribers must have run
    expect(findCall(calls, 'delete', personSubscriptions)).toBeDefined(); // communication
    expect(findCall(calls, 'delete', documents)).toBeDefined();           // documents
    expect(findCall(calls, 'delete', invitationTokens)).toBeDefined();    // invite
    expect(findCall(calls, 'delete', notificationPreferences)).toBeDefined(); // person
    expect(logger.error).toHaveBeenCalled();
  });
});
