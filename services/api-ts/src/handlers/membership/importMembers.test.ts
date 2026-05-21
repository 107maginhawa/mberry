import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { importMembers, normalizeLicense, importMembersSchema } from './importMembers';
import { MembershipRepository } from './repos/membership.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { DuesConfigRepository } from '../association:member/repos/dues.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeMember = {
  id: 'mem-1',
  organizationId: 'org-1',
  personId: 'person-1',
  tierId: 'tier-1',
  status: 'active',
};

// ─── Tests: Existing Import Behavior ────────────────────

describe('[BR-22] importMembers', () => {
  let mocks: ReturnType<typeof stubRepo>;
  let officerMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    // Stub officer check to allow PRESIDENT through by default
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
    restoreRepo(DuesConfigRepository);
    stubRepo(DuesConfigRepository, {
      findAll: async () => [{ id: 'dc-1', gracePeriodDays: 30 }],
    });
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    if (officerMocks) Object.values(officerMocks).forEach((m) => m.mockRestore());
    restoreRepo(DuesConfigRepository);
  });

  test('imports members with personId and returns 201 with count', async () => {
    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async (members: any[]) => members.map((m: any, i: number) => ({ ...fakeMember, id: `mem-${i}`, ...m })),
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: {
        members: [
          { personId: 'p-1', tierId: 'tier-1' },
          { personId: 'p-2', tierId: 'tier-1' },
        ],
      },
    });

    const response = await importMembers(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.imported).toBe(2);
  });

  test('handles empty members array', async () => {
    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async () => [],
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { members: [] },
    });

    const response = await importMembers(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.imported).toBe(0);
  });

  test('returns 401 without session (no auth)', async () => {
    // requirePosition short-circuits with 401 when no user on context
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1' },
      _body: { members: [{ personId: 'p-1', tierId: 'tier-1' }] },
    });

    const response = await importMembers(ctx);
    expect(response.status).toBe(401);
  });

  test('scopes all members to orgId from route param', async () => {
    let captured: any[] = [];
    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async (members: any[]) => { captured = members; return members; },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-77' },
      _body: {
        members: [
          { personId: 'p-1', tierId: 'tier-1' },
          { personId: 'p-2', tierId: 'tier-2' },
        ],
      },
    });

    await importMembers(ctx);
    expect(captured.length).toBe(2);
    expect(captured[0].organizationId).toBe('org-77');
    expect(captured[1].organizationId).toBe('org-77');
  });

  test('uses licenseNumber as memberNumber fallback', async () => {
    let captured: any[] = [];
    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async (members: any[]) => { captured = members; return members; },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: {
        members: [
          { personId: 'p-1', tierId: 'tier-1', licenseNumber: 'LIC-100' },
        ],
      },
    });

    await importMembers(ctx);
    expect(captured[0].memberNumber).toBe('LIC-100');
  });

  test('sets createdBy and updatedBy for all members', async () => {
    let captured: any[] = [];
    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async (members: any[]) => { captured = members; return members; },
    });

    const ctx = makeCtx({
      user: { id: 'importer-1', role: 'admin' },
      _params: { organizationId: 'org-1' },
      _body: {
        members: [
          { personId: 'p-1', tierId: 'tier-1' },
          { personId: 'p-2', tierId: 'tier-2' },
        ],
      },
    });

    await importMembers(ctx);
    expect(captured[0].createdBy).toBe('importer-1');
    expect(captured[0].updatedBy).toBe('importer-1');
    expect(captured[1].createdBy).toBe('importer-1');
    expect(captured[1].updatedBy).toBe('importer-1');
  });

  test('defaults status to active for all imported members', async () => {
    let captured: any[] = [];
    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async (members: any[]) => { captured = members; return members; },
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: {
        members: [{ personId: 'p-1', tierId: 'tier-1' }],
      },
    });

    await importMembers(ctx);
    expect(captured[0].status).toBe('active');
  });

  test('returns 403 when caller lacks officer position', async () => {
    // Override: non-officer (empty terms) should be denied
    Object.values(officerMocks).forEach((m) => m.mockRestore());
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { members: [{ personId: 'p-1', tierId: 'tier-1' }] },
    });

    const response = await importMembers(ctx);
    expect(response.status).toBe(403);
  });

  test('returns 400 on invalid payload', async () => {
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: { members: [{ email: 'bad-email' }] },
    });

    const response = await importMembers(ctx);
    expect(response.status).toBe(400);
  });

  test('returns structured response with matched/created/flagged arrays', async () => {
    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async (members: any[]) => members.map((m: any, i: number) => ({ ...fakeMember, id: `mem-${i}`, ...m })),
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _body: {
        members: [{ personId: 'p-1', tierId: 'tier-1' }],
      },
    });

    const response = await importMembers(ctx);
    expect(response.body.data).toHaveProperty('matched');
    expect(response.body.data).toHaveProperty('created');
    expect(response.body.data).toHaveProperty('flagged');
    expect(response.body.data).toHaveProperty('imported');
  });
});

// ─── Tests: Zod Validation (V-08) ──────────────────────

describe('[V-08] Import Validation Schema', () => {
  test('accepts valid payload with personId', () => {
    const result = importMembersSchema.safeParse({
      members: [{ personId: 'p-1', tierId: 'tier-1' }],
    });
    expect(result.success).toBe(true);
  });

  test('accepts valid payload with email + license', () => {
    const result = importMembersSchema.safeParse({
      members: [{
        email: 'jane@example.com',
        licenseNumber: 'PRC-12345',
        firstName: 'Jane',
        lastName: 'Doe',
        tierId: 'tier-1',
      }],
    });
    expect(result.success).toBe(true);
  });

  test('rejects invalid email format', () => {
    const result = importMembersSchema.safeParse({
      members: [{ email: 'not-an-email', tierId: 'tier-1' }],
    });
    expect(result.success).toBe(false);
  });

  test('rejects missing tierId', () => {
    const result = importMembersSchema.safeParse({
      members: [{ personId: 'p-1' }],
    });
    expect(result.success).toBe(false);
  });

  test('accepts empty members array', () => {
    const result = importMembersSchema.safeParse({ members: [] });
    expect(result.success).toBe(true);
  });
});

// ─── Tests: License Normalization (BR-23) ───────────────

describe('[BR-23] normalizeLicense', () => {
  test('strips dashes and spaces, lowercases', () => {
    expect(normalizeLicense('PRC-12345')).toBe('prc12345');
    expect(normalizeLicense('PRC 12345')).toBe('prc12345');
    expect(normalizeLicense('prc12345')).toBe('prc12345');
  });

  test('strips leading zeros', () => {
    expect(normalizeLicense('0012345')).toBe('12345');
  });

  test('handles combined transformations', () => {
    expect(normalizeLicense('00-PRC 123')).toBe('prc123');
  });
});

// ─── Tests: Matching Logic (BR-22) ─────────────────────

describe('[BR-22] Member Matching on Import', () => {
  let mocks: ReturnType<typeof stubRepo>;
  let officerMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    officerMocks = stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
    restoreRepo(DuesConfigRepository);
    stubRepo(DuesConfigRepository, {
      findAll: async () => [{ id: 'dc-1', gracePeriodDays: 30 }],
    });
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    if (officerMocks) Object.values(officerMocks).forEach((m) => m.mockRestore());
    restoreRepo(DuesConfigRepository);
  });

  // These tests exercise matching through the handler by providing a mock database
  // that responds to the person lookup queries.

  test('email match links to existing person (case-insensitive)', async () => {
    // Simulate DB: person exists with email
    const mockDb = createMockDb({
      personByEmail: { id: 'person-a', firstName: 'Jane', lastName: 'Doe' },
    });

    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async (members: any[]) => members,
    });

    const ctx = makeCtx({
      database: mockDb,
      _params: { organizationId: 'org-1' },
      _body: {
        members: [{
          email: 'Jane.Doe@Example.COM',
          firstName: 'Jane',
          lastName: 'Doe',
          tierId: 'tier-1',
        }],
      },
    });

    const response = await importMembers(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.matched.length).toBe(1);
    expect(response.body.data.matched[0].personId).toBe('person-a');
  });

  test('email matches A, license matches B → conflict flagged', async () => {
    const mockDb = createMockDb({
      personByEmail: { id: 'person-a', firstName: 'Jane', lastName: 'Cruz' },
      personByLicense: { id: 'person-b', firstName: 'John', lastName: 'Santos' },
    });

    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async () => [],
    });

    const ctx = makeCtx({
      database: mockDb,
      _params: { organizationId: 'org-1' },
      _body: {
        members: [{
          email: 'jane@example.com',
          licenseNumber: 'PRC-22222',
          tierId: 'tier-1',
        }],
      },
    });

    const response = await importMembers(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.flagged.length).toBe(1);
    expect(response.body.data.flagged[0].reason).toBe('conflict');
    expect(response.body.data.imported).toBe(0);
  });

  test('no match creates new account', async () => {
    let insertedPerson: any = null;
    const mockDb = createMockDb({
      personByEmail: null,
      personByLicense: null,
      onInsertPerson: (values: any) => {
        insertedPerson = values;
        return { id: 'new-person-1', ...values };
      },
    });

    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async (members: any[]) => members,
    });

    const ctx = makeCtx({
      database: mockDb,
      _params: { organizationId: 'org-1' },
      _body: {
        members: [{
          email: 'unknown@example.com',
          licenseNumber: 'PRC-99999',
          firstName: 'New',
          lastName: 'Person',
          tierId: 'tier-1',
        }],
      },
    });

    const response = await importMembers(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.created.length).toBe(1);
    expect(response.body.data.created[0].personId).toBe('new-person-1');
    expect(insertedPerson).toBeTruthy();
  });

  test('name mismatch with email match flagged for manual review', async () => {
    const mockDb = createMockDb({
      personByEmail: { id: 'person-a', firstName: 'Maria', lastName: 'Cruz' },
    });

    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async () => [],
    });

    const ctx = makeCtx({
      database: mockDb,
      _params: { organizationId: 'org-1' },
      _body: {
        members: [{
          email: 'jane@example.com',
          firstName: 'Jose',
          lastName: 'Santos',
          tierId: 'tier-1',
        }],
      },
    });

    const response = await importMembers(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.flagged.length).toBe(1);
    expect(response.body.data.flagged[0].reason).toBe('name-mismatch');
  });

  test('single field match (email) with matching name auto-links', async () => {
    const mockDb = createMockDb({
      personByEmail: { id: 'person-a', firstName: 'Jane', lastName: 'Doe' },
    });

    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async (members: any[]) => members,
    });

    const ctx = makeCtx({
      database: mockDb,
      _params: { organizationId: 'org-1' },
      _body: {
        members: [{
          email: 'jane@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          tierId: 'tier-1',
        }],
      },
    });

    const response = await importMembers(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.matched.length).toBe(1);
    expect(response.body.data.matched[0].personId).toBe('person-a');
  });

  test('license match with normalized comparison links person', async () => {
    const mockDb = createMockDb({
      personByLicense: { id: 'person-b', firstName: 'John', lastName: 'Smith' },
    });

    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async (members: any[]) => members,
    });

    const ctx = makeCtx({
      database: mockDb,
      _params: { organizationId: 'org-1' },
      _body: {
        members: [{
          licenseNumber: 'PRC-12345',
          firstName: 'John',
          lastName: 'Smith',
          tierId: 'tier-1',
        }],
      },
    });

    const response = await importMembers(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.matched.length).toBe(1);
    expect(response.body.data.matched[0].personId).toBe('person-b');
  });
});

// ─── Mock DB Helper ────────────────────────────────────

function createMockDb(opts: {
  personByEmail?: { id: string; firstName: string; lastName: string } | null;
  personByLicense?: { id: string; firstName: string; lastName: string } | null;
  onInsertPerson?: (values: any) => any;
} = {}) {
  let selectCallCount = 0;

  const chainable = (result: any[]) => {
    const chain: any = {
      select: () => chain,
      from: () => chain,
      where: (condition: any) => {
        // Determine if this is an email or license query based on call order
        // Email query fires first, license second (per handler implementation)
        selectCallCount++;
        const condStr = String(condition);

        // Return email match for email queries, license match for license queries
        if (condStr.includes('email') || selectCallCount % 2 === 1) {
          return { limit: () => opts.personByEmail ? [opts.personByEmail] : [] };
        }
        return { limit: () => opts.personByLicense ? [opts.personByLicense] : [] };
      },
      limit: () => result,
      returning: () => result,
    };
    return chain;
  };

  return {
    select: (fields: any) => ({
      from: (table: any) => ({
        where: (condition: any) => {
          selectCallCount++;
          // Heuristic: first select per row = email, second = license
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
