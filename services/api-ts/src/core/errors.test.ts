/**
 * Tests for errors.ts — AppError subclasses and createErrorHandler().
 *
 * createErrorHandler returns a (err, ctx) => Response handler.  We construct
 * minimal Hono Context stubs using Hono's own Request/Response helpers so we
 * can assert on status codes and JSON bodies without running a real server.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError, z } from 'zod';
import {
  AppError,
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  BusinessLogicError,
  ConflictError,
  RateLimitError,
  UnauthorizedError,
  ForbiddenError,
  TimeoutError,
  ExternalServiceError,
  createErrorHandler,
} from './errors';
import type { Config } from './config';
// Factory N/A: core infrastructure test — config/setup/service assertions, no domain entities

// ---------------------------------------------------------------------------
// Minimal config stub
// ---------------------------------------------------------------------------

function makeConfig(overrides?: Partial<Config['logging']>): Config {
  return {
    server: { host: '0.0.0.0', port: 7213 },
    database: { url: 'postgres://localhost/test', poolMin: 2, poolMax: 10, idleTimeoutMs: 30000, ssl: false, logging: false },
    cors: { origins: ['*'], credentials: true, allowLocalNetwork: true, allowTunneling: true, strict: false },
    logging: { level: overrides?.level ?? 'info', pretty: false },
    auth: {
      baseUrl: 'http://localhost:7213',
      secret: 'test-secret',
      sessionExpiresIn: 604800,
      rateLimitEnabled: false,
      rateLimitWindow: 60,
      rateLimitMax: 10,
      adminEmails: [],
      socialProviders: {},
    },
    rateLimit: { enabled: false, max: 100 },
    storage: {
      provider: 'minio',
      endpoint: 'http://localhost:9000',
      publicEndpoint: 'http://localhost:9000',
      bucket: 'test',
      region: 'us-east-1',
      credentials: { accessKeyId: 'key', secretAccessKey: 'secret' },
      uploadUrlExpiry: 300,
      downloadUrlExpiry: 900,
    },
    email: {
      provider: 'smtp',
      from: { name: 'Test', email: 'test@test.com' },
      smtp: { host: '127.0.0.1', port: 1025, secure: false, auth: { user: '', pass: '' } },
    },
    notifs: { provider: 'onesignal' },
    billing: { provider: 'stripe', stripe: {} },
    webrtc: { iceServers: [] },
  } as unknown as Config;
}

// ---------------------------------------------------------------------------
// Minimal Hono Context helper
// ---------------------------------------------------------------------------

/**
 * Build a real Hono Context for the given method + path by dispatching a
 * request through a throwaway Hono app.  The handler captures the context
 * and resolves a promise with it so tests can use it synchronously.
 */
async function makeContext(method = 'GET', path = '/test'): Promise<Parameters<ReturnType<typeof createErrorHandler>>[1]> {
  let capturedCtx: any;
  const app = new Hono();
  app.all('*', (c) => {
    capturedCtx = c;
    return c.json({});
  });
  await app.request(new Request(`http://localhost${path}`, { method }));
  return capturedCtx;
}

// ---------------------------------------------------------------------------
// AppError subclasses — instantiation, status codes, codes, messages
// ---------------------------------------------------------------------------

describe('AppError base class', () => {
  test('default construction', () => {
    const err = new AppError('something broke');
    expect(err.message).toBe('something broke');
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.statusCode).toBe(500);
    expect(err.details).toBeUndefined();
    expect(err).toBeInstanceOf(Error);
  });

  test('custom code, statusCode and details', () => {
    const err = new AppError('bad', 'MY_CODE', 400, { foo: 'bar' });
    expect(err.code).toBe('MY_CODE');
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual({ foo: 'bar' });
  });

  test('name is "AppError"', () => {
    expect(new AppError('x').name).toBe('AppError');
  });
});

describe('ValidationError', () => {
  test('default message, code, status', () => {
    const err = new ValidationError();
    expect(err.message).toBe('Validation failed');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
    expect(err).toBeInstanceOf(AppError);
  });

  test('custom message', () => {
    expect(new ValidationError('name is required').message).toBe('name is required');
  });
});

describe('NotFoundError', () => {
  test('default message, code, status', () => {
    const err = new NotFoundError();
    expect(err.message).toBe('Resource not found');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  test('options are stored in details', () => {
    const err = new NotFoundError('User not found', {
      resourceType: 'User',
      resource: '42',
      suggestions: ['Check the user list'],
    });
    expect(err.details?.resourceType).toBe('User');
    expect(err.details?.resource).toBe('42');
    expect(err.details?.suggestions).toEqual(['Check the user list']);
  });
});

describe('AuthenticationError', () => {
  test('default construction', () => {
    const err = new AuthenticationError();
    expect(err.message).toBe('Authentication failed');
    expect(err.code).toBe('AUTHENTICATION_ERROR');
    expect(err.statusCode).toBe(401);
  });

  test('scheme and supportedSchemes stored in details', () => {
    const err = new AuthenticationError('Bad token', 'Bearer', ['Bearer', 'Basic']);
    expect(err.details?.scheme).toBe('Bearer');
    expect(err.details?.supportedSchemes).toEqual(['Bearer', 'Basic']);
  });
});

describe('AuthorizationError', () => {
  test('default construction', () => {
    const err = new AuthorizationError();
    expect(err.message).toBe('Insufficient permissions');
    expect(err.code).toBe('AUTHORIZATION_ERROR');
    expect(err.statusCode).toBe(403);
  });

  test('permission details stored', () => {
    const err = new AuthorizationError('No access', 'admin:write', ['user:read'], '/resource');
    expect(err.details?.requiredPermission).toBe('admin:write');
    expect(err.details?.userPermissions).toEqual(['user:read']);
    expect(err.details?.resource).toBe('/resource');
  });
});

describe('BusinessLogicError', () => {
  test('default code is "BUSINESS_ERROR", status 422', () => {
    const err = new BusinessLogicError('Cannot cancel past booking');
    expect(err.code).toBe('BUSINESS_ERROR');
    expect(err.statusCode).toBe(422);
  });

  test('custom code is accepted', () => {
    const err = new BusinessLogicError('Overlap', 'SLOT_OVERLAP');
    expect(err.code).toBe('SLOT_OVERLAP');
  });
});

describe('ConflictError', () => {
  test('default message, code, status', () => {
    const err = new ConflictError();
    expect(err.message).toBe('Resource conflict');
    expect(err.code).toBe('CONFLICT');
    expect(err.statusCode).toBe(409);
  });
});

describe('RateLimitError', () => {
  test('default construction', () => {
    const err = new RateLimitError();
    expect(err.message).toBe('Rate limit exceeded');
    expect(err.code).toBe('RATE_LIMIT');
    expect(err.statusCode).toBe(429);
  });

  test('retryAfter stored in details', () => {
    const err = new RateLimitError('Too many requests', { retryAfter: 30 });
    expect(err.details?.retryAfter).toBe(30);
  });
});

describe('UnauthorizedError', () => {
  test('status 401, code UNAUTHORIZED', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });
});

describe('ForbiddenError', () => {
  test('status 403, code FORBIDDEN', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });
});

describe('TimeoutError', () => {
  test('status 408, code TIMEOUT_ERROR', () => {
    const err = new TimeoutError('Too slow', 5000);
    expect(err.statusCode).toBe(408);
    expect(err.code).toBe('TIMEOUT_ERROR');
    expect(err.details?.timeoutMs).toBe(5000);
  });

  test('optional fields stored', () => {
    const err = new TimeoutError('DB timeout', 3000, 'db.query', true);
    expect(err.details?.operation).toBe('db.query');
    expect(err.details?.retryable).toBe(true);
  });
});

describe('ExternalServiceError', () => {
  test('status 503, code EXTERNAL_SERVICE_ERROR', () => {
    const err = new ExternalServiceError('Stripe down', 'stripe');
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe('EXTERNAL_SERVICE_ERROR');
    expect(err.details?.service).toBe('stripe');
  });

  test('full detail set stored', () => {
    const err = new ExternalServiceError('Timeout', 'sendgrid', 'sendEmail', 'CONN_RESET', 'Connection reset', true, 60);
    expect(err.details?.operation).toBe('sendEmail');
    expect(err.details?.externalCode).toBe('CONN_RESET');
    expect(err.details?.retryable).toBe(true);
    expect(err.details?.retryAfter).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// createErrorHandler — returned handler behaviour
// ---------------------------------------------------------------------------

describe('createErrorHandler', () => {
  const devConfig = makeConfig({ level: 'debug' });
  const prodConfig = makeConfig({ level: 'info' });

  test('handler is a function', () => {
    expect(typeof createErrorHandler(devConfig)).toBe('function');
  });

  // ---- AppError → proper JSON response ----

  test('AppError → status + JSON body with code/message', async () => {
    const handler = createErrorHandler(devConfig);
    const ctx = await makeContext();
    const resp = handler(new ValidationError('email missing'), ctx);
    expect(resp.status).toBe(400);
    const body = await resp.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('email missing');
  });

  test('NotFoundError → 404 with resourceType in body', async () => {
    const handler = createErrorHandler(devConfig);
    const ctx = await makeContext();
    const resp = handler(new NotFoundError('Not found', { resourceType: 'Booking', resource: '99' }), ctx);
    expect(resp.status).toBe(404);
    const body = await resp.json() as any;
    expect(body.code).toBe('NOT_FOUND');
    expect(body.resourceType).toBe('Booking');
    expect(body.resource).toBe('99');
  });

  test('RateLimitError → 429 with Retry-After header', async () => {
    const handler = createErrorHandler(devConfig);
    const ctx = await makeContext();
    const resp = handler(new RateLimitError('Slow down', { retryAfter: 45 }), ctx);
    expect(resp.status).toBe(429);
    expect(resp.headers.get('Retry-After')).toBe('45');
    const body = await resp.json() as any;
    expect(body.code).toBe('RATE_LIMIT');
  });

  test('AuthenticationError → 401 with scheme details', async () => {
    const handler = createErrorHandler(devConfig);
    const ctx = await makeContext();
    const resp = handler(new AuthenticationError('Token expired', 'Bearer', ['Bearer']), ctx);
    expect(resp.status).toBe(401);
    const body = await resp.json() as any;
    expect(body.scheme).toBe('Bearer');
    expect(body.supportedSchemes).toEqual(['Bearer']);
  });

  test('AuthorizationError → 403 with permission fields', async () => {
    const handler = createErrorHandler(devConfig);
    const ctx = await makeContext();
    const resp = handler(new AuthorizationError('No access', 'admin', ['user'], '/admin'), ctx);
    expect(resp.status).toBe(403);
    const body = await resp.json() as any;
    expect(body.requiredPermission).toBe('admin');
    expect(body.resource).toBe('/admin');
  });

  test('TimeoutError → 408 with timeoutMs', async () => {
    const handler = createErrorHandler(devConfig);
    const ctx = await makeContext();
    const resp = handler(new TimeoutError('Timed out', 2000, 'db.query', true), ctx);
    expect(resp.status).toBe(408);
    const body = await resp.json() as any;
    expect(body.timeoutMs).toBe(2000);
    expect(body.operation).toBe('db.query');
    expect(body.retryable).toBe(true);
  });

  test('ExternalServiceError → 503 with service field', async () => {
    const handler = createErrorHandler(devConfig);
    const ctx = await makeContext();
    const resp = handler(new ExternalServiceError('S3 down', 's3', 'upload', undefined, undefined, true, 30), ctx);
    expect(resp.status).toBe(503);
    expect(resp.headers.get('Retry-After')).toBe('30');
    const body = await resp.json() as any;
    expect(body.service).toBe('s3');
    expect(body.retryable).toBe(true);
  });

  test('ConflictError → 409', async () => {
    const handler = createErrorHandler(devConfig);
    const ctx = await makeContext();
    const resp = handler(new ConflictError('Duplicate email'), ctx);
    expect(resp.status).toBe(409);
    const body = await resp.json() as any;
    expect(body.code).toBe('CONFLICT');
  });

  // ---- ZodError → formatted validation errors ----

  test('ZodError with field errors → 400 with fieldErrors array', async () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    let zodErr!: ZodError;
    try { schema.parse({ name: 123, age: 'bad' }); } catch (e) { zodErr = e as ZodError; }

    const handler = createErrorHandler(devConfig);
    const ctx = await makeContext();
    const resp = handler(zodErr, ctx);
    expect(resp.status).toBe(400);
    const body = await resp.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(body.fieldErrors)).toBe(true);
    expect(body.fieldErrors.length).toBeGreaterThan(0);
    const nameError = body.fieldErrors.find((fe: any) => fe.field === 'name');
    expect(nameError).toBeDefined();
  });

  test('ZodError with global (root) errors → 400 with globalErrors', async () => {
    const schema = z.object({}).refine(() => false, { message: 'Global constraint violated' });
    let zodErr!: ZodError;
    try { schema.parse({}); } catch (e) { zodErr = e as ZodError; }

    const handler = createErrorHandler(devConfig);
    const ctx = await makeContext();
    const resp = handler(zodErr, ctx);
    expect(resp.status).toBe(400);
    const body = await resp.json() as any;
    expect(Array.isArray(body.globalErrors)).toBe(true);
    expect(body.globalErrors[0]).toContain('Global constraint violated');
  });

  // ---- HTTPException → forwarded status/message ----

  test('HTTPException → status forwarded, JSON body', async () => {
    const handler = createErrorHandler(devConfig);
    const ctx = await makeContext();
    const exc = new HTTPException(418, { message: "I'm a teapot" });
    const resp = handler(exc, ctx);
    expect(resp.status).toBe(418);
    const body = await resp.json() as any;
    expect(body.message).toBe("I'm a teapot");
  });

  test('HTTPException 401 → 401 status', async () => {
    const handler = createErrorHandler(devConfig);
    const ctx = await makeContext();
    const resp = handler(new HTTPException(401, { message: 'No auth' }), ctx);
    expect(resp.status).toBe(401);
  });

  // ---- Unknown error → 500 ----

  test('unknown Error → 500', async () => {
    const handler = createErrorHandler(devConfig);
    const ctx = await makeContext();
    const resp = handler(new Error('Something completely unexpected'), ctx);
    expect(resp.status).toBe(500);
    const body = await resp.json() as any;
    expect(body.code).toBe('INTERNAL_SERVER_ERROR');
  });

  test('unknown error in debug config exposes the original message', async () => {
    const handler = createErrorHandler(devConfig); // level = debug
    const ctx = await makeContext();
    const resp = handler(new Error('secret internal detail'), ctx);
    const body = await resp.json() as any;
    expect(body.message).toBe('secret internal detail');
  });

  test('unknown error in production config redacts the message', async () => {
    const origEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      const handler = createErrorHandler(prodConfig); // level = info, not debug
      const ctx = await makeContext();
      const resp = handler(new Error('secret internal detail'), ctx);
      expect(resp.status).toBe(500);
      const body = await resp.json() as any;
      // In production + non-debug, message is redacted to generic string
      expect(body.message).toBe('Internal server error');
    } finally {
      if (origEnv === undefined) delete process.env['NODE_ENV'];
      else process.env['NODE_ENV'] = origEnv;
    }
  });

  // ---- Response shape — shared fields ----

  test('all AppError responses include requestId and timestamp', async () => {
    const handler = createErrorHandler(devConfig);
    const ctx = await makeContext();
    const resp = handler(new ValidationError(), ctx);
    const body = await resp.json() as any;
    expect(typeof body.requestId).toBe('string');
    expect(body.requestId.length).toBeGreaterThan(0);
    expect(typeof body.timestamp).toBe('string');
    // ISO timestamp sanity check
    expect(() => new Date(body.timestamp)).not.toThrow();
  });

  test('unknown error response includes trackingId', async () => {
    const handler = createErrorHandler(devConfig);
    const ctx = await makeContext();
    const resp = handler(new Error('oops'), ctx);
    const body = await resp.json() as any;
    expect(typeof body.trackingId).toBe('string');
    expect(body.reported).toBe(true);
  });

  // ---- Production security filtering ----

  test('production mode omits path and method from response', async () => {
    const origEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      const handler = createErrorHandler(prodConfig);
      const ctx = await makeContext('GET', '/sensitive-path');
      const resp = handler(new NotFoundError('gone'), ctx);
      const body = await resp.json() as any;
      expect(body.path).toBeUndefined();
      expect(body.method).toBeUndefined();
    } finally {
      if (origEnv === undefined) delete process.env['NODE_ENV'];
      else process.env['NODE_ENV'] = origEnv;
    }
  });

  test('development mode includes path and method in response', async () => {
    const origEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'development';
    try {
      const handler = createErrorHandler(devConfig);
      const ctx = await makeContext('DELETE', '/my-resource');
      const resp = handler(new NotFoundError('not here'), ctx);
      const body = await resp.json() as any;
      expect(body.path).toBe('/my-resource');
      expect(body.method).toBe('DELETE');
    } finally {
      if (origEnv === undefined) delete process.env['NODE_ENV'];
      else process.env['NODE_ENV'] = origEnv;
    }
  });

  // ---- Postgres encoding error ----

  test('error with pgCode 22021 → 400 VALIDATION_ERROR', async () => {
    const handler = createErrorHandler(devConfig);
    const ctx = await makeContext();
    const dbErr = Object.assign(new Error('invalid byte sequence'), { code: '22021' });
    const resp = handler(dbErr, ctx);
    expect(resp.status).toBe(400);
    const body = await resp.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.message).toContain('invalid byte sequence');
  });

  // ---- Error with statusCode property (non-AppError) ----

  test('plain error with statusCode property → that status is used', async () => {
    const handler = createErrorHandler(devConfig);
    const ctx = await makeContext();
    const err = Object.assign(new Error('custom status'), { statusCode: 422 });
    const resp = handler(err, ctx);
    expect(resp.status).toBe(422);
    const body = await resp.json() as any;
    expect(body.message).toBe('custom status');
  });
});
