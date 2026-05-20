import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { MembershipRepository } from './repos/membership.repo';
import {
  parseCSV,
  validateImportRows,
  previewCSVImport,
  bulkCSVImport,
  IMPORT_BATCH_SIZE,
} from './csvImport';

// ─── Fixtures ───────────────────────────────────────────

const VALID_CSV = `email,firstName,lastName,licenseNumber,tierId
jane@example.com,Jane,Doe,PRC-12345,tier-1
john@example.com,John,Smith,PRC-67890,tier-1`;

const CSV_WITH_ERRORS = `email,firstName,lastName,licenseNumber,tierId
bad-email,Jane,Doe,PRC-12345,tier-1
jane@example.com,,,PRC-22222,
john@example.com,John,Smith,PRC-67890,tier-1`;

const CSV_WITH_BOM = `\uFEFFemail,firstName,lastName,licenseNumber,tierId
jane@example.com,Jane,Doe,PRC-12345,tier-1`;

const CSV_EMPTY = `email,firstName,lastName,licenseNumber,tierId`;

// ─── Tests: CSV Parsing ─────────────────────────────────

describe('[AC-M01-002] CSV Parsing', () => {
  test('parses valid CSV into row objects', () => {
    const rows = parseCSV(VALID_CSV);
    expect(rows.length).toBe(2);
    expect(rows[0].email).toBe('jane@example.com');
    expect(rows[0].firstName).toBe('Jane');
    expect(rows[0].lastName).toBe('Doe');
    expect(rows[0].licenseNumber).toBe('PRC-12345');
    expect(rows[0].tierId).toBe('tier-1');
  });

  test('strips BOM from CSV header', () => {
    const rows = parseCSV(CSV_WITH_BOM);
    expect(rows.length).toBe(1);
    expect(rows[0].email).toBe('jane@example.com');
  });

  test('handles empty CSV (header only)', () => {
    const rows = parseCSV(CSV_EMPTY);
    expect(rows.length).toBe(0);
  });

  test('trims whitespace from values', () => {
    const csv = `email,firstName,tierId
  jane@example.com , Jane , tier-1 `;
    const rows = parseCSV(csv);
    expect(rows[0].email).toBe('jane@example.com');
    expect(rows[0].firstName).toBe('Jane');
    expect(rows[0].tierId).toBe('tier-1');
  });

  test('handles CRLF line endings', () => {
    const csv = 'email,tierId\r\njane@example.com,tier-1\r\njohn@example.com,tier-2';
    const rows = parseCSV(csv);
    expect(rows.length).toBe(2);
  });

  test('skips blank lines', () => {
    const csv = `email,tierId
jane@example.com,tier-1

john@example.com,tier-2
`;
    const rows = parseCSV(csv);
    expect(rows.length).toBe(2);
  });
});

// ─── Tests: Per-Row Independent Validation (M5-R3/M5-R8) ──

describe('[M5-R3] Per-Row Independent Validation', () => {
  test('valid rows pass validation', () => {
    const rows = parseCSV(VALID_CSV);
    const result = validateImportRows(rows);
    expect(result.valid.length).toBe(2);
    expect(result.errors.length).toBe(0);
  });

  test('invalid rows do not block valid rows (M5-R8)', () => {
    const rows = parseCSV(CSV_WITH_ERRORS);
    const result = validateImportRows(rows);
    // Row 3 (john@example.com) is valid
    expect(result.valid.length).toBe(1);
    expect(result.valid[0].email).toBe('john@example.com');
    // Row 1 (bad email) and Row 2 (missing tierId) are invalid
    expect(result.errors.length).toBe(2);
  });

  test('each error includes row number and field-level detail', () => {
    const rows = parseCSV(CSV_WITH_ERRORS);
    const result = validateImportRows(rows);
    // bad-email row
    const emailError = result.errors.find(e => e.rowNumber === 1);
    expect(emailError).toBeTruthy();
    expect(emailError!.issues.length).toBeGreaterThan(0);
    expect(emailError!.issues.some(i => i.field === 'email')).toBe(true);
  });

  test('missing tierId flagged per-row', () => {
    const rows = parseCSV(CSV_WITH_ERRORS);
    const result = validateImportRows(rows);
    const tierError = result.errors.find(e => e.rowNumber === 2);
    expect(tierError).toBeTruthy();
    expect(tierError!.issues.some(i => i.field === 'tierId')).toBe(true);
  });

  test('row must have personId or email or licenseNumber', () => {
    const rows = [{ tierId: 'tier-1', firstName: 'Only', lastName: 'Name' }];
    const result = validateImportRows(rows as any);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].issues.some(i => i.message.includes('identifier'))).toBe(true);
  });
});

// ─── Tests: License Normalization on CSV Import (AC-M05-004) ──

describe('[AC-M05-004] License Normalization in CSV', () => {
  test('license numbers are normalized during validation', () => {
    const rows = [
      { email: 'a@b.com', licenseNumber: '  PRC-00123 ', tierId: 'tier-1', firstName: 'A', lastName: 'B' },
    ];
    const result = validateImportRows(rows as any);
    expect(result.valid.length).toBe(1);
    // The normalized license is stored
    expect(result.valid[0].licenseNumber).toBe('PRC-00123');
    expect(result.valid[0]._normalizedLicense).toBe('prc00123');
  });
});

// ─── Tests: CSV Preview (AC-M01-002) ────────────────────

describe('[AC-M01-002] CSV Preview', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => restoreRepo(MembershipRepository));
  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
  });

  test('returns preview with valid/error counts without importing', async () => {
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { csvData: VALID_CSV },
      user: { id: 'officer-1', role: 'secretary' },
    });

    const response = await previewCSVImport(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.totalRows).toBe(2);
    expect(response.body.data.validRows).toBe(2);
    expect(response.body.data.errorRows).toBe(0);
    expect(response.body.data.preview).toHaveLength(2);
    // Preview does NOT import
    expect(response.body.data.imported).toBeUndefined();
  });

  test('preview shows errors per row', async () => {
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { csvData: CSV_WITH_ERRORS },
      user: { id: 'officer-1', role: 'secretary' },
    });

    const response = await previewCSVImport(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.errorRows).toBe(2);
    expect(response.body.data.errors.length).toBe(2);
  });

  test('returns 400 for empty CSV', async () => {
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { csvData: '' },
      user: { id: 'officer-1', role: 'secretary' },
    });

    const response = await previewCSVImport(ctx);
    expect(response.status).toBe(400);
  });
});

// ─── Tests: Bulk CSV Import (BR-22, M5-R3) ──────────────

describe('[BR-22] Bulk CSV Import', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => restoreRepo(MembershipRepository));
  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
  });

  test('imports valid rows from CSV, returns results', async () => {
    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async (members: any[]) =>
        members.map((m: any, i: number) => ({ id: `mem-${i}`, ...m })),
    });

    const ctx = makeCtx({
      database: createMockDb({ personByEmail: null, personByLicense: null }),
      _params: { organizationId: 'org-1' },
      _body: { csvData: VALID_CSV },
      user: { id: 'officer-1', role: 'secretary' },
    });

    const response = await bulkCSVImport(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.imported).toBeGreaterThan(0);
    expect(response.body.data.errors).toBeDefined();
  });

  test('skips invalid rows but imports valid ones (M5-R8)', async () => {
    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async (members: any[]) =>
        members.map((m: any, i: number) => ({ id: `mem-${i}`, ...m })),
    });

    const ctx = makeCtx({
      database: createMockDb({ personByEmail: null, personByLicense: null }),
      _params: { organizationId: 'org-1' },
      _body: { csvData: CSV_WITH_ERRORS },
      user: { id: 'officer-1', role: 'secretary' },
    });

    const response = await bulkCSVImport(ctx);
    expect(response.status).toBe(201);
    // Only john@example.com is valid
    expect(response.body.data.imported).toBe(1);
    expect(response.body.data.errors.length).toBe(2);
  });

  test('returns 400 for empty CSV body', async () => {
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { csvData: '' },
      user: { id: 'officer-1', role: 'secretary' },
    });

    const response = await bulkCSVImport(ctx);
    expect(response.status).toBe(400);
  });

  test('logs import event with row counts', async () => {
    let loggedEvent: any = null;
    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async (members: any[]) =>
        members.map((m: any, i: number) => ({ id: `mem-${i}`, ...m })),
    });

    const ctx = makeCtx({
      database: createMockDb({ personByEmail: null, personByLicense: null }),
      _params: { organizationId: 'org-1' },
      _body: { csvData: VALID_CSV },
      user: { id: 'officer-1', role: 'secretary' },
      audit: {
        log: (event: any) => { loggedEvent = event; },
      },
    });

    await bulkCSVImport(ctx);
    expect(loggedEvent).toBeTruthy();
    expect(loggedEvent.action).toBe('bulk_csv_import');
    expect(loggedEvent.totalRows).toBe(2);
  });
});

// ─── Tests: Bulk Import Performance (AC-M05-003) ────────

describe('[AC-M05-003] Bulk Import Batching', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => restoreRepo(MembershipRepository));
  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
  });

  test('IMPORT_BATCH_SIZE is defined and reasonable', () => {
    expect(IMPORT_BATCH_SIZE).toBeGreaterThanOrEqual(50);
    expect(IMPORT_BATCH_SIZE).toBeLessThanOrEqual(500);
  });

  test('large import is chunked into batches', async () => {
    let batchCount = 0;
    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async (members: any[]) => {
        batchCount++;
        return members.map((m: any, i: number) => ({ id: `mem-${batchCount}-${i}`, ...m }));
      },
    });

    // Generate CSV with IMPORT_BATCH_SIZE + 10 rows
    const headerLine = 'personId,tierId';
    const dataLines = Array.from({ length: IMPORT_BATCH_SIZE + 10 }, (_, i) =>
      `person-${i},tier-1`
    );
    const largeCsv = [headerLine, ...dataLines].join('\n');

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { csvData: largeCsv },
      user: { id: 'officer-1', role: 'secretary' },
    });

    const response = await bulkCSVImport(ctx);
    expect(response.status).toBe(201);
    expect(batchCount).toBe(2); // Split into 2 batches
    expect(response.body.data.imported).toBe(IMPORT_BATCH_SIZE + 10);
  });
});

// ─── Tests: GAP-002 Conflict Resolution ─────────────────

describe('[GAP-002] Conflict Flagging in CSV Import', () => {
  let mocks: ReturnType<typeof stubRepo>;

  beforeEach(() => restoreRepo(MembershipRepository));
  afterEach(() => {
    if (mocks) Object.values(mocks).forEach(m => m.mockRestore());
  });

  test('email→A + license→B conflict flagged with both person IDs', async () => {
    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async () => [],
    });

    const csv = `email,licenseNumber,firstName,lastName,tierId
jane@example.com,PRC-99999,Jane,Doe,tier-1`;

    const ctx = makeCtx({
      database: createMockDb({
        personByEmail: { id: 'person-a', firstName: 'Jane', lastName: 'Doe' },
        personByLicense: { id: 'person-b', firstName: 'John', lastName: 'Santos' },
      }),
      _params: { organizationId: 'org-1' },
      _body: { csvData: csv },
      user: { id: 'officer-1', role: 'secretary' },
    });

    const response = await bulkCSVImport(ctx);
    expect(response.body.data.flagged.length).toBe(1);
    expect(response.body.data.flagged[0].reason).toBe('conflict');
    expect(response.body.data.flagged[0].emailMatchPersonId).toBe('person-a');
    expect(response.body.data.flagged[0].licenseMatchPersonId).toBe('person-b');
  });

  test('name mismatch flagged with reason', async () => {
    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async () => [],
    });

    const csv = `email,firstName,lastName,tierId
maria@example.com,Jose,Santos,tier-1`;

    const ctx = makeCtx({
      database: createMockDb({
        personByEmail: { id: 'person-a', firstName: 'Maria', lastName: 'Cruz' },
      }),
      _params: { organizationId: 'org-1' },
      _body: { csvData: csv },
      user: { id: 'officer-1', role: 'secretary' },
    });

    const response = await bulkCSVImport(ctx);
    expect(response.body.data.flagged.length).toBe(1);
    expect(response.body.data.flagged[0].reason).toBe('name-mismatch');
  });
});

// ─── Mock DB Helper ────────────────────────────────────

function createMockDb(opts: {
  personByEmail?: { id: string; firstName: string; lastName: string } | null;
  personByLicense?: { id: string; firstName: string; lastName: string } | null;
  onInsertPerson?: (values: any) => any;
} = {}) {
  let selectCallCount = 0;

  return {
    select: (fields: any) => ({
      from: (table: any) => ({
        where: (condition: any) => {
          selectCallCount++;
          if (selectCallCount % 2 === 1 && opts.personByEmail !== undefined) {
            return { limit: () => opts.personByEmail ? [opts.personByEmail] : [] };
          }
          if (opts.personByLicense !== undefined) {
            return { limit: () => opts.personByLicense ? [opts.personByLicense] : [] };
          }
          return { limit: () => [] };
        },
      }),
    }),
    insert: (table: any) => ({
      values: (data: any) => ({
        returning: () => {
          if (opts.onInsertPerson) {
            return [opts.onInsertPerson(data)];
          }
          return [{ id: 'new-person-1', ...data }];
        },
      }),
    }),
    transaction: async (fn: any) => fn({}),
  };
}
