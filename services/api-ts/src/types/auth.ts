/**
 * Auth type definitions for Monobase Application Platform
 * Contains all authentication and authorization related types
 */

import type { User as BetterAuthUser, Session as BetterAuthSession } from 'better-auth';

/**
 * User roles. `user` is the Better-Auth default; `client` and `host` are
 * application-level roles assigned via `addUserRole`/`removeUserRole`.
 */
export type UserRole = 'client' | 'host' | 'admin' | 'user';

/**
 * Admin privilege levels
 */
export type AdminLevel = 'super' | 'admin' | 'support';

/**
 * User type alias for Better Auth user
 */
export interface User extends BetterAuthUser {
  role: UserRole | string;
  banned?: boolean;
  twoFactorEnabled?: boolean;
}

/**
 * Extended session type
 */
export interface Session extends BetterAuthSession {
  user: User;
}

/**
 * Auth configuration
 */
/**
 * Versioned secret for non-destructive key rotation.
 * Better-Auth v1.5+ decrypts with the matching version, encrypts with the highest.
 */
export interface VersionedSecret {
  version: number;
  value: string;
}

/**
 * Better-Auth internal API methods not exposed in published types.
 * Used for session management in membership lifecycle handlers.
 */
export interface BetterAuthInternalApi {
  revokeUserSessions: (opts: { body: { userId: string }; headers: Headers }) => Promise<void>;
}

export interface AuthConfig {
  baseUrl: string;
  secret: string;
  secrets?: VersionedSecret[]; // Versioned secrets for key rotation
  sessionExpiresIn?: number; // seconds
  rateLimitEnabled?: boolean;
  rateLimitWindow?: number; // seconds
  rateLimitMax?: number; // max attempts
  sessionLimit?: number; // max concurrent sessions per user (default 5, V-15)
  requireEmailVerification?: boolean; // default true — set false only for local dev
  adminEmails?: string[]; // emails to automatically promote to admin
  cookieSameSite?: 'strict' | 'lax' | 'none';
  secureCookies?: boolean;
  socialProviders?: {
    google?: {
      clientId: string;
      clientSecret: string;
    };
  };
}
