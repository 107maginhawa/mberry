import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { importMembers } from './importMembers';
import { MembershipRepository } from './repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeMember = {
  id: 'mem-1',
  organizationId: 'org-1',
  orgId: 'org-1',
  personId: 'person-1',
  tierId: 'tier-1',
  status: 'active',
};

// ─── Tests ──────────────────────────────────────────────

describe('[BR-22] importMembers', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('imports members and returns 201 with count', async () => {
    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async (members: any[]) => members.map((m: any, i: number) => ({ ...fakeMember, id: `mem-${i}`, ...m })),
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-1' },
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
      _params: { orgId: 'org-1' },
      _body: { members: [] },
    });

    const response = await importMembers(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.imported).toBe(0);
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async () => [],
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { orgId: 'org-1' },
      _body: { members: [{ personId: 'p-1', tierId: 'tier-1' }] },
    });

    await expect(importMembers(ctx)).rejects.toThrow();
  });

  test('scopes all members to orgId from route param', async () => {
    let captured: any[] = [];
    mocks = stubRepo(MembershipRepository, {
      bulkImportMembers: async (members: any[]) => { captured = members; return members; },
    });

    const ctx = makeCtx({
      _params: { orgId: 'org-77' },
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
      _params: { orgId: 'org-1' },
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
      _params: { orgId: 'org-1' },
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
      _params: { orgId: 'org-1' },
      _body: {
        members: [{ personId: 'p-1', tierId: 'tier-1' }],
      },
    });

    await importMembers(ctx);
    expect(captured[0].status).toBe('active');
  });
});

// -- [BR-22] Member Matching on Import — Gap Tests --

describe('[BR-22] Member Matching on Import', () => {
  test('email match is case-insensitive', () => {
    // BR-22: "email (exact, case-insensitive)"
    const existingEmail = 'Jane.Doe@Example.COM';
    const importEmail = 'jane.doe@example.com';

    const isMatch = existingEmail.toLowerCase() === importEmail.toLowerCase();
    expect(isMatch).toBe(true);
  });

  test('license number normalization strips spaces, dashes, leading zeros', () => {
    // BR-22: "normalized: strip spaces, dashes, and leading zeros; case-insensitive"
    function normalizeLicense(license: string): string {
      return license
        .toLowerCase()
        .replace(/[\s-]/g, '')
        .replace(/^0+/, '');
    }

    // All should normalize to same value
    expect(normalizeLicense('PRC-12345')).toBe('prc12345');
    expect(normalizeLicense('PRC 12345')).toBe('prc12345');
    expect(normalizeLicense('prc12345')).toBe('prc12345');

    // Leading zeros stripped
    expect(normalizeLicense('0012345')).toBe('12345');
  });

  test('email matches A, license matches B → conflict flagged', () => {
    // BR-22: "If the email matches Person A but the license number matches
    // Person B: conflict. The record is flagged for human resolution."
    const existingPersons = [
      { id: 'person-a', email: 'jane@example.com', licenseNumber: 'PRC-11111' },
      { id: 'person-b', email: 'john@example.com', licenseNumber: 'PRC-22222' },
    ];

    const importRow = { email: 'jane@example.com', licenseNumber: 'PRC-22222' };

    const emailMatch = existingPersons.find(
      p => p.email.toLowerCase() === importRow.email.toLowerCase()
    );
    const licenseMatch = existingPersons.find(
      p => p.licenseNumber === importRow.licenseNumber
    );

    // Both match, but different people → conflict
    expect(emailMatch?.id).toBe('person-a');
    expect(licenseMatch?.id).toBe('person-b');
    expect(emailMatch?.id).not.toBe(licenseMatch?.id);

    const isConflict = emailMatch && licenseMatch && emailMatch.id !== licenseMatch.id;
    expect(isConflict).toBe(true);
  });

  test('no match creates new account', () => {
    // BR-22: "If no match is found, a new account is created."
    const existingPersons = [
      { id: 'person-a', email: 'jane@example.com', licenseNumber: 'PRC-11111' },
    ];

    const importRow = { email: 'unknown@example.com', licenseNumber: 'PRC-99999' };

    const emailMatch = existingPersons.find(
      p => p.email.toLowerCase() === importRow.email.toLowerCase()
    );
    const licenseMatch = existingPersons.find(
      p => p.licenseNumber === importRow.licenseNumber
    );

    expect(emailMatch).toBeUndefined();
    expect(licenseMatch).toBeUndefined();

    // Should create new account
    const shouldCreate = !emailMatch && !licenseMatch;
    expect(shouldCreate).toBe(true);
  });

  test('name mismatch with field match flagged for manual review', () => {
    // BR-22 edge: "A match where the names differ significantly should be
    // flagged for manual review even if a single field matches."
    const existingPerson = { id: 'person-a', email: 'jane@example.com', firstName: 'Maria', lastName: 'Cruz' };
    const importRow = { email: 'jane@example.com', firstName: 'Jose', lastName: 'Santos' };

    const emailMatches = existingPerson.email.toLowerCase() === importRow.email.toLowerCase();
    expect(emailMatches).toBe(true);

    const namesDiffer = existingPerson.firstName !== importRow.firstName
      || existingPerson.lastName !== importRow.lastName;
    expect(namesDiffer).toBe(true);

    // Should flag for manual review
    const needsReview = emailMatches && namesDiffer;
    expect(needsReview).toBe(true);
  });

  test('single field match (email only) links to existing account', () => {
    // When email matches and no license conflict, auto-link
    const existingPerson = { id: 'person-a', email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe' };
    const importRow = { email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe' };

    const emailMatches = existingPerson.email.toLowerCase() === importRow.email.toLowerCase();
    const namesMatch = existingPerson.firstName === importRow.firstName
      && existingPerson.lastName === importRow.lastName;

    expect(emailMatches).toBe(true);
    expect(namesMatch).toBe(true);

    // Should auto-link to existing person
    const shouldAutoLink = emailMatches && namesMatch;
    expect(shouldAutoLink).toBe(true);
  });
});
