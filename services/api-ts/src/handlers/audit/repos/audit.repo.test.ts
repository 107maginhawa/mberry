/**
 * Unit tests for AuditRepository
 *
 * Tests the audit trail data access layer including:
 * - Integrity hash calculation and verification (SHA-256)
 * - HIPAA-compliant purge date (7 years)
 * - Log archival and purge workflows
 * - Audit statistics aggregation
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { createHash } from 'crypto';
import { AuditRepository } from './audit.repo';
import type { AuditLogEntry, CreateAuditLogRequest } from './audit.schema';

// Mock-Classification: APPROPRIATE — audit logging infrastructure boundary
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger() {
  return {
    debug: mock(() => {}),
    info: mock(() => {}),
    error: mock(() => {}),
    warn: mock(() => {}),
  };
}

/** Deterministic SHA-256 hash matching the repo's algorithm */
function expectedHash(data: Record<string, any>): string {
  const sortedKeys = Object.keys(data).sort();
  const hashableString = sortedKeys
    .map(key => `${key}:${data[key]}`)
    .join('|');
  return createHash('sha256').update(hashableString).digest('hex');
}

function makeRequest(overrides: Partial<CreateAuditLogRequest> = {}): CreateAuditLogRequest {
  return {
    eventType: 'data-access',
    category: 'hipaa',
    action: 'read',
    outcome: 'success',
    organizationId: 'org-1',
    user: 'user-1',
    userType: 'admin',
    resourceType: 'patient_record',
    resource: 'record-123',
    description: 'Accessed patient record',
    ...overrides,
  };
}

function makeAuditEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  const now = new Date('2025-01-15T10:00:00.000Z');
  return {
    id: 'audit-1',
    eventType: 'data-access',
    category: 'hipaa',
    action: 'read',
    outcome: 'success',
    organizationId: 'org-1',
    user: 'user-1',
    userType: 'admin',
    resourceType: 'patient_record',
    resource: 'record-123',
    description: 'Accessed patient record',
    details: null,
    ipAddress: null,
    userAgent: null,
    session: null,
    request: null,
    integrityHash: null,
    retentionStatus: 'active',
    archivedAt: null,
    archivedBy: null,
    purgeAfter: null,
    createdAt: now,
    updatedAt: now,
    createdBy: 'user-1',
    updatedBy: 'user-1',
    version: 1,
    ...overrides,
  } as AuditLogEntry;
}

/**
 * Build a mock db that stubs insert/update/delete chains.
 * Each chain method returns `this` for fluent chaining.
 */
function makeMockDb(overrides: {
  insertReturning?: any[];
  updateReturning?: any[];
  deleteReturning?: any[];
  selectResult?: any[];
  countResult?: number;
} = {}) {
  const insertChain = {
    values: mock(function(this: any) { return this; }),
    returning: mock(() => overrides.insertReturning ?? [makeAuditEntry()]),
  };

  const updateChain = {
    set: mock(function(this: any) { return this; }),
    where: mock(function(this: any) { return this; }),
    returning: mock(() => overrides.updateReturning ?? []),
  };

  const deleteChain = {
    where: mock(function(this: any) { return this; }),
    returning: mock(() => overrides.deleteReturning ?? []),
  };

  const selectChain = {
    from: mock(function(this: any) { return this; }),
    where: mock(function(this: any) { return this; }),
    limit: mock(function(this: any) { return this; }),
    offset: mock(function(this: any) { return this; }),
    orderBy: mock(function(this: any) { return this; }),
    then: mock((resolve: any) => resolve(overrides.selectResult ?? [])),
    [Symbol.asyncIterator]: undefined,
  };

  // Make selectChain thenable so await works
  const selectThenable = {
    ...selectChain,
    then(onFulfilled: any, onRejected?: any) {
      return Promise.resolve(overrides.selectResult ?? []).then(onFulfilled, onRejected);
    },
  };

  return {
    insert: mock(() => insertChain),
    update: mock(() => updateChain),
    delete: mock(() => deleteChain),
    select: mock(() => selectThenable),
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuditRepository', () => {

  // ── logEvent ────────────────────────────────────────────

  describe('logEvent', () => {
    test('creates entry with SHA-256 integrity hash', async () => {
      let capturedData: any = null;
      const mockDb = makeMockDb();
      // Override insert chain to capture data and return it
      const insertChain = {
        values: mock(function(this: any, data: any) {
          capturedData = data;
          return this;
        }),
        returning: mock(() => {
          return [{ ...makeAuditEntry(), ...capturedData }];
        }),
      };
      mockDb.insert = mock(() => insertChain);

      const logger = makeLogger();
      const repo = new AuditRepository(mockDb, logger);

      const request = makeRequest();
      const result = await repo.logEvent(request, 'creator-1');

      // Verify integrity hash is a 64-char hex string (SHA-256)
      expect(result.integrityHash).toBeDefined();
      expect(typeof result.integrityHash).toBe('string');
      expect(result.integrityHash!.length).toBe(64);
      expect(result.integrityHash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('sets retentionStatus to active', async () => {
      let capturedData: any = null;
      const mockDb = makeMockDb();
      const insertChain = {
        values: mock(function(this: any, data: any) {
          capturedData = data;
          return this;
        }),
        returning: mock(() => [{ ...makeAuditEntry(), ...capturedData }]),
      };
      mockDb.insert = mock(() => insertChain);

      const repo = new AuditRepository(mockDb, makeLogger());
      const result = await repo.logEvent(makeRequest());

      expect(result.retentionStatus).toBe('active');
    });

    test('sets purgeAfter to ~7 years from now (HIPAA)', async () => {
      let capturedData: any = null;
      const mockDb = makeMockDb();
      const insertChain = {
        values: mock(function(this: any, data: any) {
          capturedData = data;
          return this;
        }),
        returning: mock(() => [{ ...makeAuditEntry(), ...capturedData }]),
      };
      mockDb.insert = mock(() => insertChain);

      const repo = new AuditRepository(mockDb, makeLogger());
      await repo.logEvent(makeRequest());

      expect(capturedData).toBeDefined();
      expect(capturedData.purgeAfter).toBeInstanceOf(Date);

      // purgeAfter should be ~7 years from now
      // addYears uses calendar years, so we check the year difference
      const now = new Date();
      const purgeYear = capturedData.purgeAfter.getFullYear();
      const currentYear = now.getFullYear();
      expect(purgeYear - currentYear).toBeGreaterThanOrEqual(6);
      expect(purgeYear - currentYear).toBeLessThanOrEqual(7);
    });

    test('uses createdBy when provided', async () => {
      let capturedData: any = null;
      const mockDb = makeMockDb();
      const insertChain = {
        values: mock(function(this: any, data: any) {
          capturedData = data;
          return this;
        }),
        returning: mock(() => [{ ...makeAuditEntry(), ...capturedData }]),
      };
      mockDb.insert = mock(() => insertChain);

      const repo = new AuditRepository(mockDb, makeLogger());
      await repo.logEvent(makeRequest(), 'admin-user-99');

      expect(capturedData.createdBy).toBe('admin-user-99');
      expect(capturedData.updatedBy).toBe('admin-user-99');
    });

    test('falls back to request.user when createdBy not provided', async () => {
      let capturedData: any = null;
      const mockDb = makeMockDb();
      const insertChain = {
        values: mock(function(this: any, data: any) {
          capturedData = data;
          return this;
        }),
        returning: mock(() => [{ ...makeAuditEntry(), ...capturedData }]),
      };
      mockDb.insert = mock(() => insertChain);

      const repo = new AuditRepository(mockDb, makeLogger());
      await repo.logEvent(makeRequest({ user: 'req-user-42' }));

      expect(capturedData.createdBy).toBe('req-user-42');
    });

    test('falls back to SYSTEM_USER_ID when no createdBy or request.user', async () => {
      let capturedData: any = null;
      const mockDb = makeMockDb();
      const insertChain = {
        values: mock(function(this: any, data: any) {
          capturedData = data;
          return this;
        }),
        returning: mock(() => [{ ...makeAuditEntry(), ...capturedData }]),
      };
      mockDb.insert = mock(() => insertChain);

      const repo = new AuditRepository(mockDb, makeLogger());
      await repo.logEvent(makeRequest({ user: undefined }));

      expect(capturedData.createdBy).toBe('00000000-0000-0000-0000-000000000000');
    });

    test('spreads request fields into audit data', async () => {
      let capturedData: any = null;
      const mockDb = makeMockDb();
      const insertChain = {
        values: mock(function(this: any, data: any) {
          capturedData = data;
          return this;
        }),
        returning: mock(() => [{ ...makeAuditEntry(), ...capturedData }]),
      };
      mockDb.insert = mock(() => insertChain);

      const repo = new AuditRepository(mockDb, makeLogger());
      const request = makeRequest({
        eventType: 'data-modification',
        category: 'clinical',
        action: 'update',
        outcome: 'failure',
        ipAddress: '192.168.1.1',
        userAgent: 'TestAgent/1.0',
        details: { field: 'diagnosis', oldValue: 'A', newValue: 'B' },
      });
      await repo.logEvent(request);

      expect(capturedData.eventType).toBe('data-modification');
      expect(capturedData.category).toBe('clinical');
      expect(capturedData.action).toBe('update');
      expect(capturedData.outcome).toBe('failure');
      expect(capturedData.ipAddress).toBe('192.168.1.1');
      expect(capturedData.userAgent).toBe('TestAgent/1.0');
      expect(capturedData.details).toEqual({ field: 'diagnosis', oldValue: 'A', newValue: 'B' });
    });

    test('logs info on successful creation', async () => {
      const logger = makeLogger();
      const mockDb = makeMockDb();
      const repo = new AuditRepository(mockDb, logger);

      await repo.logEvent(makeRequest());

      expect(logger.info).toHaveBeenCalled();
    });
  });

  // ── verifyIntegrity (roundtrip with calculateIntegrityHash) ─

  describe('verifyIntegrity', () => {
    test('valid entry passes integrity check', async () => {
      const createdAt = new Date('2025-06-01T12:00:00.000Z');

      // Build the hash the same way the repo does
      const integrityData = {
        eventType: 'data-access',
        category: 'hipaa',
        action: 'read',
        outcome: 'success',
        organizationId: 'org-1',
        user: 'user-1',
        resourceType: 'patient_record',
        resource: 'record-123',
        description: 'Accessed patient record',
        timestamp: createdAt.toISOString(),
      };
      const hash = expectedHash(integrityData);

      const entry = makeAuditEntry({ createdAt, integrityHash: hash });

      const mockDb = makeMockDb();
      const repo = new AuditRepository(mockDb, makeLogger());
      const result = await repo.verifyIntegrity([entry]);

      expect(result.verifiedCount).toBe(1);
      expect(result.compromisedEntries).toEqual([]);
      expect(result.totalChecked).toBe(1);
    });

    test('tampered entry fails integrity check', async () => {
      const createdAt = new Date('2025-06-01T12:00:00.000Z');
      const entry = makeAuditEntry({
        createdAt,
        integrityHash: 'aaaa' + '0'.repeat(60), // obviously wrong hash
        description: 'Original description',
      });

      const mockDb = makeMockDb();
      const logger = makeLogger();
      const repo = new AuditRepository(mockDb, logger);
      const result = await repo.verifyIntegrity([entry]);

      expect(result.verifiedCount).toBe(0);
      expect(result.compromisedEntries).toContain('audit-1');
      expect(result.totalChecked).toBe(1);
      // Should log error for compromised entry
      expect(logger.error).toHaveBeenCalled();
    });

    test('entries without integrityHash are skipped', async () => {
      const entry = makeAuditEntry({ integrityHash: null });

      const mockDb = makeMockDb();
      const repo = new AuditRepository(mockDb, makeLogger());
      const result = await repo.verifyIntegrity([entry]);

      expect(result.verifiedCount).toBe(0);
      expect(result.compromisedEntries).toEqual([]);
      expect(result.totalChecked).toBe(1);
    });

    test('mixed entries: some valid, some tampered, some missing hash', async () => {
      const createdAt1 = new Date('2025-01-01T00:00:00.000Z');
      const createdAt2 = new Date('2025-02-01T00:00:00.000Z');

      const hash1 = expectedHash({
        eventType: 'data-access',
        category: 'hipaa',
        action: 'read',
        outcome: 'success',
        organizationId: 'org-1',
        user: 'user-1',
        resourceType: 'patient_record',
        resource: 'record-123',
        description: 'Accessed patient record',
        timestamp: createdAt1.toISOString(),
      });

      const validEntry = makeAuditEntry({ id: 'valid-1', createdAt: createdAt1, integrityHash: hash1 });
      const tamperedEntry = makeAuditEntry({ id: 'tampered-1', createdAt: createdAt2, integrityHash: 'bad-hash' });
      const noHashEntry = makeAuditEntry({ id: 'legacy-1', integrityHash: null });

      const mockDb = makeMockDb();
      const repo = new AuditRepository(mockDb, makeLogger());
      const result = await repo.verifyIntegrity([validEntry, tamperedEntry, noHashEntry]);

      expect(result.verifiedCount).toBe(1);
      expect(result.compromisedEntries).toEqual(['tampered-1']);
      expect(result.totalChecked).toBe(3);
    });

    test('fetches active entries from DB when none provided', async () => {
      // When entries not provided, repo calls this.findMany({ retentionStatus: 'active' })
      const mockDb = makeMockDb({ selectResult: [] });
      const repo = new AuditRepository(mockDb, makeLogger());
      const result = await repo.verifyIntegrity();

      expect(result.totalChecked).toBe(0);
      expect(result.verifiedCount).toBe(0);
      expect(result.compromisedEntries).toEqual([]);
    });

    test('integrity hash is deterministic for same input', async () => {
      const createdAt = new Date('2025-03-15T08:30:00.000Z');

      const integrityData = {
        eventType: 'authentication',
        category: 'security',
        action: 'login',
        outcome: 'success',
        organizationId: 'org-2',
        user: 'user-99',
        resourceType: 'session',
        resource: 'session-abc',
        description: 'User logged in',
        timestamp: createdAt.toISOString(),
      };

      const hash1 = expectedHash(integrityData);
      const hash2 = expectedHash(integrityData);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });
  });

  // ── archiveOldLogs ──────────────────────────────────────

  describe('archiveOldLogs', () => {
    test('calls db.update with archived status', async () => {
      const mockDb = makeMockDb({ updateReturning: [{ id: 'a1' }, { id: 'a2' }] });
      const repo = new AuditRepository(mockDb, makeLogger());

      const count = await repo.archiveOldLogs(365, 'admin-1');

      expect(count).toBe(2);
      expect(mockDb.update).toHaveBeenCalled();
    });

    test('returns 0 when no logs to archive', async () => {
      const mockDb = makeMockDb({ updateReturning: [] });
      const repo = new AuditRepository(mockDb, makeLogger());

      const count = await repo.archiveOldLogs(365);

      expect(count).toBe(0);
    });

    test('defaults to 365 days', async () => {
      const mockDb = makeMockDb({ updateReturning: [] });
      const repo = new AuditRepository(mockDb, makeLogger());

      await repo.archiveOldLogs();

      expect(mockDb.update).toHaveBeenCalled();
    });

    test('logs info with archival details', async () => {
      const logger = makeLogger();
      const mockDb = makeMockDb({ updateReturning: [{ id: 'a1' }] });
      const repo = new AuditRepository(mockDb, logger);

      await repo.archiveOldLogs(30, 'admin-user');

      expect(logger.info).toHaveBeenCalled();
      const infoCall = (logger.info as any).mock.calls[0][0];
      expect(infoCall.archivedCount).toBe(1);
      expect(infoCall.daysOld).toBe(30);
      expect(infoCall.archivedBy).toBe('admin-user');
    });
  });

  // ── purgeArchivedLogs ───────────────────────────────────

  describe('purgeArchivedLogs', () => {
    test('marks archived logs as pending-purge then deletes', async () => {
      const updateChain = {
        set: mock(function(this: any) { return this; }),
        where: mock(function(this: any) { return this; }),
        returning: mock(() => []),
      };

      const deleteChain = {
        where: mock(function(this: any) { return this; }),
        returning: mock(() => [{ id: 'purged-1' }, { id: 'purged-2' }, { id: 'purged-3' }]),
      };

      const mockDb = {
        update: mock(() => updateChain),
        delete: mock(() => deleteChain),
        insert: mock(() => ({})),
        select: mock(() => ({})),
      } as any;

      const repo = new AuditRepository(mockDb, makeLogger());
      const count = await repo.purgeArchivedLogs();

      expect(count).toBe(3);
      // First call: update to mark as pending-purge
      expect(mockDb.update).toHaveBeenCalled();
      // Second call: delete pending-purge entries
      expect(mockDb.delete).toHaveBeenCalled();
    });

    test('defaults to 2555 days (7 years HIPAA)', async () => {
      const logger = makeLogger();
      const updateChain = {
        set: mock(function(this: any) { return this; }),
        where: mock(function(this: any) { return this; }),
        returning: mock(() => []),
      };
      const deleteChain = {
        where: mock(function(this: any) { return this; }),
        returning: mock(() => []),
      };
      const mockDb = {
        update: mock(() => updateChain),
        delete: mock(() => deleteChain),
        insert: mock(() => ({})),
        select: mock(() => ({})),
      } as any;

      const repo = new AuditRepository(mockDb, logger);
      await repo.purgeArchivedLogs();

      expect(logger.debug).toHaveBeenCalled();
      const debugCall = (logger.debug as any).mock.calls[0][0];
      expect(debugCall.daysOld).toBe(2555);
    });

    test('returns 0 when nothing to purge', async () => {
      const updateChain = {
        set: mock(function(this: any) { return this; }),
        where: mock(function(this: any) { return this; }),
        returning: mock(() => []),
      };
      const deleteChain = {
        where: mock(function(this: any) { return this; }),
        returning: mock(() => []),
      };
      const mockDb = {
        update: mock(() => updateChain),
        delete: mock(() => deleteChain),
        insert: mock(() => ({})),
        select: mock(() => ({})),
      } as any;

      const repo = new AuditRepository(mockDb, makeLogger());
      const count = await repo.purgeArchivedLogs(2555);

      expect(count).toBe(0);
    });
  });

  // ── getAuditStatistics ──────────────────────────────────

  describe('getAuditStatistics', () => {
    test('returns correct shape with all status counts', async () => {
      // getAuditStatistics calls this.count() 4 times
      // We stub count on the prototype for this test
      const mockDb = makeMockDb();
      const repo = new AuditRepository(mockDb, makeLogger());

      let callIndex = 0;
      const countResults = [100, 80, 15, 5]; // total, active, archived, pending-purge
      repo.count = mock(async () => countResults[callIndex++]);

      const stats = await repo.getAuditStatistics();

      expect(stats.totalEntries).toBe(100);
      expect(stats.activeEntries).toBe(80);
      expect(stats.archivedEntries).toBe(15);
      expect(stats.pendingPurge).toBe(5);
      expect(stats.integrityStatus).toBe('healthy');
    });

    test('handles zero counts', async () => {
      const mockDb = makeMockDb();
      const repo = new AuditRepository(mockDb, makeLogger());

      repo.count = mock(async () => 0);

      const stats = await repo.getAuditStatistics();

      expect(stats.totalEntries).toBe(0);
      expect(stats.activeEntries).toBe(0);
      expect(stats.archivedEntries).toBe(0);
      expect(stats.pendingPurge).toBe(0);
    });
  });

  // ── constructor ─────────────────────────────────────────

  describe('constructor', () => {
    test('accepts db and logger', () => {
      const mockDb = makeMockDb();
      const logger = makeLogger();
      const repo = new AuditRepository(mockDb, logger);

      expect(repo).toBeInstanceOf(AuditRepository);
    });

    test('works without logger', () => {
      const mockDb = makeMockDb();
      const repo = new AuditRepository(mockDb);

      expect(repo).toBeInstanceOf(AuditRepository);
    });
  });
});
