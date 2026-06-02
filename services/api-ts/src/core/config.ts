/**
 * Configuration management for Monobase API
 * Parses environment variables into a typed configuration object
 */

import { z } from 'zod';
import type { AuthConfig, VersionedSecret } from '@/types/auth';
import { DEFAULT_ICE_SERVERS, parseIceServerUrls, type IceServer } from '@/utils/webrtc';
import type { DatabaseConfig } from './database';
import type { StorageConfig } from './storage';
import type { EmailConfig } from './email-types';
import type { NotificationConfig } from './notifs';
import type { BillingConfig } from './billing-types';

export interface Config {
  // Server configuration
  server: {
    host: string;
    port: number;
    publicUrl?: string;
  };

  // Database configuration
  database: DatabaseConfig;

  // CORS configuration
  cors: {
    origins: string[];
    credentials: boolean;
    allowLocalNetwork: boolean;
    allowTunneling: boolean;
    strict: boolean;
  };

  // Logging configuration
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    pretty: boolean;
  };

  // Authentication configuration
  auth: AuthConfig;

  // Rate limiting configuration
  rateLimit: {
    enabled: boolean;
    max: number;
  };

  // Storage configuration
  storage: StorageConfig;

  // Email configuration
  email: EmailConfig;

  // Notification configuration
  notifs: NotificationConfig;

  // Billing configuration
  billing: BillingConfig;

  // Internal service-to-service authentication (P1-2)
  internalService: {
    /** Active token used for outgoing expand requests (first in list) */
    activeToken: string;
    /** All valid tokens — allows zero-downtime rotation */
    allTokens: string[];
  };

  // WebRTC configuration
  webrtc: {
    iceServers: IceServer[];
  };
}

// ---------------------------------------------------------------------------
// Env schema — single validation surface for every env var the API reads.
// ---------------------------------------------------------------------------

const boolish = (defaultValue: boolean) =>
  z.preprocess((v) => {
    if (v === undefined || v === '') return defaultValue;
    if (typeof v === 'string') return v.toLowerCase() === 'true';
    return Boolean(v);
  }, z.boolean());

const intish = (defaultValue: number) =>
  z.preprocess((v) => {
    if (v === undefined || v === '') return defaultValue;
    const n = Number.parseInt(String(v), 10);
    return Number.isNaN(n) ? defaultValue : n;
  }, z.number().int());

const csvList = (defaultList: string[]) =>
  z.preprocess((v) => {
    if (v === undefined || v === '') return defaultList;
    return String(v).split(',').map((s) => s.trim()).filter(Boolean);
  }, z.array(z.string()));

const logLevelSchema = z.preprocess((v) => {
  const valid = ['debug', 'info', 'warn', 'error'];
  const lower = String(v ?? '').toLowerCase();
  return valid.includes(lower) ? lower : 'info';
}, z.enum(['debug', 'info', 'warn', 'error']));

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),

  // Server
  SERVER_HOST: z.string().default('0.0.0.0'),
  // SERVER_PORT + PORT both optional so we can preserve original precedence:
  // SERVER_PORT (if valid integer) → PORT (if valid integer) → 7213 default.
  SERVER_PORT: z.string().optional(),
  PORT: z.string().optional(),
  SERVER_PUBLIC_URL: z.string().optional(),
  PUBLIC_URL: z.string().optional(),

  // Database — optional in schema (defaulted in body) so production check fires
  // when the var is truly unset rather than silently filling in dev credentials.
  // Empty string normalized to undefined so the dev default also kicks in.
  DATABASE_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  DB_POOL_MIN: intish(2),
  DB_POOL_MAX: intish(20),
  DB_IDLE_TIMEOUT: intish(30000),
  DB_SSL: boolish(false),
  DB_LOGGING: boolish(false),

  // CORS
  CORS_ORIGINS: csvList(['http://localhost:3003', 'http://localhost:3004']),
  CORS_CREDENTIALS: boolish(true),
  CORS_ALLOW_LOCAL_NETWORK: boolish(true),
  CORS_ALLOW_TUNNELING: boolish(true),
  CORS_STRICT: boolish(false),

  // Logging
  LOG_LEVEL: logLevelSchema,
  LOG_PRETTY: boolish(true),

  // Auth
  AUTH_BASE_URL: z.string().optional(),
  AUTH_SECRET: z.string().optional(),
  BETTER_AUTH_SECRETS: z.string().optional(),
  AUTH_SESSION_EXPIRES_IN: intish(60 * 60 * 24),
  AUTH_RATE_LIMIT_ENABLED: boolish(true),
  AUTH_RATE_LIMIT_WINDOW: intish(60),
  AUTH_RATE_LIMIT_MAX: intish(10),
  SESSION_LIMIT: intish(5),
  AUTH_REQUIRE_EMAIL_VERIFICATION: boolish(true),
  AUTH_ADMIN_EMAILS: csvList([]),
  AUTH_COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).optional(),
  AUTH_COOKIE_SECURE: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Rate limiting
  RATE_LIMIT_ENABLED: boolish(true),
  RATE_LIMIT_MAX: intish(100),

  // Storage
  STORAGE_PROVIDER: z.enum(['minio', 's3']).default('minio'),
  STORAGE_ENDPOINT: z.string().default('http://localhost:9000'),
  STORAGE_PUBLIC_ENDPOINT: z.string().default('http://localhost:9000'),
  STORAGE_BUCKET: z.string().default('monobase-files'),
  STORAGE_REGION: z.string().default('us-east-1'),
  STORAGE_ACCESS_KEY_ID: z.string().default('minioadmin'),
  STORAGE_SECRET_ACCESS_KEY: z.string().default('minioadmin'),
  STORAGE_UPLOAD_URL_EXPIRY: intish(300),
  STORAGE_DOWNLOAD_URL_EXPIRY: intish(900),

  // Email
  EMAIL_PROVIDER: z.enum(['smtp', 'postmark', 'onesignal']).default('smtp'),
  EMAIL_FROM_NAME: z.string().default('Monobase'),
  EMAIL_FROM_EMAIL: z.string().default('noreply@monobase.com'),
  SMTP_HOST: z.string().default('127.0.0.1'),
  SMTP_PORT: intish(1025),
  SMTP_SECURE: boolish(false),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  POSTMARK_API_KEY: z.string().optional(),
  POSTMARK_MESSAGE_STREAM: z.string().default('outbound'),

  // OneSignal (shared by email + notifs)
  ONESIGNAL_APP_ID: z.string().optional(),
  ONESIGNAL_API_KEY: z.string().optional(),

  // Billing
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_URL: z.string().optional(),

  // Internal service token — production-required (random UUID fallback in dev)
  INTERNAL_SERVICE_TOKEN: z.string().optional(),

  // WebRTC
  WEBRTC_ICE_SERVERS: z.string().optional(),
}).superRefine((env, ctx) => {
  // AUTH_SECRET required in every environment — original behaviour
  if (!env.AUTH_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['AUTH_SECRET'],
      message:
        'AUTH_SECRET environment variable is required. ' +
        'Set it in your .env file (e.g. AUTH_SECRET=$(openssl rand -hex 32)).',
    });
  }
  if (env.NODE_ENV === 'production') {
    if (!env.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'Required in production',
      });
    }
    if (!env.INTERNAL_SERVICE_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['INTERNAL_SERVICE_TOKEN'],
        message: 'Required in production',
      });
    }
  }
});

/**
 * Parse configuration from environment variables.
 * Validates with Zod and fails fast on missing/malformed required vars.
 */
export function parseConfig(): Config {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Single-line summary listing variable names (in addition order from the
    // schema/superRefine), with messages in parentheses. Format keeps regex
    // matchers like /AUTH_SECRET.*DATABASE_URL/ usable in tests.
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'} (${i.message})`)
      .join(', ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const env = parsed.data;
  const isProduction = env.NODE_ENV === 'production';

  // Port precedence: SERVER_PORT (if valid) → PORT (if valid) → 7213 default.
  // Matches original `parseIntValue(SERVER_PORT || PORT, 7213)` semantics.
  const tryInt = (v: string | undefined): number | undefined => {
    if (!v) return undefined;
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? undefined : n;
  };
  const serverPort = tryInt(env.SERVER_PORT) ?? tryInt(env.PORT) ?? 7213;
  const publicUrl = env.SERVER_PUBLIC_URL || env.PUBLIC_URL;

  // Production warnings for insecure defaults (advisory, not fatal)
  if (isProduction) {
    const warnings: string[] = [];
    if (!process.env['CORS_ORIGINS'] || process.env['CORS_ORIGINS'] === '*') {
      warnings.push('CORS_ORIGINS is wildcard — set explicit origins in production');
    }
    if (!process.env['STORAGE_ACCESS_KEY_ID'] || process.env['STORAGE_ACCESS_KEY_ID'] === 'minioadmin') {
      warnings.push('STORAGE_ACCESS_KEY_ID uses default — set real credentials');
    }
    for (const w of warnings) console.warn(`[config] WARNING: ${w}`);
  }

  // Parse versioned secrets for key rotation: "2:new-key,1:old-key"
  const parseSecrets = (raw: string | undefined): VersionedSecret[] | undefined => {
    if (!raw) return undefined;
    const entries = raw.split(',').map((s) => s.trim()).filter(Boolean);
    return entries.map((entry) => {
      const colonIdx = entry.indexOf(':');
      if (colonIdx === -1) {
        throw new Error(
          `Invalid BETTER_AUTH_SECRETS format: "${entry}". Expected "version:key" (e.g. "2:my-secret-key,1:old-key").`,
        );
      }
      const version = Number.parseInt(entry.slice(0, colonIdx), 10);
      const value = entry.slice(colonIdx + 1);
      if (Number.isNaN(version) || version < 1 || !value) {
        throw new Error(
          `Invalid BETTER_AUTH_SECRETS entry: "${entry}". Version must be ≥1 and key must be non-empty.`,
        );
      }
      return { version, value };
    });
  };

  return {
    server: {
      host: env.SERVER_HOST,
      port: serverPort,
      publicUrl,
    },

    database: {
      url: env.DATABASE_URL ?? 'postgres://postgres:password@localhost:5432/monobase',
      poolMin: env.DB_POOL_MIN,
      poolMax: env.DB_POOL_MAX,
      idleTimeoutMs: env.DB_IDLE_TIMEOUT,
      ssl: env.DB_SSL,
      logging: env.DB_LOGGING,
    },

    cors: {
      origins: env.CORS_ORIGINS,
      credentials: env.CORS_CREDENTIALS,
      allowLocalNetwork: env.CORS_ALLOW_LOCAL_NETWORK,
      allowTunneling: env.CORS_ALLOW_TUNNELING,
      strict: env.CORS_STRICT,
    },

    logging: {
      level: env.LOG_LEVEL,
      pretty: env.LOG_PRETTY,
    },

    auth: {
      baseUrl: env.AUTH_BASE_URL || publicUrl || `http://${env.SERVER_HOST}:${serverPort}`,
      // biome-ignore lint: superRefine guarantees presence
      secret: env.AUTH_SECRET!,
      secrets: parseSecrets(env.BETTER_AUTH_SECRETS),
      sessionExpiresIn: env.AUTH_SESSION_EXPIRES_IN,
      rateLimitEnabled: env.AUTH_RATE_LIMIT_ENABLED,
      rateLimitWindow: env.AUTH_RATE_LIMIT_WINDOW,
      rateLimitMax: env.AUTH_RATE_LIMIT_MAX,
      sessionLimit: env.SESSION_LIMIT,
      requireEmailVerification: env.AUTH_REQUIRE_EMAIL_VERIFICATION,
      adminEmails: env.AUTH_ADMIN_EMAILS,
      cookieSameSite: env.AUTH_COOKIE_SAMESITE,
      secureCookies:
        env.AUTH_COOKIE_SECURE !== undefined
          ? env.AUTH_COOKIE_SECURE.toLowerCase() === 'true'
          : undefined,
      socialProviders: {
        google:
          env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
            ? {
                clientId: env.GOOGLE_CLIENT_ID,
                clientSecret: env.GOOGLE_CLIENT_SECRET,
              }
            : undefined,
      },
    },

    rateLimit: {
      enabled: env.RATE_LIMIT_ENABLED,
      max: env.RATE_LIMIT_MAX,
    },

    storage: {
      provider: env.STORAGE_PROVIDER,
      endpoint: env.STORAGE_ENDPOINT,
      publicEndpoint: env.STORAGE_PUBLIC_ENDPOINT,
      bucket: env.STORAGE_BUCKET,
      region: env.STORAGE_REGION,
      credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY_ID,
        secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
      },
      uploadUrlExpiry: env.STORAGE_UPLOAD_URL_EXPIRY,
      downloadUrlExpiry: env.STORAGE_DOWNLOAD_URL_EXPIRY,
    },

    email: {
      provider: env.EMAIL_PROVIDER,
      from: { name: env.EMAIL_FROM_NAME, email: env.EMAIL_FROM_EMAIL },
      smtp: {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      },
      postmark: env.POSTMARK_API_KEY
        ? { apiKey: env.POSTMARK_API_KEY, messageStream: env.POSTMARK_MESSAGE_STREAM }
        : undefined,
      onesignal:
        env.ONESIGNAL_APP_ID && env.ONESIGNAL_API_KEY
          ? { appId: env.ONESIGNAL_APP_ID, apiKey: env.ONESIGNAL_API_KEY }
          : undefined,
    },

    notifs: {
      provider: 'onesignal',
      onesignal:
        env.ONESIGNAL_APP_ID && env.ONESIGNAL_API_KEY
          ? { appId: env.ONESIGNAL_APP_ID, apiKey: env.ONESIGNAL_API_KEY }
          : undefined,
    },

    billing: {
      provider: 'stripe',
      stripe: {
        secretKey: env.STRIPE_SECRET_KEY,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET,
        url: env.STRIPE_URL,
      },
    },

    internalService: (() => {
      const raw = env.INTERNAL_SERVICE_TOKEN;
      const tokens = raw
        ? raw.split(',').map((t) => t.trim()).filter(Boolean)
        : [crypto.randomUUID()];
      // biome-ignore lint: tokens[0] guaranteed non-null by construction
      return { activeToken: tokens[0]!, allTokens: tokens };
    })(),

    webrtc: {
      iceServers: env.WEBRTC_ICE_SERVERS
        ? parseIceServerUrls(env.WEBRTC_ICE_SERVERS)
        : DEFAULT_ICE_SERVERS,
    },
  };
}
