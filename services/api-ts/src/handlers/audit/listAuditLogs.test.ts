/**
 * Unit tests for listAuditLogs handler
 *
 * Tests:
 * - Paginated response structure
 * - Org-scoping enforcement via orgId
 * - Date range validation (startDate > endDate = error)
 * - Audit trail entry logged for the query itself
 */

import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { listAuditLogs } from './listAuditLogs';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { AuditRepository } from './repos/audit.repo';
import type { AuditLogEntry } from './repos/audit.schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    integrityHash: 'abc123',
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('listAuditLogs', () => {
  beforeEach(() => {
    restoreRepo(AuditRepository);
  });

  afterEach(() => {
    restoreRepo(AuditRepository);
  });

  test('returns paginated response with data and pagination meta', async () => {
    const entries = [makeAuditEntry({ id: 'a1' }), makeAuditEntry({ id: 'a2' })];

    stubRepo(AuditRepository, {
      findMany: async () => entries,
      count: async () => 2,
      logEvent: async () => makeAuditEntry(),
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      organizationId: 'org-1',
      _query: {},
    });

    const response = await listAuditLogs(ctx as any);

    expect(response.status).toBe(200);
    const body = (response as any).body;
    expect(body.data).toHaveLength(2);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.totalCount).toBe(2);
  });

  test('enforces org scoping via orgId from context', async () => {
    let capturedFilters: any = null;

    stubRepo(AuditRepository, {
      findMany: async (filters: any) => {
        capturedFilters = filters;
        return [];
      },
      count: async () => 0,
      logEvent: async () => makeAuditEntry(),
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      organizationId: 'tenant-42',
      _query: {},
    });

    await listAuditLogs(ctx as any);

    expect(capturedFilters).toBeDefined();
    expect(capturedFilters.organizationId).toBe('tenant-42');
  });

  test('throws ValidationError when startDate > endDate', async () => {
    stubRepo(AuditRepository, {
      findMany: async () => [],
      count: async () => 0,
      logEvent: async () => makeAuditEntry(),
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      organizationId: 'org-1',
      _query: {
        startDate: '2025-12-01T00:00:00.000Z',
        endDate: '2025-01-01T00:00:00.000Z',
      },
    });

    await expect(listAuditLogs(ctx as any)).rejects.toThrow('startDate cannot be after endDate');
  });

  test('logs audit trail entry for the query itself', async () => {
    let logEventCalled = false;
    let logEventRequest: any = null;

    stubRepo(AuditRepository, {
      findMany: async () => [],
      count: async () => 0,
      logEvent: async (request: any) => {
        logEventCalled = true;
        logEventRequest = request;
        return makeAuditEntry();
      },
    });

    const ctx = makeCtx({
      user: { id: 'admin-user', role: 'admin' },
      organizationId: 'org-1',
      _query: {},
    });

    await listAuditLogs(ctx as any);

    expect(logEventCalled).toBe(true);
    expect(logEventRequest.eventType).toBe('data-access');
    expect(logEventRequest.category).toBe('administrative');
    expect(logEventRequest.action).toBe('read');
    expect(logEventRequest.outcome).toBe('success');
    expect(logEventRequest.resourceType).toBe('audit_log');
    expect(logEventRequest.user).toBe('admin-user');
  });

  test('accepts valid date range without error', async () => {
    stubRepo(AuditRepository, {
      findMany: async () => [],
      count: async () => 0,
      logEvent: async () => makeAuditEntry(),
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      organizationId: 'org-1',
      _query: {
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2025-12-31T23:59:59.000Z',
      },
    });

    const response = await listAuditLogs(ctx as any);
    expect(response.status).toBe(200);
  });

  test('serializes dates as ISO strings in response', async () => {
    const createdAt = new Date('2025-03-15T10:30:00.000Z');
    const updatedAt = new Date('2025-03-15T10:31:00.000Z');
    const archivedAt = new Date('2025-06-01T00:00:00.000Z');
    const purgeAfter = new Date('2032-03-15T10:30:00.000Z');

    const entry = makeAuditEntry({
      createdAt,
      updatedAt,
      archivedAt,
      purgeAfter,
    });

    stubRepo(AuditRepository, {
      findMany: async () => [entry],
      count: async () => 1,
      logEvent: async () => makeAuditEntry(),
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      organizationId: 'org-1',
      _query: {},
    });

    const response = await listAuditLogs(ctx as any);
    const body = (response as any).body;
    const item = body.data[0];

    expect(item.createdAt).toBe('2025-03-15T10:30:00.000Z');
    expect(item.updatedAt).toBe('2025-03-15T10:31:00.000Z');
    expect(item.archivedAt).toBe('2025-06-01T00:00:00.000Z');
    expect(item.purgeAfter).toBe('2032-03-15T10:30:00.000Z');
  });

  test('null archivedAt and purgeAfter serialize as null', async () => {
    const entry = makeAuditEntry({ archivedAt: null, purgeAfter: null });

    stubRepo(AuditRepository, {
      findMany: async () => [entry],
      count: async () => 1,
      logEvent: async () => makeAuditEntry(),
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      organizationId: 'org-1',
      _query: {},
    });

    const response = await listAuditLogs(ctx as any);
    const body = (response as any).body;
    const item = body.data[0];

    expect(item.archivedAt).toBeNull();
    expect(item.purgeAfter).toBeNull();
  });

  test('forwards eventType filter to repository', async () => {
    let capturedFilters: any = null;

    stubRepo(AuditRepository, {
      findMany: async (filters: any) => {
        capturedFilters = filters;
        return [];
      },
      count: async () => 0,
      logEvent: async () => makeAuditEntry(),
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      organizationId: 'org-1',
      _query: { eventType: 'data-access' },
    });

    await listAuditLogs(ctx as any);

    expect(capturedFilters).toBeDefined();
    expect(capturedFilters.eventType).toBe('data-access');
  });

  test('forwards category filter to repository', async () => {
    let capturedFilters: any = null;

    stubRepo(AuditRepository, {
      findMany: async (filters: any) => {
        capturedFilters = filters;
        return [];
      },
      count: async () => 0,
      logEvent: async () => makeAuditEntry(),
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      organizationId: 'org-1',
      _query: { category: 'hipaa' },
    });

    await listAuditLogs(ctx as any);

    expect(capturedFilters).toBeDefined();
    expect(capturedFilters.category).toBe('hipaa');
  });

  test('forwards combined eventType + category filters to repository', async () => {
    let capturedFilters: any = null;

    stubRepo(AuditRepository, {
      findMany: async (filters: any) => {
        capturedFilters = filters;
        return [];
      },
      count: async () => 0,
      logEvent: async () => makeAuditEntry(),
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      organizationId: 'org-1',
      _query: { eventType: 'data-modification', category: 'privacy' },
    });

    await listAuditLogs(ctx as any);

    expect(capturedFilters).toBeDefined();
    expect(capturedFilters.eventType).toBe('data-modification');
    expect(capturedFilters.category).toBe('privacy');
  });

  test('respects pagination query params', async () => {
    let capturedOptions: any = null;

    stubRepo(AuditRepository, {
      findMany: async (_filters: any, options: any) => {
        capturedOptions = options;
        return [];
      },
      count: async () => 0,
      logEvent: async () => makeAuditEntry(),
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      organizationId: 'org-1',
      _query: { limit: '10', offset: '20' },
    });

    await listAuditLogs(ctx as any);

    expect(capturedOptions).toBeDefined();
    expect(capturedOptions.pagination.limit).toBe(10);
    expect(capturedOptions.pagination.offset).toBe(20);
  });
});
