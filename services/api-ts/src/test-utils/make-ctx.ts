/**
 * Shared test helpers for creating mock handler contexts and test data.
 *
 * ALL test files should import from here. Do NOT define local stubs.
 *
 * Usage:
 *   const ctx = makeCtx({ _body: { name: 'Test' }, organizationId: 'tenant-1' });
 *   const response = await someHandler(ctx);
 *   expect(response.status).toBe(201);
 */

// ─── User Factories ──────────────────────────────────────

export interface TestUser {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string;
}

export function makeUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
    organizationId: 'org-1',
    ...overrides,
  };
}

export function makeOfficer(overrides: Partial<TestUser> = {}): TestUser {
  return makeUser({ id: 'officer-1', name: 'Officer User', email: 'officer@example.com', role: 'officer', ...overrides });
}

export function makeMember(overrides: Partial<TestUser> = {}): TestUser {
  return makeUser({ id: 'member-1', name: 'Member User', email: 'member@example.com', role: 'member', ...overrides });
}

// ─── Context Factory ─────────────────────────────────────

export function makeCtx(overrides: Record<string, any> = {}) {
  const user = overrides['user'] !== undefined ? overrides['user'] : { id: 'user-1', role: 'user', twoFactorEnabled: true };
  const vars: Record<string, any> = {
    user,
    session: user ? { id: 'session-1', userId: user.id, user } : null,
    organizationId: 'tenant-1',
    database: { transaction: async (fn: any) => fn({}) },
    logger: null,
    audit: null,
    ...overrides,
  };

  const jsonBody: any = overrides['_body'] || {};
  const paramValues: any = overrides['_params'] || {};
  const queryValues: any = overrides['_query'] || {};

  return {
    get: (key: string) => vars[key],
    set: (key: string, val: any) => { vars[key] = val; },
    req: {
      valid: (target: string) => {
        if (target === 'json') return jsonBody;
        if (target === 'param') return paramValues;
        if (target === 'query') return queryValues;
        return {};
      },
      param: (key: string) => paramValues[key] || '',
      header: () => null,
      json: () => Promise.resolve(jsonBody),
      query: (key: string) => queryValues[key] || null,
    },
    json: (body: any, status: number) => ({ status, body }) as any as Response,
    body: (body: any, status: number) => ({ status, body }) as any as Response,
  } as any;
}

// ─── Repository Stubs ────────────────────────────────────

/**
 * Pristine prototype snapshots. The FIRST stubRepo call for a class saves
 * all methods before any modification. restoreRepo() uses this to fully
 * undo cross-file prototype pollution caused by Bun's parallel test execution.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
const pristinePrototypes = new WeakMap<Function, Map<string, (...args: any[]) => any>>();

export function ensurePristine<T extends new (...args: any[]) => any>(RepoClass: T) {
  if (!pristinePrototypes.has(RepoClass)) {
    const originals = new Map<string, (...args: any[]) => any>();
    for (const name of Object.getOwnPropertyNames(RepoClass.prototype)) {
      const val = RepoClass.prototype[name];
      if (typeof val === 'function' && name !== 'constructor') {
        originals.set(name, val);
      }
    }
    pristinePrototypes.set(RepoClass, originals);
  }
}

/**
 * Restore ALL prototype methods to their pristine (pre-stub) state.
 * Use in beforeEach() of repo unit tests to undo cross-file pollution.
 *
 * This also deletes any own properties that were added by stubRepo but
 * were not originally on the prototype (i.e., inherited from a base class).
 * Without this step, stubRepo'd methods like createOne (inherited from
 * DatabaseRepository) would remain as own properties after restoreRepo.
 */
export function restoreRepo<T extends new (...args: any[]) => any>(RepoClass: T) {
  const originals = pristinePrototypes.get(RepoClass);
  if (originals) {
    // Restore methods that were originally present
    for (const [name, fn] of originals) {
      RepoClass.prototype[name] = fn;
    }
    // Delete any own properties added by stubRepo that weren't originally there
    for (const name of Object.getOwnPropertyNames(RepoClass.prototype)) {
      if (name !== 'constructor' && !originals.has(name)) {
        delete RepoClass.prototype[name];
      }
    }
  }
}

/**
 * Stub methods on a repository class prototype for testing.
 * Returns the mock functions for assertion.
 *
 * Usage:
 *   const mocks = stubRepo(DuesRepository, {
 *     getConfig: async () => ({ id: 'config-1', organizationId: 'org-1' }),
 *     listFunds: async () => [],
 *   });
 *   // handler uses `new DuesRepository(db)` — stubbed methods are used
 *   // ...
 *   mocks.getConfig.mockRestore(); // restore after test
 */
export function stubRepo<T extends new (...args: any[]) => any>(
  RepoClass: T,
  methods: Partial<Record<keyof InstanceType<T>, (...args: any[]) => any>>,
): Record<string, { mockRestore: () => void }> {
  ensurePristine(RepoClass);
  const mocks: Record<string, { mockRestore: () => void }> = {};

  for (const [name, fn] of Object.entries(methods)) {
    const original = RepoClass.prototype[name];
    RepoClass.prototype[name] = fn;
    mocks[name] = {
      mockRestore: () => { RepoClass.prototype[name] = original; },
    };
  }

  return mocks;
}

// ─── Auth Assertion Helpers ──────────────────────────────

/**
 * Assert a handler returns 401 when called without a user.
 */
export async function expectUnauthorized(
  handler: (ctx: any) => Promise<Response>,
  ctxOverrides: Record<string, any> = {},
): Promise<void> {
  const ctx = makeCtx({ user: null, session: null, ...ctxOverrides });
  const response = await handler(ctx);
  if (response.status !== 401) {
    throw new Error(`Expected 401, got ${response.status}`);
  }
}

/**
 * Assert a handler returns 403 when called with a user from a different org.
 */
export async function expectForbidden(
  handler: (ctx: any) => Promise<Response>,
  ctxOverrides: Record<string, any> = {},
): Promise<void> {
  const wrongOrgUser = makeUser({ organizationId: 'wrong-org' });
  const ctx = makeCtx({ user: wrongOrgUser, organizationId: 'wrong-org', ...ctxOverrides });
  const response = await handler(ctx);
  if (response.status !== 403) {
    throw new Error(`Expected 403, got ${response.status}`);
  }
}
