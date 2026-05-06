/**
 * Tests for MembershipRepository
 *
 * All database calls are intercepted by a hand-crafted db stub so no real
 * Postgres connection is needed. We verify that each method calls the correct
 * DB chain and returns/transforms data appropriately.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { MembershipRepository } from './membership.repo';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeMembership(overrides: Record<string, any> = {}) {
  return {
    id: 'mem-1',
    organizationId: 'org-1',
    orgId: 'org-1',
    personId: 'person-1',
    tierId: 'tier-1',
    categoryId: 'cat-1',
    memberNumber: 'MEM-001',
    startDate: '2026-01-01',
    duesExpiryDate: '2027-01-01',
    gracePeriodDays: 30,
    status: 'active',
    joinedAt: new Date('2026-01-01T00:00:00Z'),
    terminatedAt: null,
    terminationReason: null,
    note: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    createdBy: 'admin-1',
    updatedBy: 'admin-1',
    ...overrides,
  };
}

function makePerson(overrides: Record<string, any> = {}) {
  return {
    id: 'person-1',
    firstName: 'Jane',
    lastName: 'Doe',
    avatar: null,
    ...overrides,
  };
}

function makeCategory(overrides: Record<string, any> = {}) {
  return {
    id: 'cat-1',
    organizationId: 'org-1',
    orgId: 'org-1',
    name: 'Regular',
    description: 'Regular membership',
    applicableTiers: ['tier-1'],
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

function makeApplication(overrides: Record<string, any> = {}) {
  return {
    id: 'app-1',
    organizationId: 'org-1',
    orgId: 'org-1',
    personId: 'person-1',
    tierId: 'tier-1',
    applicationDate: '2026-01-15',
    status: 'submitted',
    reviewedBy: null,
    reviewedAt: null,
    denialReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

/**
 * Build a minimal db stub whose chainable select/update/insert methods
 * resolve to whatever `rows` is provided.
 */
function makeDb({
  selectRows = [] as any[],
  selectRowsSets = undefined as any[][] | undefined,
  insertRow = {} as any,
  updateRow = {} as any,
}: {
  selectRows?: any[];
  selectRowsSets?: any[][];
  insertRow?: any;
  updateRow?: any;
} = {}) {
  let selectCallCount = 0;

  const awaitable = (result: any) => ({
    from: () => awaitable(result),
    leftJoin: () => awaitable(result),
    innerJoin: () => awaitable(result),
    where: () => awaitable(result),
    limit: (_n: number) => awaitable(result),
    returning: () => Promise.resolve(result),
    orderBy: () => awaitable(result),
    offset: (_n: number) => awaitable(result),
    // Allow direct await on the chain (for queries that don't end with .limit())
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
  });

  return {
    select: (fields?: any) => {
      const rows = selectRowsSets
        ? selectRowsSets[selectCallCount++] ?? selectRows
        : selectRows;
      return awaitable(rows);
    },
    insert: (_table: any) => ({
      values: (data: any) => ({
        returning: () =>
          Promise.resolve(Array.isArray(data) ? data.map(() => insertRow) : [insertRow]),
      }),
    }),
    update: (_table: any) => ({
      set: (_data: any) => ({
        where: () => ({
          returning: () => Promise.resolve([updateRow]),
        }),
      }),
    }),
    delete: (_table: any) => ({
      where: () => Promise.resolve({ rowCount: 1 }),
    }),
  };
}

// ---------------------------------------------------------------------------
// MembershipRepository.listMembers
// ---------------------------------------------------------------------------

describe('MembershipRepository.listMembers', () => {
  test('returns members with person and category data for an org', async () => {
    const row = {
      membership: makeMembership(),
      person: makePerson(),
      category: { id: 'cat-1', name: 'Regular' },
    };
    const countRow = { count: 1 };

    const db = makeDb({ selectRowsSets: [[row], [countRow]] });
    const repo = new MembershipRepository(db as any);

    const result = await repo.listMembers({ organizationId: 'org-1' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].membership.id).toBe('mem-1');
    expect(result.data[0].person.firstName).toBe('Jane');
    expect(result.total).toBe(1);
  });

  test('returns empty array and zero total when no members exist', async () => {
    const db = makeDb({ selectRowsSets: [[], [{ count: 0 }]] });
    const repo = new MembershipRepository(db as any);

    const result = await repo.listMembers({ organizationId: 'org-1' });
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  test('supports status filter without error', async () => {
    const db = makeDb({ selectRowsSets: [[], [{ count: 0 }]] });
    const repo = new MembershipRepository(db as any);

    const result = await repo.listMembers({
      organizationId: 'org-1',
      status: 'active',
    });
    expect(result.data).toEqual([]);
  });

  test('supports categoryId filter without error', async () => {
    const db = makeDb({ selectRowsSets: [[], [{ count: 0 }]] });
    const repo = new MembershipRepository(db as any);

    const result = await repo.listMembers({
      organizationId: 'org-1',
      categoryId: 'cat-1',
    });
    expect(result.data).toEqual([]);
  });

  test('supports search filter without error', async () => {
    const db = makeDb({ selectRowsSets: [[], [{ count: 0 }]] });
    const repo = new MembershipRepository(db as any);

    const result = await repo.listMembers({
      organizationId: 'org-1',
      search: 'Jane',
    });
    expect(result.data).toEqual([]);
  });

  test('supports pagination via limit and offset', async () => {
    const db = makeDb({ selectRowsSets: [[], [{ count: 0 }]] });
    const repo = new MembershipRepository(db as any);

    const result = await repo.listMembers({
      organizationId: 'org-1',
      limit: 10,
      offset: 20,
    });
    expect(result.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// MembershipRepository.getMember
// ---------------------------------------------------------------------------

describe('MembershipRepository.getMember', () => {
  test('returns member with person and category when found', async () => {
    const row = {
      membership: makeMembership(),
      person: makePerson(),
      category: { id: 'cat-1', name: 'Regular' },
    };
    const db = makeDb({ selectRows: [row] });
    const repo = new MembershipRepository(db as any);

    const result = await repo.getMember('org-1', 'person-1');
    expect(result).toBeDefined();
    expect(result!.membership.id).toBe('mem-1');
    expect(result!.person.firstName).toBe('Jane');
  });

  test('returns undefined when member does not exist', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = new MembershipRepository(db as any);

    const result = await repo.getMember('org-1', 'missing-person');
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// MembershipRepository.addMember
// ---------------------------------------------------------------------------

describe('MembershipRepository.addMember', () => {
  test('inserts a membership record and returns it', async () => {
    const newMember = makeMembership();
    const db = makeDb({ insertRow: newMember });
    const repo = new MembershipRepository(db as any);

    const result = await repo.addMember(newMember as any);
    expect(result.id).toBe('mem-1');
    expect(result.status).toBe('active');
    expect(result.personId).toBe('person-1');
  });
});

// ---------------------------------------------------------------------------
// MembershipRepository.updateMember
// ---------------------------------------------------------------------------

describe('MembershipRepository.updateMember', () => {
  test('updates membership fields and returns updated record', async () => {
    const updated = makeMembership({ status: 'suspended' });
    const db = makeDb({ updateRow: updated });
    const repo = new MembershipRepository(db as any);

    const result = await repo.updateMember('mem-1', { status: 'suspended' } as any);
    expect(result.status).toBe('suspended');
  });

  test('updates category assignment', async () => {
    const updated = makeMembership({ categoryId: 'cat-2' });
    const db = makeDb({ updateRow: updated });
    const repo = new MembershipRepository(db as any);

    const result = await repo.updateMember('mem-1', { categoryId: 'cat-2' } as any);
    expect(result.categoryId).toBe('cat-2');
  });

  test('sets updatedAt on every update', async () => {
    let capturedData: any;
    const db: any = {
      update: (_table: any) => ({
        set: (data: any) => {
          capturedData = data;
          return {
            where: () => ({
              returning: () => Promise.resolve([makeMembership(data)]),
            }),
          };
        },
      }),
    };

    const repo = new MembershipRepository(db);
    await repo.updateMember('mem-1', { note: 'updated note' } as any);
    expect(capturedData.updatedAt).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// MembershipRepository.bulkImportMembers
// ---------------------------------------------------------------------------

describe('MembershipRepository.bulkImportMembers', () => {
  test('inserts multiple membership records and returns them', async () => {
    const member = makeMembership();
    const db = makeDb({ insertRow: member });
    const repo = new MembershipRepository(db as any);

    const result = await repo.bulkImportMembers([member as any, member as any]);
    expect(result).toHaveLength(2);
  });

  test('returns empty array when given empty input', async () => {
    const db = makeDb();
    const repo = new MembershipRepository(db as any);

    const result = await repo.bulkImportMembers([]);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// MembershipRepository.listCategories
// ---------------------------------------------------------------------------

describe('MembershipRepository.listCategories', () => {
  test('returns categories for an organization', async () => {
    const cat = makeCategory();
    const db = makeDb({ selectRows: [cat] });
    const repo = new MembershipRepository(db as any);

    const result = await repo.listCategories('org-1');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Regular');
  });

  test('returns empty array when no categories exist', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = new MembershipRepository(db as any);

    const result = await repo.listCategories('org-1');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// MembershipRepository.upsertCategory
// ---------------------------------------------------------------------------

describe('MembershipRepository.upsertCategory', () => {
  test('creates a new category when none exists with that name', async () => {
    const newCat = makeCategory({ id: 'cat-new' });

    // First select returns empty (no existing), insert returns new cat
    const db: any = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
            then: (resolve: any) => resolve([]),
          }),
        }),
      }),
      insert: (_table: any) => ({
        values: (_data: any) => ({
          returning: () => Promise.resolve([newCat]),
        }),
      }),
    };

    const repo = new MembershipRepository(db);
    const result = await repo.upsertCategory(newCat as any);
    expect(result.id).toBe('cat-new');
    expect(result.name).toBe('Regular');
  });

  test('updates existing category when one with same name exists', async () => {
    const existing = makeCategory({ id: 'cat-existing' });
    const updated = makeCategory({ id: 'cat-existing', description: 'Updated desc' });

    const db: any = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([existing]),
            then: (resolve: any) => resolve([existing]),
          }),
        }),
      }),
      update: (_table: any) => ({
        set: (_data: any) => ({
          where: () => ({
            returning: () => Promise.resolve([updated]),
          }),
        }),
      }),
    };

    const repo = new MembershipRepository(db);
    const result = await repo.upsertCategory(existing as any);
    expect(result.id).toBe('cat-existing');
    expect(result.description).toBe('Updated desc');
  });
});

// ---------------------------------------------------------------------------
// MembershipRepository.listApplications
// ---------------------------------------------------------------------------

describe('MembershipRepository.listApplications', () => {
  test('returns applications with person data for an org', async () => {
    const row = {
      application: makeApplication(),
      person: { id: 'person-1', firstName: 'Jane', lastName: 'Doe' },
    };
    const db = makeDb({ selectRows: [row] });
    const repo = new MembershipRepository(db as any);

    const result = await repo.listApplications('org-1');
    expect(result).toHaveLength(1);
    expect(result[0].application.status).toBe('submitted');
    expect(result[0].person.firstName).toBe('Jane');
  });

  test('returns empty array when no applications exist', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = new MembershipRepository(db as any);

    const result = await repo.listApplications('org-1');
    expect(result).toEqual([]);
  });

  test('supports status filter', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = new MembershipRepository(db as any);

    const result = await repo.listApplications('org-1', 'submitted');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// MembershipRepository.reviewApplication
// ---------------------------------------------------------------------------

describe('MembershipRepository.reviewApplication', () => {
  test('approves an application and sets reviewer', async () => {
    const reviewed = makeApplication({
      status: 'approved',
      reviewedBy: 'reviewer-1',
      reviewedAt: new Date(),
    });
    const db = makeDb({ updateRow: reviewed });
    const repo = new MembershipRepository(db as any);

    const result = await repo.reviewApplication('app-1', 'approved', 'reviewer-1');
    expect(result.status).toBe('approved');
    expect(result.reviewedBy).toBe('reviewer-1');
    expect(result.reviewedAt).toBeInstanceOf(Date);
  });

  test('denies an application and sets denial reason', async () => {
    const reviewed = makeApplication({
      status: 'denied',
      reviewedBy: 'reviewer-1',
      reviewedAt: new Date(),
      denialReason: 'Incomplete documents',
    });

    let capturedData: any;
    const db: any = {
      update: (_table: any) => ({
        set: (data: any) => {
          capturedData = data;
          return {
            where: () => ({
              returning: () => Promise.resolve([reviewed]),
            }),
          };
        },
      }),
    };

    const repo = new MembershipRepository(db);
    const result = await repo.reviewApplication(
      'app-1',
      'denied',
      'reviewer-1',
      'Incomplete documents',
    );

    expect(result.status).toBe('denied');
    expect(result.denialReason).toBe('Incomplete documents');
    expect(capturedData.denialReason).toBe('Incomplete documents');
    expect(capturedData.reviewedAt).toBeInstanceOf(Date);
    expect(capturedData.updatedAt).toBeInstanceOf(Date);
  });

  test('does not set denialReason when status is not denied', async () => {
    let capturedData: any;
    const db: any = {
      update: (_table: any) => ({
        set: (data: any) => {
          capturedData = data;
          return {
            where: () => ({
              returning: () => Promise.resolve([makeApplication({ status: 'approved' })]),
            }),
          };
        },
      }),
    };

    const repo = new MembershipRepository(db);
    await repo.reviewApplication('app-1', 'approved', 'reviewer-1', 'some reason');

    // When status is not 'denied', denialReason should be undefined
    expect(capturedData.denialReason).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// MembershipRepository.getMemberCountByCategory
// ---------------------------------------------------------------------------

describe('MembershipRepository.getMemberCountByCategory', () => {
  test('returns count of members in a category', async () => {
    const db = makeDb({ selectRows: [{ count: 5 }] });
    const repo = new MembershipRepository(db as any);

    const result = await repo.getMemberCountByCategory('cat-1');
    expect(result).toBe(5);
  });

  test('returns 0 when no members in category', async () => {
    const db = makeDb({ selectRows: [{ count: 0 }] });
    const repo = new MembershipRepository(db as any);

    const result = await repo.getMemberCountByCategory('cat-1');
    expect(result).toBe(0);
  });
});
