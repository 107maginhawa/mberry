/**
 * Tests for security middleware factories
 * Validates CORS configuration wiring and security header middleware construction.
 *
 * NOTE: createSecurityHeaders delegates entirely to Hono's built-in secureHeaders().
 * We verify it returns a function (middleware) and does not throw during construction.
 * Actual header values are set by Hono internals and verified in integration tests.
 *
 * createCorsMiddleware is a thin wrapper around cors() + createOriginValidator.
 * We test the observable surface: it returns a function, respects credentials,
 * and logs when a logger is supplied.
 */

import { describe, it, expect, mock } from 'bun:test';
import { createSecurityHeaders, createCorsMiddleware } from '@/middleware/security';
import type { Config } from '@/core/config';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/** Minimal CORS config slice */
function makeCorsConfig(overrides: Partial<Config['cors']> = {}): Config['cors'] {
  return {
    origins: ['https://app.example.com'],
    credentials: true,
    allowLocalNetwork: false,
    allowTunneling: false,
    strict: false,
    ...overrides,
  };
}

/** Minimal full Config shape — only the slices used by security middleware */
function makeConfig(corsOverrides: Partial<Config['cors']> = {}): Config {
  return {
    cors: makeCorsConfig(corsOverrides),
    // Other Config keys the middleware does not read — satisfy the type
  } as unknown as Config;
}

/** Minimal logger spy */
function makeLogger() {
  return {
    debug: mock((..._args: any[]) => {}),
    info:  mock((..._args: any[]) => {}),
    warn:  mock((..._args: any[]) => {}),
    error: mock((..._args: any[]) => {}),
  };
}

// ---------------------------------------------------------------------------
// createSecurityHeaders
// ---------------------------------------------------------------------------

describe('createSecurityHeaders', () => {
  it('returns a function (middleware)', () => {
    const mw = createSecurityHeaders(makeConfig());
    expect(typeof mw).toBe('function');
  });

  it('does not throw during construction with a minimal config', () => {
    expect(() => createSecurityHeaders(makeConfig())).not.toThrow();
  });

  it('returns a new middleware instance on every call', () => {
    const config = makeConfig();
    const mw1 = createSecurityHeaders(config);
    const mw2 = createSecurityHeaders(config);
    // Each call should produce a fresh middleware reference
    expect(mw1).not.toBe(mw2);
  });
});

// ---------------------------------------------------------------------------
// createCorsMiddleware
// ---------------------------------------------------------------------------

describe('createCorsMiddleware', () => {
  it('returns a function (middleware)', () => {
    const mw = createCorsMiddleware(makeConfig());
    expect(typeof mw).toBe('function');
  });

  it('does not throw during construction', () => {
    expect(() => createCorsMiddleware(makeConfig())).not.toThrow();
  });

  it('does not throw when logger is provided', () => {
    const logger = makeLogger();
    expect(() => createCorsMiddleware(makeConfig(), logger as any)).not.toThrow();
  });

  it('calls logger.debug once with CORS settings when logger is provided', () => {
    const logger = makeLogger();
    createCorsMiddleware(makeConfig(), logger as any);
    expect(logger.debug).toHaveBeenCalledTimes(1);
  });

  it('does not call logger when no logger argument is given', () => {
    // No logger → no debug call — we simply confirm construction succeeds silently
    expect(() => createCorsMiddleware(makeConfig())).not.toThrow();
  });

  it('passes credentials setting from config into CORS (debug log contains it)', () => {
    const logger = makeLogger();
    const config = makeConfig();
    config.cors.credentials = false;

    createCorsMiddleware(config, logger as any);

    const [, meta] = logger.debug.mock.calls[0] as [string, string];
    // The logger is called as logger.debug(dataObject, message)
    // so the first argument is the data object
    const dataArg = logger.debug.mock.calls[0][0] as any;
    expect(dataArg).toHaveProperty('credentials', false);
  });

  it('includes allowMethods in the debug log', () => {
    const logger = makeLogger();
    createCorsMiddleware(makeConfig(), logger as any);

    const dataArg = logger.debug.mock.calls[0][0] as any;
    expect(dataArg).toHaveProperty('allowMethods');
    expect(Array.isArray(dataArg.allowMethods)).toBe(true);
    expect(dataArg.allowMethods).toContain('GET');
    expect(dataArg.allowMethods).toContain('POST');
    expect(dataArg.allowMethods).toContain('OPTIONS');
  });

  it('includes allowHeaders in the debug log', () => {
    const logger = makeLogger();
    createCorsMiddleware(makeConfig(), logger as any);

    const dataArg = logger.debug.mock.calls[0][0] as any;
    expect(dataArg).toHaveProperty('allowHeaders');
    expect(Array.isArray(dataArg.allowHeaders)).toBe(true);
    expect(dataArg.allowHeaders).toContain('Authorization');
    expect(dataArg.allowHeaders).toContain('Content-Type');
  });

  it('reflects corsSettings flags from config in the debug log', () => {
    const logger = makeLogger();
    const config = makeConfig({
      allowLocalNetwork: true,
      allowTunneling: true,
      strict: false,
      origins: ['https://example.com'],
    });

    createCorsMiddleware(config, logger as any);

    const dataArg = logger.debug.mock.calls[0][0] as any;
    expect(dataArg.corsSettings).toMatchObject({
      allowLocalNetwork: true,
      allowTunneling: true,
      strict: false,
      explicitOrigins: ['https://example.com'],
    });
  });

  it('returns a distinct middleware instance on each call', () => {
    const config = makeConfig();
    const mw1 = createCorsMiddleware(config);
    const mw2 = createCorsMiddleware(config);
    expect(mw1).not.toBe(mw2);
  });
});
