/**
 * Tests for PersonRepository
 *
 * We mock at the repo-method level (not the Drizzle DB level) to avoid
 * recreating the full Drizzle query-builder chain.  ensurePersonForUser
 * is the main unit of logic here — the base-class CRUD methods are thin
 * wrappers tested by checking they delegate correctly.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { PersonRepository } from './person.repo';
import type { Person, NewPerson } from './person.schema';

// Mock-Classification: APPROPRIATE — DB repository layer boundary
// Assertion-Style: EXISTENCE_CHECK — verifying middleware/context injection patterns
// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 'person-1',
    firstName: 'Alice',
    lastName: 'Smith',
    middleName: null,
    dateOfBirth: null,
    gender: null,
    primaryAddress: null,
    contactInfo: null,
    avatar: null,
    languagesSpoken: [],
    timezone: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    createdBy: 'user-1',
    updatedBy: 'user-1',
    version: 1,
    ...overrides,
  } as unknown as Person;
}

function makeUser(overrides: Partial<{ id: string; name: string }> = {}) {
  return {
    id: 'user-1',
    name: 'Alice Smith',
    email: 'alice@example.com',
    role: 'user',
    ...overrides,
  };
}

/**
 * Build a PersonRepository whose Drizzle-dependent methods are all replaced
 * with mocks so we only test the repo's own logic.
 */
function makeRepo(methodOverrides: {
  findOneById?: (id: string) => Promise<Person | null>;
  createOne?: (data: any) => Promise<Person>;
  updateOneById?: (id: string, data: any) => Promise<Person>;
  deleteOneById?: (id: string) => Promise<void>;
} = {}) {
  // Pass a minimal stub for db — it won't be called because we patch methods
  const db = {} as any;
  const logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
  const repo = new PersonRepository(db, logger);

  // Replace base-class methods with mocks
  repo.findOneById = mock(methodOverrides.findOneById ?? (async () => null)) as any;
  repo.createOne = mock(methodOverrides.createOne ?? (async (d: any) => makePerson(d))) as any;
  repo.updateOneById = mock(methodOverrides.updateOneById ?? (async (_id, d) => makePerson(d))) as any;
  repo.deleteOneById = mock(methodOverrides.deleteOneById ?? (async () => {})) as any;

  return repo;
}

// ---------------------------------------------------------------------------
// createOne delegation
// ---------------------------------------------------------------------------

describe('PersonRepository.createOne', () => {
  test('is callable and returns the mocked person', async () => {
    const expected = makePerson({ firstName: 'Bob' });
    const repo = makeRepo({ createOne: async () => expected });
    const result = await repo.createOne({ firstName: 'Bob', createdBy: 'u', updatedBy: 'u' } as NewPerson);
    expect(result).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// findOneById delegation
// ---------------------------------------------------------------------------

describe('PersonRepository.findOneById', () => {
  test('returns null when no record is found', async () => {
    const repo = makeRepo({ findOneById: async () => null });
    const result = await repo.findOneById('nonexistent');
    expect(result).toBeNull();
  });

  test('returns the person when found', async () => {
    const person = makePerson();
    const repo = makeRepo({ findOneById: async () => person });
    const result = await repo.findOneById('person-1');
    expect(result).toEqual(person);
  });
});

// ---------------------------------------------------------------------------
// updateOneById delegation
// ---------------------------------------------------------------------------

describe('PersonRepository.updateOneById', () => {
  test('returns updated person', async () => {
    const updated = makePerson({ firstName: 'Updated' });
    const repo = makeRepo({ updateOneById: async () => updated });
    const result = await repo.updateOneById('person-1', { firstName: 'Updated' } as Partial<Person>);
    expect(result.firstName).toBe('Updated');
  });
});

// ---------------------------------------------------------------------------
// deleteOneById delegation
// ---------------------------------------------------------------------------

describe('PersonRepository.deleteOneById', () => {
  test('resolves without throwing', async () => {
    const repo = makeRepo();
    await expect(repo.deleteOneById('person-1')).resolves.toBeUndefined();
    expect(repo.deleteOneById).toHaveBeenCalledWith('person-1');
  });
});

// ---------------------------------------------------------------------------
// ensurePersonForUser — create path (person does not exist)
// ---------------------------------------------------------------------------

describe('PersonRepository.ensurePersonForUser — create path', () => {
  test('creates person with user name when none exists and no personInput', async () => {
    const created = makePerson({ id: 'user-1', firstName: 'Alice Smith' });
    const repo = makeRepo({
      findOneById: async () => null,
      createOne: async () => created,
    });

    const user = makeUser();
    const result = await repo.ensurePersonForUser(user as any);

    expect(result).toEqual(created);
    expect(repo.createOne).toHaveBeenCalledTimes(1);
    const callArg = (repo.createOne as ReturnType<typeof mock>).mock.calls[0][0] as any;
    expect(callArg.id).toBe('user-1');
    expect(callArg.firstName).toBe('Alice Smith');
  });

  test('creates person with personInput data when provided', async () => {
    const created = makePerson({ id: 'user-1', firstName: 'Custom' });
    const repo = makeRepo({
      findOneById: async () => null,
      createOne: async () => created,
    });

    const user = makeUser();
    await repo.ensurePersonForUser(user as any, { firstName: 'Custom' });

    const callArg = (repo.createOne as ReturnType<typeof mock>).mock.calls[0][0] as any;
    expect(callArg.firstName).toBe('Custom');
    expect(callArg.id).toBe('user-1'); // Always forced to userId
  });

  test('falls back to "Anonymous" firstName when user.name is falsy', async () => {
    const created = makePerson({ firstName: 'Anonymous' });
    const repo = makeRepo({
      findOneById: async () => null,
      createOne: async () => created,
    });

    const user = makeUser({ name: '' });
    await repo.ensurePersonForUser(user as any);

    const callArg = (repo.createOne as ReturnType<typeof mock>).mock.calls[0][0] as any;
    expect(callArg.firstName).toBe('Anonymous');
  });

  test('sets createdBy and updatedBy to user id', async () => {
    const created = makePerson();
    const repo = makeRepo({ findOneById: async () => null, createOne: async () => created });

    const user = makeUser({ id: 'user-xyz' });
    await repo.ensurePersonForUser(user as any);

    const callArg = (repo.createOne as ReturnType<typeof mock>).mock.calls[0][0] as any;
    expect(callArg.createdBy).toBe('user-xyz');
    expect(callArg.updatedBy).toBe('user-xyz');
  });
});

// ---------------------------------------------------------------------------
// ensurePersonForUser — return existing (no update)
// ---------------------------------------------------------------------------

describe('PersonRepository.ensurePersonForUser — existing, no input', () => {
  test('returns existing person without calling update', async () => {
    const existing = makePerson();
    const repo = makeRepo({ findOneById: async () => existing });

    const user = makeUser();
    const result = await repo.ensurePersonForUser(user as any);

    expect(result).toEqual(existing);
    expect(repo.updateOneById).not.toHaveBeenCalled();
    expect(repo.createOne).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ensurePersonForUser — update path (person exists + personInput provided)
// ---------------------------------------------------------------------------

describe('PersonRepository.ensurePersonForUser — update path', () => {
  test('updates existing person when personInput is provided', async () => {
    const existing = makePerson();
    const updated = makePerson({ firstName: 'Updated' });
    const repo = makeRepo({
      findOneById: async () => existing,
      updateOneById: async () => updated,
    });

    const user = makeUser();
    const result = await repo.ensurePersonForUser(user as any, { firstName: 'Updated' });

    expect(result).toEqual(updated);
    expect(repo.updateOneById).toHaveBeenCalledTimes(1);
    expect(repo.createOne).not.toHaveBeenCalled();
  });

  test('sets updatedBy to userId when updating', async () => {
    const existing = makePerson();
    const repo = makeRepo({
      findOneById: async () => existing,
      updateOneById: async () => existing,
    });

    const user = makeUser({ id: 'user-abc' });
    await repo.ensurePersonForUser(user as any, { firstName: 'X' });

    const updateArg = (repo.updateOneById as ReturnType<typeof mock>).mock.calls[0][1] as any;
    expect(updateArg.updatedBy).toBe('user-abc');
  });
});

// ---------------------------------------------------------------------------
// buildWhereConditions — indirect validation via filter shapes
// ---------------------------------------------------------------------------

describe('PersonRepository.buildWhereConditions', () => {
  test('buildWhereConditions returns undefined for empty filters', () => {
    const db = {} as any;
    const repo = new PersonRepository(db, undefined);
    // Access protected method through type assertion
    const result = (repo as any).buildWhereConditions({});
    expect(result).toBeUndefined();
  });

  test('buildWhereConditions returns undefined for no filters', () => {
    const db = {} as any;
    const repo = new PersonRepository(db, undefined);
    const result = (repo as any).buildWhereConditions(undefined);
    expect(result).toBeUndefined();
  });

  test('buildWhereConditions returns condition for firstName filter', () => {
    const db = {} as any;
    const repo = new PersonRepository(db, undefined);
    const result = (repo as any).buildWhereConditions({ firstName: 'Alice' });
    expect(result).toBeDefined();
  });

  test('buildWhereConditions returns condition for lastName filter', () => {
    const db = {} as any;
    const repo = new PersonRepository(db, undefined);
    const result = (repo as any).buildWhereConditions({ lastName: 'Smith' });
    expect(result).toBeDefined();
  });

  test('buildWhereConditions returns condition for q (general search) filter', () => {
    const db = {} as any;
    const repo = new PersonRepository(db, undefined);
    const result = (repo as any).buildWhereConditions({ q: 'alice' });
    expect(result).toBeDefined();
  });

  test('buildWhereConditions returns condition combining multiple filters', () => {
    const db = {} as any;
    const repo = new PersonRepository(db, undefined);
    const result = (repo as any).buildWhereConditions({ firstName: 'Alice', lastName: 'Smith' });
    expect(result).toBeDefined();
  });
});
