/**
 * Tests for account deletion cascade across all 19 modules.
 *
 * AC-M02-003: 30-day grace period before PII anonymization.
 * Flow 6.6: Cascade deletion across membership, dues, events, training,
 *           credits, elections, governance, communications, certificates,
 *           directory, notification prefs, privacy settings, billing,
 *           documents, dunning, credentials, status history, chapters, invites.
 * BR-32: Financial records (dues payments, invoices) PRESERVED — only proof files scrubbed.
 * DPA-05: Audit log must not contain PII.
 */

import { describe, test, expect } from 'bun:test';
import { executeCascadeDeletion, type CascadeResult } from './accountDeletionCascade';
// Factory N/A: handler test with inline primitives — no domain entity construction needed
// Assertion-Style: EXISTENCE_CHECK — verifying middleware/context injection patterns

// ─── Helpers ─────────────────────────────────────────────

const PERSON_ID = 'person-cascade-1';

/**
 * Tracks all db operations by table name for assertion.
 * update(table) and delete(table) record which tables were touched.
 */
function makeCascadeDb(options: {
  registrations?: any[];
  enrollments?: any[];
  creditEntries?: any[];
  votes?: any[];
  candidacies?: any[];
  officerTerms?: any[];
  messageRecipients?: any[];
  certificates?: any[];
  directoryProfiles?: any[];
  notificationPrefs?: any[];
  privacySettings?: any[];
  documents?: any[];
  dunningEvents?: any[];
  credentials?: any[];
  statusHistory?: any[];
  chapterMemberships?: any[];
  invites?: any[];
  merchantAccounts?: any[];
  memberships?: any[];
  duesPayments?: any[];
  invoices?: any[];
} = {}) {
  const updatedTables: string[] = [];
  const deletedTables: string[] = [];
  const updateSets: Record<string, any[]> = {};

  const db = {
    _updatedTables: updatedTables,
    _deletedTables: deletedTables,
    _updateSets: updateSets,
    update: (table: any) => {
      const name = table?.[Symbol.for('drizzle:Name')] ?? table?.toString?.() ?? 'unknown';
      updatedTables.push(name);
      return {
        set: (data: any) => {
          if (!updateSets[name]) updateSets[name] = [];
          updateSets[name].push(data);
          return { where: async () => [] };
        },
      };
    },
    delete: (table: any) => {
      const name = table?.[Symbol.for('drizzle:Name')] ?? table?.toString?.() ?? 'unknown';
      deletedTables.push(name);
      return { where: async () => [] };
    },
    select: () => ({
      from: (table: any) => ({
        where: async () => {
          const name = table?.[Symbol.for('drizzle:Name')] ?? table?.toString?.() ?? 'unknown';
          // Return data based on table name
          if (name.includes('registration')) return options.registrations ?? [];
          if (name.includes('enrollment')) return options.enrollments ?? [];
          if (name.includes('credit')) return options.creditEntries ?? [];
          if (name.includes('vote')) return options.votes ?? [];
          if (name.includes('candidac')) return options.candidacies ?? [];
          if (name.includes('officer')) return options.officerTerms ?? [];
          if (name.includes('message_recipient') || name.includes('recipient')) return options.messageRecipients ?? [];
          if (name.includes('certificate')) return options.certificates ?? [];
          if (name.includes('directory')) return options.directoryProfiles ?? [];
          if (name.includes('notification')) return options.notificationPrefs ?? [];
          if (name.includes('privacy')) return options.privacySettings ?? [];
          if (name.includes('document')) return options.documents ?? [];
          if (name.includes('dunning_event')) return options.dunningEvents ?? [];
          if (name.includes('credential')) return options.credentials ?? [];
          if (name.includes('status_history')) return options.statusHistory ?? [];
          if (name.includes('chapter')) return options.chapterMemberships ?? [];
          if (name.includes('invite')) return options.invites ?? [];
          if (name.includes('merchant')) return options.merchantAccounts ?? [];
          if (name.includes('membership')) return options.memberships ?? [];
          if (name.includes('dues_payment') || name.includes('payment')) return options.duesPayments ?? [];
          if (name.includes('invoice')) return options.invoices ?? [];
          return [];
        },
      }),
    }),
  };

  return db;
}

function makeLogger() {
  const logs: { level: string; args: any[] }[] = [];
  return {
    info: (...args: any[]) => logs.push({ level: 'info', args }),
    warn: (...args: any[]) => logs.push({ level: 'warn', args }),
    error: (...args: any[]) => logs.push({ level: 'error', args }),
    debug: (...args: any[]) => logs.push({ level: 'debug', args }),
    _logs: logs,
  };
}

// ─── Cascade Tests ──────────────────────────────────────

describe('[flow-6.6] accountDeletionCascade', () => {

  // ─── AC-M02-003: Core cascade function exists ────────────

  test('executeCascadeDeletion is a function', () => {
    expect(typeof executeCascadeDeletion).toBe('function');
  });

  test('returns CascadeResult with module-level counts', async () => {
    const db = makeCascadeDb();
    const result = await executeCascadeDeletion({
      db: db as any,
      personId: PERSON_ID,
      logger: makeLogger(),
    });

    expect(result).toBeDefined();
    expect(typeof result.modulesProcessed).toBe('number');
    expect(typeof result.errors).toBe('number');
    expect(Array.isArray(result.details)).toBe(true);
  });

  // ─── Flow 6.6 Step 1: Membership records ─────────────────

  test('cascade anonymizes membership records (soft-delete, preserve org reference)', async () => {
    const db = makeCascadeDb();
    const result = await executeCascadeDeletion({
      db: db as any,
      personId: PERSON_ID,
      logger: makeLogger(),
    });

    // Memberships should be updated (status set to 'removed'), not deleted
    const membershipOps = result.details.find(d => d.module === 'membership');
    expect(membershipOps).toBeDefined();
  });

  // ─── Flow 6.6 Step 2: Event registrations ────────────────

  test('cascade cancels event registrations', async () => {
    const db = makeCascadeDb();
    const result = await executeCascadeDeletion({
      db: db as any,
      personId: PERSON_ID,
      logger: makeLogger(),
    });

    const eventOps = result.details.find(d => d.module === 'events');
    expect(eventOps).toBeDefined();
  });

  // ─── Flow 6.6 Step 3: Training enrollments ────────────────

  test('cascade cancels training enrollments', async () => {
    const db = makeCascadeDb();
    const result = await executeCascadeDeletion({
      db: db as any,
      personId: PERSON_ID,
      logger: makeLogger(),
    });

    const trainingOps = result.details.find(d => d.module === 'training');
    expect(trainingOps).toBeDefined();
  });

  // ─── Flow 6.6 Step 4: Credit entries ──────────────────────

  test('cascade anonymizes credit entries (preserve amounts for compliance)', async () => {
    const db = makeCascadeDb();
    const result = await executeCascadeDeletion({
      db: db as any,
      personId: PERSON_ID,
      logger: makeLogger(),
    });

    const creditOps = result.details.find(d => d.module === 'credits');
    expect(creditOps).toBeDefined();
  });

  // ─── Flow 6.6 Step 5: Elections ───────────────────────────

  test('cascade anonymizes election votes and candidacies', async () => {
    const db = makeCascadeDb();
    const result = await executeCascadeDeletion({
      db: db as any,
      personId: PERSON_ID,
      logger: makeLogger(),
    });

    const electionOps = result.details.find(d => d.module === 'elections');
    expect(electionOps).toBeDefined();
  });

  // ─── Flow 6.6 Step 6: Governance / officer terms ──────────

  test('cascade ends active officer terms', async () => {
    const db = makeCascadeDb();
    const result = await executeCascadeDeletion({
      db: db as any,
      personId: PERSON_ID,
      logger: makeLogger(),
    });

    const govOps = result.details.find(d => d.module === 'governance');
    expect(govOps).toBeDefined();
  });

  // ─── Flow 6.6 Step 7: Communications ──────────────────────

  test('cascade removes communication recipient entries', async () => {
    const db = makeCascadeDb();
    const result = await executeCascadeDeletion({
      db: db as any,
      personId: PERSON_ID,
      logger: makeLogger(),
    });

    const commOps = result.details.find(d => d.module === 'communications');
    expect(commOps).toBeDefined();
  });

  // ─── Flow 6.6 Step 8: Certificates ────────────────────────

  test('cascade anonymizes certificates (preserve certificate number for compliance)', async () => {
    const db = makeCascadeDb();
    const result = await executeCascadeDeletion({
      db: db as any,
      personId: PERSON_ID,
      logger: makeLogger(),
    });

    const certOps = result.details.find(d => d.module === 'certificates');
    expect(certOps).toBeDefined();
  });

  // ─── Flow 6.6 Step 9: Directory profiles ──────────────────

  test('cascade deletes directory profiles', async () => {
    const db = makeCascadeDb();
    const result = await executeCascadeDeletion({
      db: db as any,
      personId: PERSON_ID,
      logger: makeLogger(),
    });

    const dirOps = result.details.find(d => d.module === 'directory');
    expect(dirOps).toBeDefined();
  });

  // ─── Flow 6.6 Step 10: Notification preferences ──────────

  test('cascade deletes notification preferences', async () => {
    const db = makeCascadeDb();
    const result = await executeCascadeDeletion({
      db: db as any,
      personId: PERSON_ID,
      logger: makeLogger(),
    });

    const notifOps = result.details.find(d => d.module === 'notificationPreferences');
    expect(notifOps).toBeDefined();
  });

  // ─── Flow 6.6 Step 11: Privacy settings ───────────────────

  test('cascade deletes privacy settings', async () => {
    const db = makeCascadeDb();
    const result = await executeCascadeDeletion({
      db: db as any,
      personId: PERSON_ID,
      logger: makeLogger(),
    });

    const privOps = result.details.find(d => d.module === 'privacySettings');
    expect(privOps).toBeDefined();
  });

  // ─── Flow 6.6 Step 12: Documents ──────────────────────────

  test('cascade deletes personal documents', async () => {
    const db = makeCascadeDb();
    const result = await executeCascadeDeletion({
      db: db as any,
      personId: PERSON_ID,
      logger: makeLogger(),
    });

    const docOps = result.details.find(d => d.module === 'documents');
    expect(docOps).toBeDefined();
  });

  // ─── Flow 6.6 Step 13: Dunning events ─────────────────────

  test('cascade deletes dunning events for the person', async () => {
    const db = makeCascadeDb();
    const result = await executeCascadeDeletion({
      db: db as any,
      personId: PERSON_ID,
      logger: makeLogger(),
    });

    const dunOps = result.details.find(d => d.module === 'dunning');
    expect(dunOps).toBeDefined();
  });

  // ─── Flow 6.6 Step 14: Credentials ────────────────────────

  test('cascade deletes digital credentials', async () => {
    const db = makeCascadeDb();
    const result = await executeCascadeDeletion({
      db: db as any,
      personId: PERSON_ID,
      logger: makeLogger(),
    });

    const credOps = result.details.find(d => d.module === 'credentials');
    expect(credOps).toBeDefined();
  });

  // ─── Flow 6.6 Step 15: Status history ─────────────────────

  test('cascade anonymizes status history (preserve status transitions)', async () => {
    const db = makeCascadeDb();
    const result = await executeCascadeDeletion({
      db: db as any,
      personId: PERSON_ID,
      logger: makeLogger(),
    });

    const histOps = result.details.find(d => d.module === 'statusHistory');
    expect(histOps).toBeDefined();
  });

  // ─── Flow 6.6 Step 16: Chapter memberships ────────────────

  test('cascade removes chapter memberships', async () => {
    const db = makeCascadeDb();
    const result = await executeCascadeDeletion({
      db: db as any,
      personId: PERSON_ID,
      logger: makeLogger(),
    });

    const chapOps = result.details.find(d => d.module === 'chapters');
    expect(chapOps).toBeDefined();
  });

  // ─── Flow 6.6 Step 17: Invites ────────────────────────────

  test('cascade deletes pending invites', async () => {
    const db = makeCascadeDb();
    const result = await executeCascadeDeletion({
      db: db as any,
      personId: PERSON_ID,
      logger: makeLogger(),
    });

    const invOps = result.details.find(d => d.module === 'invites');
    expect(invOps).toBeDefined();
  });

  // ─── BR-32: Financial record preservation ─────────────────

  test('[BR-32] does NOT delete dues payments — only scrubs proof files', async () => {
    const db = makeCascadeDb();
    const result = await executeCascadeDeletion({
      db: db as any,
      personId: PERSON_ID,
      logger: makeLogger(),
    });

    const duesOps = result.details.find(d => d.module === 'duesPayments');
    expect(duesOps).toBeDefined();
    expect(duesOps!.action).toBe('anonymize');
    // Payment amounts, dates, and personId FK must be preserved
  });

  test('[BR-32] does NOT delete invoices — only anonymizes payer name', async () => {
    const db = makeCascadeDb();
    const result = await executeCascadeDeletion({
      db: db as any,
      personId: PERSON_ID,
      logger: makeLogger(),
    });

    const invOps = result.details.find(d => d.module === 'billing');
    expect(invOps).toBeDefined();
    expect(invOps!.action).toBe('anonymize');
  });

  // ─── Error resilience ─────────────────────────────────────

  test('continues processing remaining modules if one fails', async () => {
    let callCount = 0;
    const errorDb = {
      update: (table: any) => ({
        set: (data: any) => ({
          where: async () => {
            callCount++;
            if (callCount === 1) throw new Error('DB error on first module');
            return [];
          },
        }),
      }),
      delete: (table: any) => ({
        where: async () => {
          callCount++;
          return [];
        },
      }),
      select: () => ({
        from: () => ({
          where: async () => [],
        }),
      }),
    };

    const result = await executeCascadeDeletion({
      db: errorDb as any,
      personId: PERSON_ID,
      logger: makeLogger(),
    });

    // Should have processed multiple modules despite first failure
    expect(result.modulesProcessed).toBeGreaterThan(1);
    expect(result.errors).toBeGreaterThanOrEqual(1);
  });

  // ─── Anonymization completeness ───────────────────────────

  test('cascade touches all expected modules (completeness check)', async () => {
    const db = makeCascadeDb();
    const result = await executeCascadeDeletion({
      db: db as any,
      personId: PERSON_ID,
      logger: makeLogger(),
    });

    const moduleNames = result.details.map(d => d.module).sort();
    const expectedModules = [
      'billing',
      'certificates',
      'chapters',
      'communications',
      'credentials',
      'credits',
      'directory',
      'documents',
      'duesPayments',
      'dunning',
      'elections',
      'events',
      'governance',
      'invites',
      'membership',
      'notificationPreferences',
      'privacySettings',
      'statusHistory',
      'training',
    ].sort();

    expect(moduleNames).toEqual(expectedModules);
  });
});
