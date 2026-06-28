/**
 * Tests for config.ts — parseConfig() and its internal helper functions.
 *
 * Because the helpers (parseList, parseBool, parseIntValue, parseLogLevel) are
 * closures inside parseConfig(), we exercise them indirectly by setting env
 * vars before each call and restoring them afterwards.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  parseConfig,
  getInviteTokenSecret,
  getUnsubscribeSecret,
  getPaymongoConfig,
} from './config';
// Factory N/A: core infrastructure test — config/setup/service assertions, no domain entities

// ---------------------------------------------------------------------------
// Helpers for isolated env-var manipulation
// ---------------------------------------------------------------------------

type EnvSnapshot = Record<string, string | undefined>;

/** Capture current values of the given keys so we can restore them later. */
function snapshotEnv(keys: string[]): EnvSnapshot {
  const snap: EnvSnapshot = {};
  for (const k of keys) snap[k] = process.env[k];
  return snap;
}

/** Restore previously captured env values. */
function restoreEnv(snap: EnvSnapshot) {
  for (const [k, v] of Object.entries(snap)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

/** Set a group of env vars and return a cleanup function. */
function withEnv(vars: Record<string, string | undefined>): () => void {
  const snap = snapshotEnv(Object.keys(vars));
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return () => restoreEnv(snap);
}

// ---------------------------------------------------------------------------
// parseList (exercised via cors.origins / auth.adminEmails)
// ---------------------------------------------------------------------------

describe('parseList — via CORS_ORIGINS', () => {
  test('parses comma-separated origins', () => {
    const restore = withEnv({ CORS_ORIGINS: 'https://a.com,https://b.com,https://c.com' });
    try {
      const cfg = parseConfig();
      expect(cfg.cors.origins).toEqual(['https://a.com', 'https://b.com', 'https://c.com']);
    } finally {
      restore();
    }
  });

  test('trims whitespace around entries', () => {
    const restore = withEnv({ CORS_ORIGINS: ' https://a.com , https://b.com ' });
    try {
      const cfg = parseConfig();
      expect(cfg.cors.origins).toEqual(['https://a.com', 'https://b.com']);
    } finally {
      restore();
    }
  });

  test('empty string returns default dev origins', () => {
    const restore = withEnv({ CORS_ORIGINS: '' });
    try {
      const cfg = parseConfig();
      expect(cfg.cors.origins).toEqual(['http://localhost:3003', 'http://localhost:3004', 'http://localhost:3005', 'http://localhost:3006']);
    } finally {
      restore();
    }
  });

  test('undefined returns default dev origins', () => {
    const restore = withEnv({ CORS_ORIGINS: undefined });
    try {
      const cfg = parseConfig();
      expect(cfg.cors.origins).toEqual(['http://localhost:3003', 'http://localhost:3004', 'http://localhost:3005', 'http://localhost:3006']);
    } finally {
      restore();
    }
  });

  test('single value list is still an array', () => {
    const restore = withEnv({ CORS_ORIGINS: 'https://only.com' });
    try {
      const cfg = parseConfig();
      expect(cfg.cors.origins).toEqual(['https://only.com']);
    } finally {
      restore();
    }
  });

  test('admin emails defaults to empty array when undefined', () => {
    const restore = withEnv({ AUTH_ADMIN_EMAILS: undefined });
    try {
      const cfg = parseConfig();
      expect(cfg.auth.adminEmails).toEqual([]);
    } finally {
      restore();
    }
  });

  test('admin emails parses multiple entries', () => {
    const restore = withEnv({ AUTH_ADMIN_EMAILS: 'alice@test.com,bob@test.com' });
    try {
      const cfg = parseConfig();
      expect(cfg.auth.adminEmails).toEqual(['alice@test.com', 'bob@test.com']);
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// parseBool (exercised via CORS_CREDENTIALS, DB_SSL, LOG_PRETTY, etc.)
// ---------------------------------------------------------------------------

describe('parseBool — via various boolean env vars', () => {
  test('"true" string evaluates to true', () => {
    const restore = withEnv({ DB_SSL: 'true' });
    try {
      expect(parseConfig().database.ssl).toBe(true);
    } finally {
      restore();
    }
  });

  test('"false" string evaluates to false', () => {
    const restore = withEnv({ CORS_CREDENTIALS: 'false' });
    try {
      expect(parseConfig().cors.credentials).toBe(false);
    } finally {
      restore();
    }
  });

  test('case-insensitive "TRUE" evaluates to true', () => {
    const restore = withEnv({ DB_SSL: 'TRUE' });
    try {
      expect(parseConfig().database.ssl).toBe(true);
    } finally {
      restore();
    }
  });

  test('undefined returns the declared default (false for DB_SSL)', () => {
    const restore = withEnv({ DB_SSL: undefined });
    try {
      expect(parseConfig().database.ssl).toBe(false);
    } finally {
      restore();
    }
  });

  test('undefined returns the declared default (true for CORS_CREDENTIALS)', () => {
    const restore = withEnv({ CORS_CREDENTIALS: undefined });
    try {
      expect(parseConfig().cors.credentials).toBe(true);
    } finally {
      restore();
    }
  });

  test('arbitrary non-"true" string evaluates to false', () => {
    const restore = withEnv({ DB_SSL: 'yes' });
    try {
      expect(parseConfig().database.ssl).toBe(false);
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// parseIntValue (exercised via PORT, DB_POOL_MIN, DB_POOL_MAX, etc.)
// ---------------------------------------------------------------------------

describe('parseIntValue — via PORT / DB_POOL_MIN', () => {
  test('valid integer string is parsed correctly', () => {
    const restore = withEnv({ PORT: '8080', SERVER_PORT: undefined });
    try {
      expect(parseConfig().server.port).toBe(8080);
    } finally {
      restore();
    }
  });

  test('NaN string falls back to default (7213 for PORT)', () => {
    const restore = withEnv({ PORT: 'abc', SERVER_PORT: undefined });
    try {
      expect(parseConfig().server.port).toBe(7213);
    } finally {
      restore();
    }
  });

  test('undefined falls back to default (7213 for PORT)', () => {
    const restore = withEnv({ PORT: undefined, SERVER_PORT: undefined });
    try {
      expect(parseConfig().server.port).toBe(7213);
    } finally {
      restore();
    }
  });

  test('DB_POOL_MIN parses valid integer', () => {
    const restore = withEnv({ DB_POOL_MIN: '5' });
    try {
      expect(parseConfig().database.poolMin).toBe(5);
    } finally {
      restore();
    }
  });

  test('DB_POOL_MAX falls back to default (20) when NaN', () => {
    const restore = withEnv({ DB_POOL_MAX: 'lots' });
    try {
      expect(parseConfig().database.poolMax).toBe(20);
    } finally {
      restore();
    }
  });

  test('SERVER_PORT takes priority over PORT', () => {
    const restore = withEnv({ SERVER_PORT: '9000', PORT: '8080' });
    try {
      expect(parseConfig().server.port).toBe(9000);
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// parseLogLevel (exercised via LOG_LEVEL)
// ---------------------------------------------------------------------------

describe('parseLogLevel — via LOG_LEVEL', () => {
  const validLevels = ['debug', 'info', 'warn', 'error'] as const;

  for (const level of validLevels) {
    test(`"${level}" is accepted`, () => {
      const restore = withEnv({ LOG_LEVEL: level });
      try {
        expect(parseConfig().logging.level).toBe(level);
      } finally {
        restore();
      }
    });

    test(`"${level.toUpperCase()}" is accepted (case-insensitive)`, () => {
      const restore = withEnv({ LOG_LEVEL: level.toUpperCase() });
      try {
        expect(parseConfig().logging.level).toBe(level);
      } finally {
        restore();
      }
    });
  }

  test('invalid level falls back to "info"', () => {
    const restore = withEnv({ LOG_LEVEL: 'verbose' });
    try {
      expect(parseConfig().logging.level).toBe('info');
    } finally {
      restore();
    }
  });

  test('empty string falls back to "info"', () => {
    const restore = withEnv({ LOG_LEVEL: '' });
    try {
      expect(parseConfig().logging.level).toBe('info');
    } finally {
      restore();
    }
  });

  test('undefined falls back to "info"', () => {
    const restore = withEnv({ LOG_LEVEL: undefined });
    try {
      expect(parseConfig().logging.level).toBe('info');
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// Config object structure — default values when env vars are absent
// ---------------------------------------------------------------------------

describe('parseConfig — default values (clean environment)', () => {
  // Keys we clear for the "defaults" suite
  const KEYS_TO_CLEAR = [
    'SERVER_PORT', 'PORT', 'SERVER_HOST', 'SERVER_PUBLIC_URL', 'PUBLIC_URL',
    'DATABASE_URL', 'DB_POOL_MIN', 'DB_POOL_MAX', 'DB_IDLE_TIMEOUT', 'DB_SSL', 'DB_LOGGING',
    'CORS_ORIGINS', 'CORS_CREDENTIALS', 'CORS_ALLOW_LOCAL_NETWORK', 'CORS_ALLOW_TUNNELING', 'CORS_STRICT',
    'LOG_LEVEL', 'LOG_PRETTY',
    'RATE_LIMIT_ENABLED', 'RATE_LIMIT_MAX',
    'STORAGE_PROVIDER', 'STORAGE_ENDPOINT', 'STORAGE_PUBLIC_ENDPOINT',
    'STORAGE_BUCKET', 'STORAGE_REGION', 'STORAGE_ACCESS_KEY_ID', 'STORAGE_SECRET_ACCESS_KEY',
    'AUTH_SESSION_EXPIRES_IN', 'AUTH_RATE_LIMIT_ENABLED', 'AUTH_RATE_LIMIT_WINDOW', 'AUTH_RATE_LIMIT_MAX',
    'AUTH_ADMIN_EMAILS', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
    'ONESIGNAL_APP_ID', 'ONESIGNAL_API_KEY',
    'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_URL',
    'WEBRTC_ICE_SERVERS',
    'AUTH_BASE_URL', 'AUTH_SECRET',
  ];

  let restore: () => void;
  let cfg: ReturnType<typeof parseConfig>;

  beforeEach(() => {
    restore = withEnv(Object.fromEntries(KEYS_TO_CLEAR.map(k => [k, undefined])));
    // AUTH_SECRET is now required in all environments — set a test value
    process.env['AUTH_SECRET'] = 'test-secret-for-defaults-suite';
    cfg = parseConfig();
  });

  afterEach(() => restore());

  test('server.port defaults to 7213', () => {
    expect(cfg.server.port).toBe(7213);
  });

  test('server.host defaults to "0.0.0.0"', () => {
    expect(cfg.server.host).toBe('0.0.0.0');
  });

  test('server.publicUrl defaults to undefined', () => {
    expect(cfg.server.publicUrl).toBeUndefined();
  });

  test('database.url has a default postgres URL', () => {
    expect(cfg.database.url).toContain('postgres://');
  });

  test('database.poolMin defaults to 2', () => {
    expect(cfg.database.poolMin).toBe(2);
  });

  test('database.poolMax defaults to 20', () => {
    expect(cfg.database.poolMax).toBe(20);
  });

  test('database.ssl defaults to false', () => {
    expect(cfg.database.ssl).toBe(false);
  });

  test('cors.origins defaults to explicit dev origins (not wildcard)', () => {
    expect(cfg.cors.origins).toEqual(['http://localhost:3003', 'http://localhost:3004', 'http://localhost:3005', 'http://localhost:3006']);
  });

  test('cors.credentials defaults to true', () => {
    expect(cfg.cors.credentials).toBe(true);
  });

  test('cors.strict defaults to false', () => {
    expect(cfg.cors.strict).toBe(false);
  });

  test('logging.level defaults to "info"', () => {
    expect(cfg.logging.level).toBe('info');
  });

  test('logging.pretty defaults to true', () => {
    expect(cfg.logging.pretty).toBe(true);
  });

  test('rateLimit.enabled defaults to true', () => {
    expect(cfg.rateLimit.enabled).toBe(true);
  });

  test('rateLimit.max defaults to 100', () => {
    expect(cfg.rateLimit.max).toBe(100);
  });

  test('storage.provider defaults to "minio"', () => {
    expect(cfg.storage.provider).toBe('minio');
  });

  test('storage.bucket defaults to "monobase-files"', () => {
    expect(cfg.storage.bucket).toBe('monobase-files');
  });

  test('email.provider defaults to "smtp"', () => {
    expect(cfg.email.provider).toBe('smtp');
  });

  test('notifs.provider is "onesignal"', () => {
    expect(cfg.notifs.provider).toBe('onesignal');
  });

  test('notifs.onesignal is undefined when env vars absent', () => {
    expect(cfg.notifs.onesignal).toBeUndefined();
  });

  test('billing.provider is "stripe"', () => {
    expect(cfg.billing.provider).toBe('stripe');
  });

  test('webrtc.iceServers falls back to DEFAULT_ICE_SERVERS', () => {
    expect(Array.isArray(cfg.webrtc.iceServers)).toBe(true);
    expect(cfg.webrtc.iceServers.length).toBeGreaterThan(0);
    expect(cfg.webrtc.iceServers[0].urls).toContain('stun:');
  });

  test('auth.adminEmails defaults to []', () => {
    expect(cfg.auth.adminEmails).toEqual([]);
  });

  test('auth.socialProviders.google is undefined without credentials', () => {
    expect(cfg.auth.socialProviders?.google).toBeUndefined();
  });

  test('auth.sessionExpiresIn defaults to 24 hours in seconds (P0-2 mitigation)', () => {
    expect(cfg.auth.sessionExpiresIn).toBe(60 * 60 * 24);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  test('PORT=abc falls back to default port 7213', () => {
    const restore = withEnv({ PORT: 'abc', SERVER_PORT: undefined });
    try {
      expect(parseConfig().server.port).toBe(7213);
    } finally {
      restore();
    }
  });

  test('empty DATABASE_URL uses built-in default', () => {
    const restore = withEnv({ DATABASE_URL: '' });
    try {
      // falsy empty string → default is used
      expect(parseConfig().database.url).toContain('localhost');
    } finally {
      restore();
    }
  });

  test('CORS_ORIGINS with only commas/spaces filters to an empty array (value is non-empty string so no fallback)', () => {
    // parseList receives ' , , ' — a non-empty string, so it does NOT use the default.
    // After split → trim → filter(Boolean) all entries are removed → result is [].
    const restore = withEnv({ CORS_ORIGINS: ' , , ' });
    try {
      expect(parseConfig().cors.origins).toEqual([]);
    } finally {
      restore();
    }
  });

  test('ONESIGNAL credentials present → notifs.onesignal is populated', () => {
    const restore = withEnv({ ONESIGNAL_APP_ID: 'app-id-123', ONESIGNAL_API_KEY: 'api-key-abc' });
    try {
      const cfg = parseConfig();
      expect(cfg.notifs.onesignal).toBeDefined();
      expect(cfg.notifs.onesignal?.appId).toBe('app-id-123');
      expect(cfg.notifs.onesignal?.apiKey).toBe('api-key-abc');
    } finally {
      restore();
    }
  });

  test('GOOGLE credentials present → auth.socialProviders.google is populated', () => {
    const restore = withEnv({ GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsec' });
    try {
      const cfg = parseConfig();
      expect(cfg.auth.socialProviders?.google).toBeDefined();
      expect(cfg.auth.socialProviders?.google?.clientId).toBe('gid');
    } finally {
      restore();
    }
  });

  test('only GOOGLE_CLIENT_ID (no secret) → google is undefined', () => {
    const restore = withEnv({ GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: undefined });
    try {
      expect(parseConfig().auth.socialProviders?.google).toBeUndefined();
    } finally {
      restore();
    }
  });

  test('WEBRTC_ICE_SERVERS env var overrides defaults', () => {
    const restore = withEnv({ WEBRTC_ICE_SERVERS: 'stun:custom.stun.example.com:3478' });
    try {
      const cfg = parseConfig();
      expect(cfg.webrtc.iceServers).toHaveLength(1);
      expect((cfg.webrtc.iceServers[0].urls as string)).toContain('custom.stun.example.com');
    } finally {
      restore();
    }
  });

  test('SERVER_PUBLIC_URL populates server.publicUrl', () => {
    const restore = withEnv({ SERVER_PUBLIC_URL: 'https://api.example.com', PUBLIC_URL: undefined });
    try {
      expect(parseConfig().server.publicUrl).toBe('https://api.example.com');
    } finally {
      restore();
    }
  });

  test('PUBLIC_URL is used as fallback for server.publicUrl', () => {
    const restore = withEnv({ SERVER_PUBLIC_URL: undefined, PUBLIC_URL: 'https://fallback.example.com' });
    try {
      expect(parseConfig().server.publicUrl).toBe('https://fallback.example.com');
    } finally {
      restore();
    }
  });

  test('POSTMARK_API_KEY present → email.postmark is populated', () => {
    const restore = withEnv({ POSTMARK_API_KEY: 'pm-key-xyz' });
    try {
      const cfg = parseConfig();
      expect(cfg.email.postmark).toBeDefined();
      expect(cfg.email.postmark?.apiKey).toBe('pm-key-xyz');
      expect(cfg.email.postmark?.messageStream).toBe('outbound');
    } finally {
      restore();
    }
  });

  test('AUTH_BASE_URL overrides computed auth baseUrl', () => {
    const restore = withEnv({ AUTH_BASE_URL: 'https://auth.example.com' });
    try {
      expect(parseConfig().auth.baseUrl).toBe('https://auth.example.com');
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// Production startup validation (5.2)
// ---------------------------------------------------------------------------

describe('production config validation — fail fast on missing vars', () => {
  test('throws when AUTH_SECRET missing in production', () => {
    const restore = withEnv({
      NODE_ENV: 'production',
      AUTH_SECRET: undefined,
      DATABASE_URL: 'postgres://prod:5432/db',
      INTERNAL_SERVICE_TOKEN: 'tok',
      INVITE_TOKEN_SECRET: 'invite-tok',
    });
    try {
      expect(() => parseConfig()).toThrow('AUTH_SECRET');
    } finally {
      restore();
    }
  });

  test('throws when DATABASE_URL missing in production', () => {
    const restore = withEnv({
      NODE_ENV: 'production',
      AUTH_SECRET: 'secret',
      DATABASE_URL: undefined,
      INTERNAL_SERVICE_TOKEN: 'tok',
      INVITE_TOKEN_SECRET: 'invite-tok',
    });
    try {
      expect(() => parseConfig()).toThrow('DATABASE_URL');
    } finally {
      restore();
    }
  });

  test('throws when INTERNAL_SERVICE_TOKEN missing in production', () => {
    const restore = withEnv({
      NODE_ENV: 'production',
      AUTH_SECRET: 'secret',
      DATABASE_URL: 'postgres://prod:5432/db',
      INTERNAL_SERVICE_TOKEN: undefined,
      INVITE_TOKEN_SECRET: 'invite-tok',
    });
    try {
      expect(() => parseConfig()).toThrow('INTERNAL_SERVICE_TOKEN');
    } finally {
      restore();
    }
  });

  test('throws with ALL missing vars listed in one error', () => {
    const restore = withEnv({
      NODE_ENV: 'production',
      AUTH_SECRET: undefined,
      DATABASE_URL: undefined,
      INTERNAL_SERVICE_TOKEN: undefined,
      INVITE_TOKEN_SECRET: undefined,
    });
    try {
      expect(() => parseConfig()).toThrow(
        /AUTH_SECRET.*DATABASE_URL.*INTERNAL_SERVICE_TOKEN.*INVITE_TOKEN_SECRET/,
      );
    } finally {
      restore();
    }
  });

  test('succeeds when all required vars present in production', () => {
    const restore = withEnv({
      NODE_ENV: 'production',
      AUTH_SECRET: 'prod-secret',
      DATABASE_URL: 'postgres://prod:5432/db',
      INTERNAL_SERVICE_TOKEN: 'service-tok',
      INVITE_TOKEN_SECRET: 'service-invite-secret',
      UNSUBSCRIBE_SECRET: 'service-unsub-secret',
      CORS_ORIGINS: 'https://app.example.com',
      STORAGE_ACCESS_KEY_ID: 'real-key',
      STORAGE_SECRET_ACCESS_KEY: 'real-secret',
      // P0-3: a valid prod config has tunnel/local-network CORS disabled.
      CORS_ALLOW_TUNNELING: undefined,
      CORS_ALLOW_LOCAL_NETWORK: undefined,
    });
    try {
      const cfg = parseConfig();
      expect(cfg.auth.secret).toBe('prod-secret');
      expect(cfg.database.url).toBe('postgres://prod:5432/db');
    } finally {
      restore();
    }
  });

  test('throws in development when AUTH_SECRET missing (no hardcoded fallback)', () => {
    const restore = withEnv({
      NODE_ENV: 'development',
      AUTH_SECRET: undefined,
      DATABASE_URL: undefined,
      INTERNAL_SERVICE_TOKEN: undefined,
    });
    try {
      expect(() => parseConfig()).toThrow('AUTH_SECRET');
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// INVITE_TOKEN_SECRET production validation (FIX-010 / Batch E)
//
// The invite + payment token signing secret falls back to a predictable dev
// default in the invite handlers. In a misconfigured production that makes
// invite tokens forgeable. The server must refuse to boot in production when
// INVITE_TOKEN_SECRET is unset OR still equals the insecure dev default.
// Dev/test keep the fallback (handlers retain it).
// ---------------------------------------------------------------------------

describe('INVITE_TOKEN_SECRET production validation (FIX-010)', () => {
  const INVITE_TOKEN_DEV_DEFAULT = 'dev-secret-change-in-production';

  test('throws when INVITE_TOKEN_SECRET is unset in production', () => {
    const restore = withEnv({
      NODE_ENV: 'production',
      AUTH_SECRET: 'prod-secret',
      DATABASE_URL: 'postgres://prod:5432/db',
      INTERNAL_SERVICE_TOKEN: 'service-tok',
      INVITE_TOKEN_SECRET: undefined,
    });
    try {
      expect(() => parseConfig()).toThrow('INVITE_TOKEN_SECRET');
    } finally {
      restore();
    }
  });

  test('throws when INVITE_TOKEN_SECRET equals the insecure dev default in production', () => {
    const restore = withEnv({
      NODE_ENV: 'production',
      AUTH_SECRET: 'prod-secret',
      DATABASE_URL: 'postgres://prod:5432/db',
      INTERNAL_SERVICE_TOKEN: 'service-tok',
      INVITE_TOKEN_SECRET: INVITE_TOKEN_DEV_DEFAULT,
    });
    try {
      expect(() => parseConfig()).toThrow('INVITE_TOKEN_SECRET');
    } finally {
      restore();
    }
  });

  test('succeeds in production with a real INVITE_TOKEN_SECRET', () => {
    const restore = withEnv({
      NODE_ENV: 'production',
      AUTH_SECRET: 'prod-secret',
      DATABASE_URL: 'postgres://prod:5432/db',
      INTERNAL_SERVICE_TOKEN: 'service-tok',
      INVITE_TOKEN_SECRET: 'a-real-strong-prod-invite-secret',
      UNSUBSCRIBE_SECRET: 'a-real-strong-prod-unsub-secret',
      CORS_ORIGINS: 'https://app.example.com',
      STORAGE_ACCESS_KEY_ID: 'real-key',
      STORAGE_SECRET_ACCESS_KEY: 'real-secret',
      // P0-3: a valid prod config has tunnel/local-network CORS disabled.
      CORS_ALLOW_TUNNELING: undefined,
      CORS_ALLOW_LOCAL_NETWORK: undefined,
    });
    try {
      expect(() => parseConfig()).not.toThrow();
    } finally {
      restore();
    }
  });

  test('allows the dev default INVITE_TOKEN_SECRET outside production (dev fallback retained)', () => {
    const restore = withEnv({
      NODE_ENV: 'development',
      AUTH_SECRET: 'dev-secret',
      INVITE_TOKEN_SECRET: undefined,
    });
    try {
      expect(() => parseConfig()).not.toThrow();
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// CORS hardening (audit P0-3)
// ---------------------------------------------------------------------------

describe('CORS tunneling / local-network defaults', () => {
  test('allowTunneling defaults to false when unset', () => {
    const restore = withEnv({ CORS_ALLOW_TUNNELING: undefined });
    try {
      expect(parseConfig().cors.allowTunneling).toBe(false);
    } finally {
      restore();
    }
  });

  test('allowLocalNetwork defaults to false when unset', () => {
    const restore = withEnv({ CORS_ALLOW_LOCAL_NETWORK: undefined });
    try {
      expect(parseConfig().cors.allowLocalNetwork).toBe(false);
    } finally {
      restore();
    }
  });

  // Minimum env for a valid production parse.
  const PROD_BASE = {
    NODE_ENV: 'production',
    AUTH_SECRET: 'prod-secret-value',
    DATABASE_URL: 'postgres://u:p@db:5432/app',
    INTERNAL_SERVICE_TOKEN: 'svc-token',
    INVITE_TOKEN_SECRET: 'a-real-prod-secret',
    UNSUBSCRIBE_SECRET: 'a-real-prod-unsub-secret',
    STORAGE_ACCESS_KEY_ID: 'real-key',
    STORAGE_SECRET_ACCESS_KEY: 'real-secret',
  };

  test('production rejects CORS_ALLOW_TUNNELING=true', () => {
    const restore = withEnv({ ...PROD_BASE, CORS_ALLOW_TUNNELING: 'true' });
    try {
      expect(() => parseConfig()).toThrow(/CORS_ALLOW_TUNNELING/);
    } finally {
      restore();
    }
  });

  test('production rejects CORS_ALLOW_LOCAL_NETWORK=true', () => {
    const restore = withEnv({ ...PROD_BASE, CORS_ALLOW_LOCAL_NETWORK: 'true' });
    try {
      expect(() => parseConfig()).toThrow(/CORS_ALLOW_LOCAL_NETWORK/);
    } finally {
      restore();
    }
  });

  test('production allows both disabled (default)', () => {
    const restore = withEnv({ ...PROD_BASE, CORS_ALLOW_TUNNELING: undefined, CORS_ALLOW_LOCAL_NETWORK: undefined });
    try {
      expect(() => parseConfig()).not.toThrow();
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// Secret hardening (audit P1) — production validation + validated accessors
// ---------------------------------------------------------------------------

describe('production secret validation', () => {
  const PROD_BASE = {
    NODE_ENV: 'production',
    AUTH_SECRET: 'prod-secret-value',
    DATABASE_URL: 'postgres://u:p@db:5432/app',
    INTERNAL_SERVICE_TOKEN: 'svc-token',
    INVITE_TOKEN_SECRET: 'a-real-prod-secret',
    UNSUBSCRIBE_SECRET: 'a-real-prod-unsub-secret',
    STORAGE_ACCESS_KEY_ID: 'real-key',
    STORAGE_SECRET_ACCESS_KEY: 'real-secret',
    CORS_ALLOW_TUNNELING: undefined as string | undefined,
    CORS_ALLOW_LOCAL_NETWORK: undefined as string | undefined,
  };

  test('rejects missing UNSUBSCRIBE_SECRET', () => {
    const restore = withEnv({ ...PROD_BASE, UNSUBSCRIBE_SECRET: undefined });
    try {
      expect(() => parseConfig()).toThrow(/UNSUBSCRIBE_SECRET/);
    } finally {
      restore();
    }
  });

  test('rejects the dev-default UNSUBSCRIBE_SECRET', () => {
    const restore = withEnv({ ...PROD_BASE, UNSUBSCRIBE_SECRET: 'dev-unsub-secret-change-in-production' });
    try {
      expect(() => parseConfig()).toThrow(/UNSUBSCRIBE_SECRET/);
    } finally {
      restore();
    }
  });

  test('rejects default minioadmin storage credentials', () => {
    const restore = withEnv({ ...PROD_BASE, STORAGE_ACCESS_KEY_ID: 'minioadmin' });
    try {
      expect(() => parseConfig()).toThrow(/STORAGE_ACCESS_KEY_ID/);
    } finally {
      restore();
    }
  });
});

describe('validated secret accessors', () => {
  test('getInviteTokenSecret returns dev default outside production', () => {
    const restore = withEnv({ NODE_ENV: 'development', INVITE_TOKEN_SECRET: undefined });
    try {
      expect(getInviteTokenSecret()).toBe('dev-secret-change-in-production');
    } finally {
      restore();
    }
  });

  test('getInviteTokenSecret returns the configured value when set', () => {
    const restore = withEnv({ INVITE_TOKEN_SECRET: 'configured-invite-secret' });
    try {
      expect(getInviteTokenSecret()).toBe('configured-invite-secret');
    } finally {
      restore();
    }
  });

  test('getInviteTokenSecret throws in production when unset', () => {
    const restore = withEnv({ NODE_ENV: 'production', INVITE_TOKEN_SECRET: undefined });
    try {
      expect(() => getInviteTokenSecret()).toThrow(/INVITE_TOKEN_SECRET/);
    } finally {
      restore();
    }
  });

  test('getUnsubscribeSecret returns dev default outside production', () => {
    const restore = withEnv({ NODE_ENV: 'development', UNSUBSCRIBE_SECRET: undefined });
    try {
      expect(getUnsubscribeSecret()).toBe('dev-unsub-secret-change-in-production');
    } finally {
      restore();
    }
  });

  test('getUnsubscribeSecret throws in production when unset', () => {
    const restore = withEnv({ NODE_ENV: 'production', UNSUBSCRIBE_SECRET: undefined });
    try {
      expect(() => getUnsubscribeSecret()).toThrow(/UNSUBSCRIBE_SECRET/);
    } finally {
      restore();
    }
  });

  test('getPaymongoConfig returns null when unset', () => {
    const restore = withEnv({ PAYMONGO_SECRET_KEY: undefined, PAYMONGO_WEBHOOK_SECRET: undefined });
    try {
      expect(getPaymongoConfig()).toBeNull();
    } finally {
      restore();
    }
  });

  test('getPaymongoConfig returns credentials when both set', () => {
    const restore = withEnv({ PAYMONGO_SECRET_KEY: 'sk_test', PAYMONGO_WEBHOOK_SECRET: 'whsec_test' });
    try {
      expect(getPaymongoConfig()).toEqual({ secretKey: 'sk_test', webhookSecret: 'whsec_test' });
    } finally {
      restore();
    }
  });

  test('getPaymongoConfig returns null when only one is set', () => {
    const restore = withEnv({ PAYMONGO_SECRET_KEY: 'sk_test', PAYMONGO_WEBHOOK_SECRET: undefined });
    try {
      expect(getPaymongoConfig()).toBeNull();
    } finally {
      restore();
    }
  });
});
