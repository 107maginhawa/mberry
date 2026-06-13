/**
 * Tests for createPerson handler
 *
 * We build a minimal Hono Context stub so the handler can call
 * ctx.get(), ctx.req.valid(), ctx.req.header(), and ctx.json().
 * The PersonRepository is patched on the prototype to avoid DB calls.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { createPerson } from './createPerson';
import { PersonRepository } from './repos/person.repo';
import { ConflictError } from '@/core/errors';
import type { Person } from './repos/person.schema';

// Mock-Classification: APPROPRIATE — person handler with auth + DB boundary
// Assertion-Style: EXISTENCE_CHECK — verifying middleware/context injection patterns
// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<{ id: string; role: string }> = {}) {
  return { id: 'user-1', name: 'Alice', email: 'alice@example.com', role: 'user', ...overrides };
}

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 'user-1',
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
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-1',
    updatedBy: 'user-1',
    version: 1,
    ...overrides,
  } as unknown as Person;
}

function makeBody(overrides: Record<string, any> = {}) {
  return {
    firstName: 'Alice',
    lastName: 'Smith',
    ...overrides,
  };
}

// Capturing logger that implements pino-style child() so createPerson's
// `baseLogger?.child?.({...})` path is exercised and every (obj, msg) call is recorded.
function makeCapturingLogger(calls: any[]) {
  function makeChild(inherited: Record<string, any>) {
    return {
      debug: (obj: any, msg?: string) => calls.push({ level: 'debug', ...inherited, ...obj, msg }),
      info: (obj: any, msg?: string) => calls.push({ level: 'info', ...inherited, ...obj, msg }),
      warn: (obj: any, msg?: string) => calls.push({ level: 'warn', ...inherited, ...obj, msg }),
      error: (obj: any, msg?: string) => calls.push({ level: 'error', ...inherited, ...obj, msg }),
      child: (bindings: Record<string, any>) => makeChild({ ...inherited, ...bindings }),
    };
  }
  return makeChild({});
}

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

function makeCtx(opts: {
  user?: ReturnType<typeof makeUser>;
  body?: Record<string, any>;
  audit?: any;
  logger?: any;
}) {
  const user = opts.user ?? makeUser();
  const body = opts.body ?? makeBody();
  const logger = opts.logger ?? { info: () => {}, error: () => {} };
  const audit = opts.audit ?? null;

  const store: Record<string, any> = {
    user,
    database: {},
    logger,
    audit,
  };

  // Capture json response
  let captured: { data: any; status: number } = { data: null, status: 0 };

  const ctx = {
    get: (key: string) => store[key],
    req: {
      valid: () => body,
      header: (name: string) => undefined,
    },
    json: (data: any, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
  };

  return ctx as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createPerson', () => {
  let findOneById: ReturnType<typeof mock>;
  let createOne: ReturnType<typeof mock>;

  beforeEach(() => {
    findOneById = mock(async () => null);
    createOne = mock(async (data: any) => makePerson({ id: data.id, firstName: data.firstName, lastName: data.lastName }));

    // Patch prototype methods to avoid real DB calls
    PersonRepository.prototype.findOneById = findOneById as any;
    PersonRepository.prototype.createOne = createOne as any;
  });

  test('creates person and returns 201 for valid input', async () => {
    const ctx = makeCtx({});
    await createPerson(ctx);

    const { data, status } = ctx._captured();
    expect(status).toBe(201);
    expect(data.firstName).toBe('Alice');
    expect(createOne).toHaveBeenCalledTimes(1);
  });

  test('sets person id to authenticated user id', async () => {
    const ctx = makeCtx({ user: makeUser({ id: 'user-abc' }) });
    await createPerson(ctx);

    const callArg = (createOne as ReturnType<typeof mock>).mock.calls[0][0] as any;
    expect(callArg.id).toBe('user-abc');
  });

  test('sets createdBy to user id for audit trail', async () => {
    const ctx = makeCtx({ user: makeUser({ id: 'user-xyz' }) });
    await createPerson(ctx);

    const callArg = (createOne as ReturnType<typeof mock>).mock.calls[0][0] as any;
    expect(callArg.createdBy).toBe('user-xyz');
  });

  test('throws ConflictError when person already exists', async () => {
    findOneById = mock(async () => makePerson());
    PersonRepository.prototype.findOneById = findOneById as any;

    const ctx = makeCtx({});
    await expect(createPerson(ctx)).rejects.toBeInstanceOf(ConflictError);
    expect(createOne).not.toHaveBeenCalled();
  });

  test('stores null for optional missing body fields', async () => {
    const ctx = makeCtx({ body: { firstName: 'Alice' } });
    await createPerson(ctx);

    const callArg = (createOne as ReturnType<typeof mock>).mock.calls[0][0] as any;
    expect(callArg.lastName).toBeNull();
    expect(callArg.middleName).toBeNull();
    expect(callArg.dateOfBirth).toBeNull();
    expect(callArg.gender).toBeNull();
  });

  test('stores contact info when provided in body', async () => {
    const contactInfo = { email: 'alice@example.com', phone: '+1234567890' };
    const ctx = makeCtx({ body: makeBody({ contactInfo }) });
    await createPerson(ctx);

    const callArg = (createOne as ReturnType<typeof mock>).mock.calls[0][0] as any;
    expect(callArg.contactInfo).toEqual(contactInfo);
  });

  test('calls audit.logEvent when audit service is present', async () => {
    const logEvent = mock(async () => {});
    const audit = { logEvent };
    const ctx = makeCtx({ audit });
    await createPerson(ctx);

    expect(logEvent).toHaveBeenCalledTimes(1);
    const callArg = (logEvent as ReturnType<typeof mock>).mock.calls[0][0] as any;
    expect(callArg.action).toBe('create');
    expect(callArg.resourceType).toBe('person');
  });

  test('does not throw if audit.logEvent fails', async () => {
    const audit = { logEvent: mock(async () => { throw new Error('audit down'); }) };
    const ctx = makeCtx({ audit });

    // Should not rethrow audit error
    await expect(createPerson(ctx)).resolves.toBeDefined();
  });

  test('does not call audit.logEvent when audit service is absent', async () => {
    const ctx = makeCtx({ audit: null });
    await createPerson(ctx);
    // No assertion needed — just verifying it does not throw
  });

  // FIX-012 (G-14, DPA-05): createPerson must NOT log the raw email address.
  // Log a `hasEmail` boolean instead of the PII.
  test('[FIX-012] does not log the raw email address (logs hasEmail boolean)', async () => {
    const calls: any[] = [];
    const ctx = makeCtx({
      logger: makeCapturingLogger(calls),
      body: makeBody({ contactInfo: { email: 'alice@example.com', phone: '+1234567890' } }),
    });

    await createPerson(ctx);

    const infoCalls = calls.filter((c) => c.level === 'info');
    expect(infoCalls.length).toBeGreaterThan(0);
    // No raw email value anywhere in the structured log payloads.
    expect(JSON.stringify(infoCalls)).not.toContain('alice@example.com');
    expect(infoCalls.some((c) => 'email' in c)).toBe(false);
    // A PII-safe boolean is logged instead.
    expect(infoCalls.some((c) => c.hasEmail === true)).toBe(true);
  });
});
