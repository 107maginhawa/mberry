/**
 * Tests for registerDomainEventConsumers
 *
 * The consumer registers a handler for dues.payment.recorded that
 * updates the membership duesExpiryDate when a payment includes a new expiry.
 */

import { describe, test, expect, mock, beforeEach, spyOn } from 'bun:test';
import { DomainEventBus, domainEvents } from './domain-events';
import { registerDomainEventConsumers, type DomainEventMembershipRepo } from './domain-event-consumers';
import { SYSTEM_USER_ID } from './constants';
import { AuditRepository } from '@/handlers/audit/repos/audit.repo';

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
import { surveyResponses } from '@/handlers/surveys/repos/survey.schema';
import { chatRooms, chatRoomMembers } from '@/handlers/comms/repos/comms.schema';
import { trainingEnrollments, eventRegistrations } from './schema-registry';
import { invitationTokens } from './schema-registry';
import { EmailQueueRepository } from '@/handlers/email/repos/queue.repo';

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

// db mock for the GDPR account-lifecycle consumers (FIX-007). `select().from(t).where()`
// resolves to memberships rows by default, officerTerms rows when t === officerTerms;
// supports a trailing `.limit(n)`. `insert().values()` captures inserted rows (array or one).
function makeGdprDb(opts: { memberships?: any[]; officers?: any[]; inserted: any[] }) {
  const memRows = opts.memberships ?? [];
  const offRows = opts.officers ?? [];
  return {
    select: (_cols?: any) => ({
      from: (table: any) => ({
        where: (_cond: any) => {
          const rows = table === officerTerms ? offRows : memRows;
          const p: any = Promise.resolve(rows);
          p.limit = (_n: number) => Promise.resolve(rows);
          return p;
        },
      }),
    }),
    insert: (_t: any) => ({
      values: async (v: any) => {
        if (Array.isArray(v)) opts.inserted.push(...v);
        else opts.inserted.push(v);
      },
    }),
  } as any;
}

const flushFireAndForget = () => new Promise((r) => setTimeout(r, 0));

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

  // ─── FIX-010 (G12) — gate "certificate available" notification on cert existence ───
  //
  // The training.completed consumer historically notified every enrolled member
  // "your certificate is available to download" even when issuance (manual
  // officer-initiated bulk-issue) had produced no certificate. Gate the notify
  // on an actual non-revoked certificate for that training+person.

  // The consumer block is intentionally fire-and-forget (bulk chunked inserts
  // must not block the event bus), so let queued microtasks settle before asserting.
  const flushAsync = () => new Promise((r) => setTimeout(r, 0));

  function makeTrainingCertDb(opts: { enrollees: any[]; certs: any[]; inserted: any[] }) {
    return {
      select: () => ({
        from: (table: any) => ({
          where: () =>
            Promise.resolve(table === certificates ? opts.certs : opts.enrollees),
        }),
      }),
      insert: () => ({
        values: async (v: any) => {
          for (const row of Array.isArray(v) ? v : [v]) opts.inserted.push(row);
        },
      }),
    } as any;
  }

  test('training.completed → does NOT notify when no certificate was issued', async () => {
    const inserted: any[] = [];
    const db = makeTrainingCertDb({
      enrollees: [{ personId: 'p1' }, { personId: 'p2' }],
      certs: [],
      inserted,
    });
    registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db }, logger as any);

    await domainEvents.emit('training.completed', {
      trainingId: 't1',
      organizationId: 'org-1',
      completedBy: 'officer-1',
    });
    await flushAsync();

    expect(inserted).toHaveLength(0);
  });

  test('training.completed → notifies only members with a non-revoked certificate', async () => {
    const inserted: any[] = [];
    const db = makeTrainingCertDb({
      enrollees: [{ personId: 'p1' }, { personId: 'p2' }, { personId: 'p3' }],
      // p1 issued, p3 revoked, p2 none.
      certs: [
        { personId: 'p1', status: 'issued' },
        { personId: 'p3', status: 'revoked' },
      ],
      inserted,
    });
    registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db }, logger as any);

    await domainEvents.emit('training.completed', {
      trainingId: 't1',
      organizationId: 'org-1',
      completedBy: 'officer-1',
    });
    await flushAsync();

    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      recipient: 'p1',
      relatedEntityType: 'training',
      relatedEntity: 't1',
      title: 'Certificate Available',
    });
  });

  // ─── FIX-011 (G13) — verification.requested → write an audit record ───
  //
  // verifyCertificatePublic emits verification.requested but had ZERO
  // consumers, so public certificate verifications went unlogged. Add a
  // consumer that writes a tamper-evident audit_log_entry (via the platform
  // AuditRepository) for each verification attempt.

  function makeCertLookupDb(organizationId: string | undefined) {
    return {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve(organizationId ? [{ organizationId }] : []),
          }),
        }),
      }),
      insert: () => ({ values: async () => {} }),
    } as any;
  }

  test('verification.requested → writes a certificate-verification audit record', async () => {
    const logSpy = spyOn(AuditRepository.prototype, 'logEvent').mockResolvedValue({} as any);
    try {
      registerDomainEventConsumers(
        { membershipRepo: makeMembershipRepo(), db: makeCertLookupDb('org-1') },
        logger as any,
      );

      await domainEvents.emit('verification.requested', {
        credentialNumber: 'CERT-123',
        verified: true,
      });

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0]).toMatchObject({
        resourceType: 'certificate',
        resource: 'CERT-123',
        action: 'read',
        outcome: 'success',
        organizationId: 'org-1',
      });
    } finally {
      logSpy.mockRestore();
    }
  });

  test('verification.requested with verified=false → audit outcome is failure', async () => {
    const logSpy = spyOn(AuditRepository.prototype, 'logEvent').mockResolvedValue({} as any);
    try {
      registerDomainEventConsumers(
        { membershipRepo: makeMembershipRepo(), db: makeCertLookupDb('org-2') },
        logger as any,
      );

      await domainEvents.emit('verification.requested', {
        credentialNumber: 'CERT-999',
        verified: false,
      });

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0]).toMatchObject({
        resource: 'CERT-999',
        outcome: 'failure',
        organizationId: 'org-2',
      });
    } finally {
      logSpy.mockRestore();
    }
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

  test('person.deleted → surveys — anonymizes survey responses (NULL responder_id, BR-32)', async () => {
    const { db, calls } = makeCascadeCapturingDb();
    registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db }, logger as any);

    await domainEvents.emit('person.deleted', personDeletedPayload);

    // Identified responses are de-anonymized (responder_id → null) but the
    // answers are retained for aggregate integrity (BR-32). No hard delete.
    expect(findCall(calls, 'update', surveyResponses)?.set).toMatchObject({
      responderId: null,
      updatedBy: SYSTEM_USER_ID,
    });
    expect(findCall(calls, 'delete', surveyResponses)).toBeUndefined();
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

  // -------------------------------------------------------------------------
  // FIX-007 (G-07): the GDPR account-lifecycle events were emitted with ZERO
  // consumers. Wire them: officers learn of deletion requests/cancellations
  // (Spec 10b); the requester learns their data export is ready.
  // -------------------------------------------------------------------------
  describe('GDPR account-lifecycle consumers (FIX-007)', () => {
    test('person.deletion.requested → notifies active officers of the member\'s orgs (excluding self)', async () => {
      const inserted: any[] = [];
      const db = makeGdprDb({
        memberships: [{ organizationId: 'org-1' }],
        officers: [{ personId: 'officer-1' }, { personId: 'person-1' }], // person-1 is the deleting member
        inserted,
      });
      registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db }, logger as any);

      await domainEvents.emit('person.deletion.requested', {
        personId: 'person-1',
        scheduledDate: '2026-07-12T00:00:00.000Z',
      });
      await flushFireAndForget();

      // Self is excluded; only the other active officer is notified.
      expect(inserted).toHaveLength(1);
      expect(inserted[0]).toMatchObject({
        organizationId: 'org-1',
        recipient: 'officer-1',
        type: 'system',
        channel: 'in-app',
        relatedEntityType: 'person',
        relatedEntity: 'person-1',
      });
    });

    test('person.deletion.cancelled → notifies active officers of the member\'s orgs', async () => {
      const inserted: any[] = [];
      const db = makeGdprDb({
        memberships: [{ organizationId: 'org-1' }],
        officers: [{ personId: 'officer-1' }],
        inserted,
      });
      registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db }, logger as any);

      await domainEvents.emit('person.deletion.cancelled', { personId: 'person-1' });
      await flushFireAndForget();

      expect(inserted).toHaveLength(1);
      expect(inserted[0]).toMatchObject({
        organizationId: 'org-1',
        recipient: 'officer-1',
        relatedEntityType: 'person',
        relatedEntity: 'person-1',
      });
    });

    test('data-export.ready → notifies the requester that their export is ready', async () => {
      const inserted: any[] = [];
      const db = makeGdprDb({ memberships: [{ organizationId: 'org-1' }], inserted });
      registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db }, logger as any);

      await domainEvents.emit('data-export.ready', {
        personId: 'person-1',
        exportId: 'exp-1',
        downloadUrl: '/persons/me/data-export/exp-1/download',
      });
      await flushFireAndForget();

      expect(inserted).toHaveLength(1);
      expect(inserted[0]).toMatchObject({
        organizationId: 'org-1',
        recipient: 'person-1',
        type: 'system',
        channel: 'in-app',
        relatedEntityType: 'data-export',
        relatedEntity: 'exp-1',
      });
    });

    test('data-export.ready → skips when the requester has no active org (org-scoped notification cannot be built)', async () => {
      const inserted: any[] = [];
      const db = makeGdprDb({ memberships: [], inserted });
      registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db }, logger as any);

      await domainEvents.emit('data-export.ready', {
        personId: 'person-1',
        exportId: 'exp-1',
        downloadUrl: '/x',
      });
      await flushFireAndForget();

      expect(inserted).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // FIX-012 (G12 / PA-8): ticket reopen + status-change notifications.
  // ticket.reopened → alert the assignee; ticket.status.changed → notify the
  // reporter. Both produce in-app notifications via the raw-insert pattern.
  // -------------------------------------------------------------------------
  describe('Ticket notification consumers (FIX-012)', () => {
    function makeTicketDb(inserted: any[]) {
      return {
        insert: () => ({ values: async (v: any) => { inserted.push(v); } }),
        select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
      } as any;
    }

    test('ticket.reopened → in-app notification to the assignee', async () => {
      const inserted: any[] = [];
      registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db: makeTicketDb(inserted) }, logger as any);

      await domainEvents.emit('ticket.reopened', {
        ticketId: 't1',
        organizationId: 'org-1',
        assignedTo: 'admin-9',
        reopenedBy: 'officer-1',
        subject: 'Login broken',
      });

      expect(inserted).toHaveLength(1);
      expect(inserted[0]).toMatchObject({
        organizationId: 'org-1',
        recipient: 'admin-9',
        channel: 'in-app',
        relatedEntityType: 'support-ticket',
        relatedEntity: 't1',
      });
    });

    test('ticket.reopened → skips when the ticket has no assignee', async () => {
      const inserted: any[] = [];
      registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db: makeTicketDb(inserted) }, logger as any);

      await domainEvents.emit('ticket.reopened', {
        ticketId: 't1',
        organizationId: 'org-1',
        assignedTo: null,
        reopenedBy: 'officer-1',
        subject: 'Login broken',
      });

      expect(inserted).toHaveLength(0);
    });

    test('ticket.status.changed → in-app notification to the reporter', async () => {
      const inserted: any[] = [];
      registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db: makeTicketDb(inserted) }, logger as any);

      await domainEvents.emit('ticket.status.changed', {
        ticketId: 't1',
        organizationId: 'org-1',
        reportedBy: 'officer-7',
        status: 'resolved',
        subject: 'Login broken',
      });

      expect(inserted).toHaveLength(1);
      expect(inserted[0]).toMatchObject({
        organizationId: 'org-1',
        recipient: 'officer-7',
        channel: 'in-app',
        relatedEntityType: 'support-ticket',
        relatedEntity: 't1',
      });
      expect(inserted[0].message).toContain('resolved');
    });
  });

  // -------------------------------------------------------------------------
  // FIX-003 (G4): admin.invited was emitted by inviteAdmin with ZERO consumers,
  // so the invitee never received an invite email and the invite was a dead end.
  // Wire a consumer that queues the invite email via the email queue.
  // -------------------------------------------------------------------------
  describe('admin.invited email consumer (FIX-003)', () => {
    test('admin.invited → queues the invite email to the invitee', async () => {
      const queueSpy = spyOn(EmailQueueRepository.prototype, 'queueEmail').mockResolvedValue({} as any);
      try {
        registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db: mockDb }, logger as any);

        await domainEvents.emit('admin.invited', {
          adminId: 'pa-9',
          email: 'new@example.com',
          role: 'support',
        });

        expect(queueSpy).toHaveBeenCalledTimes(1);
        const arg = queueSpy.mock.calls[0][0] as any;
        expect(arg.recipient).toBe('new@example.com');
        expect(arg.templateTags).toContain('admin.invite');
        expect(arg.variables).toMatchObject({ role: 'support' });
      } finally {
        queueSpy.mockRestore();
      }
    });
  });

  // -------------------------------------------------------------------------
  // FIX-004 (G2) — default-channel provisioning + member auto-join (PD-1).
  //
  // organization.created → provision #general + #announcements channels.
  // membership.created / membership.imported → auto-join the new member(s) to
  // every channel in the org (chat_room_member join table + JSONB participants),
  // so the /messages surface is non-empty for ordinary members.
  // -------------------------------------------------------------------------
  describe('comms channel provisioning + auto-join (FIX-004)', () => {
    // Capturing db supporting both createDefaultChannels (select.limit + insert.returning)
    // and autoJoinOrgChannels (select awaited + insert.onConflictDoNothing + update).
    function makeChannelDb(opts: { orgChannels?: any[]; existingChannels?: any[] } = {}) {
      const inserted: Array<{ table: any; values: any }> = [];
      const updated: Array<{ table: any; set: any }> = [];
      let seq = 0;
      const db = {
        select: (_cols?: any) => ({
          from: (_table: any) => ({
            where: (_c: any) => {
              const p: any = Promise.resolve(opts.orgChannels ?? []);
              p.limit = (_n: number) => Promise.resolve(opts.existingChannels ?? []);
              return p;
            },
          }),
        }),
        insert: (table: any) => ({
          values: (v: any) => {
            inserted.push({ table, values: v });
            const id = `room-${++seq}`;
            return {
              returning: async () => [{ id }],
              onConflictDoNothing: async () => {},
            };
          },
        }),
        update: (table: any) => ({
          set: (s: any) => {
            updated.push({ table, set: s });
            return { where: async () => {} };
          },
        }),
      } as any;
      return { db, inserted, updated };
    }

    test('organization.created → provisions #general and #announcements channels', async () => {
      const { db, inserted } = makeChannelDb({ existingChannels: [] });
      registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db }, logger as any);

      await domainEvents.emit('organization.created', {
        organizationId: 'org-1',
        associationId: 'assoc-1',
        name: 'Acme Dental',
      });
      await flushFireAndForget();

      const roomInserts = inserted.filter((i) => i.table === chatRooms);
      expect(roomInserts).toHaveLength(2);
      const names = roomInserts.map((i) => i.values.name).sort();
      expect(names).toEqual(['announcements', 'general']);
      expect(roomInserts.every((i) => i.values.roomType === 'channel')).toBe(true);
      expect(roomInserts.every((i) => i.values.organizationId === 'org-1')).toBe(true);
    });

    test('membership.created → auto-joins the member to org channels (join table + JSONB)', async () => {
      const { db, inserted, updated } = makeChannelDb({
        orgChannels: [{ id: 'chan-1', participants: ['existing-1'] }],
      });
      registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db }, logger as any);

      await domainEvents.emit('membership.created', {
        membershipId: 'mem-1',
        personId: 'person-new',
        organizationId: 'org-1',
        source: 'manual',
      });
      await flushFireAndForget();

      // Join-table insert for the new member.
      const memberInsert = inserted.find((i) => i.table === chatRoomMembers);
      expect(memberInsert).toBeDefined();
      expect(memberInsert!.values).toMatchObject({ chatRoomId: 'chan-1', personId: 'person-new' });

      // JSONB participants appended (kept in sync so listChatRooms surfaces it).
      const roomUpdate = updated.find((u) => u.table === chatRooms);
      expect(roomUpdate).toBeDefined();
      expect(roomUpdate!.set.participants).toEqual(['existing-1', 'person-new']);
    });

    test('membership.created → does not double-append a member already in JSONB participants', async () => {
      const { db, updated } = makeChannelDb({
        orgChannels: [{ id: 'chan-1', participants: ['person-existing'] }],
      });
      registerDomainEventConsumers({ membershipRepo: makeMembershipRepo(), db }, logger as any);

      await domainEvents.emit('membership.created', {
        membershipId: 'mem-2',
        personId: 'person-existing',
        organizationId: 'org-1',
        source: 'application',
      });
      await flushFireAndForget();

      // Already a participant → no JSONB update (idempotent).
      expect(updated.find((u) => u.table === chatRooms)).toBeUndefined();
    });
  });
});
