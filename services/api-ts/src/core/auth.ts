/**
 * Better-Auth configuration for Monobase Application Platform
 * Simplified version for basic authentication
 */

import { randomUUID } from 'crypto';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP, openAPI, admin, bearer, twoFactor, magicLink, lastLoginMethod } from 'better-auth/plugins';
import { oneTimeToken } from "better-auth/plugins/one-time-token";
import { apiKey } from '@better-auth/api-key';
import { passkey } from '@better-auth/passkey';
import type { App } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';
import type { EmailService } from '@/core/email';
import { maskEmail } from '@/utils/mask';
import type { AuthInstance } from '@/utils/auth';
import { EmailTemplateTags } from '@/core/email-types';
import type { CreateAuditLogRequest } from '@/core/audit';
import * as schema from '@/generated/better-auth/schema';
import { eq } from 'drizzle-orm';
import { createTrustedOriginsList, determineCookieConfig } from '@/utils/cors';
import { ac } from '@/utils/auth';
import type { Config } from '@/core/config';
import {
  recordFailedAttempt,
  clearFailedAttempts,
  isLockedOut,
  applyLockout,
  MAX_FAILED_ATTEMPTS,
} from '@/core/account-lockout';
import { enforceSessionLimit, DEFAULT_SESSION_LIMIT } from '@/core/session-limit';

/**
 * Repo contract for audit logging within auth hooks.
 * Implemented by AuditRepository in handlers/audit/repos/.
 */
export interface AuthAuditRepo {
  logEvent(request: CreateAuditLogRequest): Promise<unknown>;
}

/**
 * Repo contract for person creation on signup.
 * Implemented by PersonRepository in handlers/person/repos/.
 */
export interface AuthPersonRepo {
  findOneById(id: string): Promise<{ id: string } | null>;
  createOne(data: {
    id: string;
    firstName: string;
    lastName: string | null;
    contactInfo: { email: string };
    createdBy: string;
  }): Promise<unknown>;
  /** [review I3] Added for account-claim (create.before hook). */
  findByEmailOrLicense(
    email?: string,
    licenseNumber?: string,
  ): Promise<{ id: string; contactInfo?: { email?: string } | null } | null>;
}

// Re-export auth instance type for type safety
// AuthInstance type re-exported for convenience
export type { AuthInstance };

/**
 * Create and configure Better-Auth instance
 * @param database - Drizzle database instance
 * @param config - Full application configuration
 * @param logger - Optional logger instance for plugin logging
 * @param emailService - Email service instance for authentication emails
 */
export function createAuth(
  database: DatabaseInstance,
  config: Config,
  logger: Logger | undefined,
  emailService: EmailService,
  deps: { auditRepo: AuthAuditRepo; personRepo: AuthPersonRepo },
): AuthInstance {
  const { auditRepo, personRepo } = deps;
  // Generate trusted origins and cookie config based on CORS settings
  const trustedOrigins = createTrustedOriginsList(config.cors);
  const cookieConfig = determineCookieConfig(config.cors, config.auth);
  return betterAuth({
    // Basic configuration
    appName: 'Monobase',
    baseURL: config.auth.baseUrl,
    basePath: '/auth',
    secret: config.auth.secret,
    // Versioned secrets for non-destructive key rotation (Better-Auth v1.5+)
    ...(config.auth.secrets && { secrets: config.auth.secrets }),
    trustedOrigins: trustedOrigins,

    // Database configuration
    database: drizzleAdapter(database, {
      provider: 'pg',
      schema,
    }),
    
    // Email configuration
    emailVerification: {
      sendVerificationEmail: async ({ user, token, url }) => {
        try {
          await emailService.queueEmail({
            templateTags: [EmailTemplateTags.AUTH_EMAIL_VERIFY],
            recipient: user.email,
            variables: {
              name: user.name || 'User',
              email: user.email,
              verificationLink: url,
              verificationToken: token
            },
            priority: 1 // High priority for auth emails
          });
          logger?.info({ userId: user.id, email: maskEmail(user.email) }, 'Email verification queued');
        } catch (error) {
          logger?.error({ error, userId: user.id, email: maskEmail(user.email) }, 'Failed to queue email verification');
          // Continue auth flow even if email fails (non-blocking)
        }
      },
      sendOnSignUp: true,
    },
    
    // Email and password authentication
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: config.auth.requireEmailVerification ?? true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      // EF-M02: Revoke all sessions when password is reset via email link
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url, token }) => {
        try {
          await emailService.queueEmail({
            templateTags: [EmailTemplateTags.AUTH_PASSWORD_RESET],
            recipient: user.email,
            variables: {
              name: user.name || 'User',
              email: user.email,
              resetLink: url,
              resetToken: token,
              expirationTime: 15 // Link expires in 15 minutes (template default)
            },
            priority: 1 // High priority for auth emails
          });
          logger?.info({ userId: user.id, email: maskEmail(user.email) }, 'Password reset email sent');
        } catch (error) {
          logger?.error({ error, userId: user.id, email: maskEmail(user.email) }, 'Failed to send password reset email');
          // Continue auth flow even if email fails (non-blocking)
        }
      },
    },
    
    // Social providers (optional)
    socialProviders: config.auth.socialProviders ? {
      google: config.auth.socialProviders.google ? {
        clientId: config.auth.socialProviders.google.clientId,
        clientSecret: config.auth.socialProviders.google.clientSecret,
      } : undefined,
    } : undefined,
    
    // Database hooks for user lifecycle management
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const data: Record<string, unknown> = { ...user }

            // Existing admin auto-promotion (unchanged behavior)
            const adminEmails = config.auth.adminEmails || []
            if (adminEmails.includes(user.email)) {
              const currentRole = user['role'] || 'user'
              const existingRoles = typeof currentRole === 'string'
                ? currentRole.split(',').map((r: string) => r.trim()).filter((r) => r) : []
              if (!existingRoles.includes('admin')) {
                existingRoles.push('admin')
                data['role'] = existingRoles.join(',')
                logger?.info(`Auto-promoting new user ${maskEmail(user.email)} to admin role during creation`)
              }
            }

            // Account-claim: link a pre-existing roster person to this new user by email,
            // by overriding the user's id with the roster person's id (preserves the
            // person.id === user.id invariant; no PK re-key). Non-blocking on error.
            // [review C2] ONLY when the email is verified (email-OTP/magic-link prove inbox
            // ownership; password signup does not) — otherwise knowing a roster email would
            // let an attacker seize that member's identity/money.
            try {
              if (user.email && user.emailVerified === true) {
                const match = await personRepo.findByEmailOrLicense(user.email)
                if (match && match.id !== user.id) {
                  const claimed = await database.select({ id: schema.user.id })
                    .from(schema.user).where(eq(schema.user.id, match.id)).limit(1)
                  if (claimed.length === 0) {
                    data['id'] = match.id
                    // Grant the association:member role so the claimed member can read
                    // their own org-scoped dashboard data — dues/payments/events/org-profile
                    // gate on this role (authMiddleware). Without it a claimed member logs
                    // in to a 403 wall ("Insufficient permissions"). The role is coarse:
                    // org-context middleware still enforces per-org active membership, so
                    // this is necessary-but-not-sufficient (no cross-org leak). Compose with
                    // any role already set above (admin auto-promotion) rather than clobber.
                    const currentRole =
                      (typeof data['role'] === 'string' && data['role']
                        ? (data['role'] as string)
                        : (typeof user['role'] === 'string' ? (user['role'] as string) : 'user'))
                    const merged = new Set(
                      currentRole.split(',').map((r) => r.trim()).filter(Boolean)
                    )
                    merged.add('association:member')
                    data['role'] = Array.from(merged).join(',')
                    logger?.info({ personId: match.id, email: maskEmail(user.email) },
                      'account-claim: linking new user to existing roster person by email + granting association:member')
                  } else {
                    logger?.warn({ personId: match.id }, 'account-claim: matched person already has a user — skipping')
                  }
                }
              }
            } catch (err) {
              logger?.warn({ error: err, email: maskEmail(user.email) }, 'account-claim: lookup failed — proceeding unlinked')
            }

            return { data }
          },
          after: async (user) => {
            // Auto-create person record so profile/dashboard work immediately
            try {
              const existing = await personRepo.findOneById(user.id);
              if (!existing) {
                const nameParts = (user.name || '').trim().split(/\s+/);
                const firstName = nameParts[0] || user.email?.split('@')[0] || 'Member';
                await personRepo.createOne({
                  id: user.id,
                  firstName,
                  lastName: nameParts.length > 1 ? nameParts.slice(1).join(' ') : null,
                  contactInfo: { email: user.email },
                  createdBy: user.id,
                });
                logger?.info({ userId: user.id }, 'Auto-created person record on signup');
              }
            } catch (err) {
              logger?.warn({ error: err, userId: user.id }, 'Failed to auto-create person on signup');
            }
          }
        },
        // P1-4: Invalidate all sessions when user role changes
        // Forces re-authentication so session carries fresh role claims
        update: {
          after: async (user) => {
            // role field present means it may have changed — invalidate sessions
            // Slightly over-broad but safe: better to force re-auth than miss a change
            if ('role' in user) {
              try {
                const deleted = await database
                  .delete(schema.session)
                  .where(eq(schema.session.userId, user.id))
                  .returning({ id: schema.session.id });

                if (deleted.length > 0) {
                  logger?.info(
                    { userId: user.id, sessionsRevoked: deleted.length, newRole: user['role'] },
                    'P1-4: Sessions invalidated after role change',
                  );

                  // Audit the role change
                  try {
                    await auditRepo.logEvent({
                      eventType: 'security',
                      category: 'security',
                      action: 'update',
                      outcome: 'success',
                      user: user.id,
                      userType: 'system',
                      resourceType: 'user',
                      resource: user.id,
                      description: `Role changed to "${user['role']}" — ${deleted.length} session(s) revoked`,
                    });
                  } catch (auditErr) {
                    logger?.warn({ error: auditErr, userId: user.id }, 'Failed to audit role change');
                  }
                }
              } catch (err) {
                logger?.error({ error: err, userId: user.id }, 'P1-4: Failed to invalidate sessions on role change');
              }
            }
          },
        },
      },
      // P1-6: Audit auth events — log session creation (login) to audit trail
      session: {
        create: {
          after: async (session: { id: string; userId: string; ipAddress?: string | null; userAgent?: string | null }) => {
            // AC-M01-005: Clear failed attempts on successful login
            let userEmail: string | undefined;
            try {
              const [userRow] = await database
                .select({ email: schema.user.email })
                .from(schema.user)
                .where(eq(schema.user.id, session.userId))
                .limit(1);
              if (userRow?.email) {
                userEmail = userRow.email;
                clearFailedAttempts(userRow.email);
              }
            } catch (clearErr) {
              logger?.warn({ error: clearErr, userId: session.userId }, 'Failed to clear lockout on login');
            }

            try {
              await auditRepo.logEvent({
                eventType: 'authentication',
                category: 'security',
                action: 'login',
                outcome: 'success',
                user: session.userId,
                userType: 'client',
                resourceType: 'session',
                resource: session.id,
                description: 'User logged in — session created',
                details: userEmail ? { email: userEmail } : undefined,
                ipAddress: session.ipAddress ?? undefined,
                userAgent: session.userAgent ?? undefined,
              });
            } catch (err) {
              logger?.warn({ error: err, userId: session.userId }, 'Failed to audit login event');
            }

            // V-15: Enforce concurrent session limit — revoke oldest sessions
            try {
              const limit = config.auth.sessionLimit ?? DEFAULT_SESSION_LIMIT;
              await enforceSessionLimit(database, session.userId, limit, logger, auditRepo);
            } catch (err) {
              logger?.warn({ error: err, userId: session.userId }, 'V-15: Failed to enforce session limit');
            }
          },
        },
        delete: {
          after: async (session: { id: string; userId: string }) => {
            try {
              await auditRepo.logEvent({
                eventType: 'authentication',
                category: 'security',
                action: 'logout',
                outcome: 'success',
                user: session.userId,
                userType: 'client',
                resourceType: 'session',
                resource: session.id,
                description: 'User logged out — session deleted',
              });
            } catch (err) {
              logger?.warn({ error: err, userId: session.userId }, 'Failed to audit logout event');
            }
          },
        },
      },
    },

    // Extension plugins
    plugins: [
      emailOTP({
        sendVerificationOTP: async ({ email, otp, type }) => {
          try {
            await emailService.queueEmail({
              templateTags: [EmailTemplateTags.AUTH_2FA],
              recipient: email,
              variables: {
                name: 'User', // OTP emails may not have user context, use generic name
                email,
                code: otp, // Template expects 'code', not 'otp'
                expirationTime: 5, // Code expires in 5 minutes (template default)
                type, // type of email: sign-in | email-verification | password-reset
              },
              priority: 1 // High priority for auth emails
            });
            logger?.info({ email: maskEmail(email), type }, 'OTP verification email sent');
          } catch (error) {
            logger?.error({ error, email: maskEmail(email), type }, 'Failed to send OTP verification email');
            // Continue auth flow even if email fails (non-blocking)
          }
        },
      }),
      admin({
        defaultRole: 'user',
        adminRoles: ['admin'],
        ac,
      }),
      bearer(),
      passkey(),
      // P0-1 VERIFIED: Better-Auth encrypts TOTP secrets and backup codes at rest
      // using AUTH_SECRET before DB storage. Production guard in config.ts enforces
      // AUTH_SECRET is set. Key rotation supported via BETTER_AUTH_SECRETS env var.
      twoFactor(),
      magicLink({
        sendMagicLink: async ({ email, url, token }) => {
          try {
            await emailService.queueEmail({
              templateTags: [EmailTemplateTags.AUTH_MAGIC_LINK],
              recipient: email,
              variables: {
                name: 'User',  // Magic link doesn't have user context
                email,
                magicLink: url,
                token,
              },
              priority: 1 // High priority for auth emails
            });
            logger?.info({ email: maskEmail(email) }, 'Email change verification sent');
          } catch (error) {
            logger?.error({ error, email: maskEmail(email) }, 'Failed to send email magic link');
            // Continue auth flow even if email fails (non-blocking)
          }
        },
      }),
      apiKey(),
      lastLoginMethod(),
      oneTimeToken(),
      openAPI(),
    ],
    
    // User schema extensions - simplified
    user: {
      changeEmail: {
        enabled: true,
        sendChangeEmailVerification: async ({ user, newEmail, url, token }: { user: any; newEmail: string; url: string; token: string }) => {
          try {
            await emailService.queueEmail({
              templateTags: [EmailTemplateTags.AUTH_EMAIL_VERIFY],
              recipient: newEmail,
              variables: {
                name: user.name || 'User',
                email: newEmail,
                currentEmail: user.email,
                verificationLink: url,
                verificationToken: token
              },
              priority: 1 // High priority for auth emails
            });
            logger?.info({ userId: user.id, currentEmail: maskEmail(user.email), newEmail: maskEmail(newEmail) }, 'Email change verification sent');
          } catch (error) {
            logger?.error({ error, userId: user.id, currentEmail: maskEmail(user.email), newEmail: maskEmail(newEmail) }, 'Failed to send email change verification');
            // Continue auth flow even if email fails (non-blocking)
          }
        },
      },
      deleteUser: {
        enabled: false, // Disabled until proper safeguards (re-auth, admin notification, soft-delete) are built
      },
    },
    
    // Session configuration
    // P0-2 MITIGATION: Better-Auth stores session tokens as plaintext in the DB.
    // Native token hashing is not supported by Better-Auth's session lookup flow.
    // Mitigations applied: (1) reduced default expiry to 24h, (2) IP address
    // tracking enabled, (3) crypto.ts utility ready for custom adapter wrapper,
    // (4) production deployments MUST enable PostgreSQL TDE or column-level
    // encryption via pgcrypto for the session.token column.
    session: {
      expiresIn: config.auth.sessionExpiresIn,
      storeSessionInDatabase: true,
      // cleanupAfter not supported in this Better-Auth version — use DB-level TTL
    },

    // Account linking
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google'],
      },
    },


    // Rate limiting
    rateLimit: {
      enabled: config.auth.rateLimitEnabled,
      window: config.auth.rateLimitWindow,
      max: config.auth.rateLimitMax,
    },
    
    // Advanced options
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["x-client-ip", "x-forwarded-for"],
      },
      defaultCookieAttributes: {
        secure: cookieConfig.secure,
        httpOnly: true,
        sameSite: cookieConfig.sameSite,
      },
      database: {
        generateId: () => {
          // Generate a proper UUID v4 for Better-Auth IDs
          return randomUUID();
        },
      },
    },

    // AC-M01-005: Track failed login attempts for account lockout
    onAPIError: {
      onError: async (error: unknown, ctx: any) => {
        // Only track credential-based sign-in failures
        try {
          const req = ctx?.request;
          if (!req) return;
          const url = new URL(req.url);
          const isSignIn = url.pathname.includes('/sign-in') || url.pathname.includes('/login');
          if (!isSignIn) return;

          // Try to extract email from the request body
          // Better-Auth passes the parsed body in context
          const body = ctx?.body;
          const email = body?.email;
          if (!email || typeof email !== 'string') return;

          const count = recordFailedAttempt(email);
          logger?.info({ email: maskEmail(email), failedAttempts: count }, 'Failed login attempt recorded');

          if (count >= MAX_FAILED_ATTEMPTS) {
            await applyLockout(database, email, logger, auditRepo);
          }
        } catch (hookErr) {
          logger?.warn({ error: hookErr }, 'AC-M01-005: Error in lockout tracking hook');
        }
      },
    },

    // Logger options
    logger: {
      log: (level, message, ...args) => {
        // Use the pino logger if available
        if (logger) {
          const logFn = logger[level as keyof typeof logger];
          if (typeof logFn === 'function') {
            (logFn as (...a: unknown[]) => void).call(logger, message, ...args);
          }
        }
      },
    },
  }) as unknown as AuthInstance;
}


/**
 * Register auth routes with the Hono app
 * Better-Auth handles all authentication endpoints
 */
export function registerRoutes(app: App): void {
  const { auth, database, logger } = app;

  // EF-M02: Force session revocation on password change
  // Better-Auth's changePassword endpoint accepts revokeOtherSessions as a body param.
  // We intercept to force it true so clients cannot opt out of session invalidation.
  app.post('/auth/change-password', async (c) => {
    try {
      const body = await c.req.json();
      // Force revokeOtherSessions regardless of what the client sent
      const patchedBody = { ...body, revokeOtherSessions: true };

      // Clone the request with the patched body
      const patchedRequest = new Request(c.req.raw.url, {
        method: c.req.raw.method,
        headers: c.req.raw.headers,
        body: JSON.stringify(patchedBody),
      });

      const result = await auth.handler(patchedRequest);

      // Audit the password change session revocation
      if (result.ok) {
        const session = c.get('session');
        const userId = session?.userId;
        if (userId) {
          try {
            const { AuditRepository } = await import('@/handlers/audit/repos/audit.repo');
            const auditRepo = new AuditRepository(database, logger);
            await auditRepo.logEvent({
              eventType: 'security',
              eventSubType: 'authentication.password-changed',
              category: 'security',
              action: 'update',
              outcome: 'success',
              user: userId,
              userType: 'client',
              resourceType: 'user',
              resource: userId,
              description: 'Password changed — other sessions revoked (EF-M02, AL-001)',
            });
          } catch (auditErr) {
            logger?.warn({ error: auditErr }, 'EF-M02: Failed to audit password change');
          }
        }
      }

      return result;
    } catch {
      // If body parsing fails, pass through to Better-Auth for its own error handling
      return auth.handler(c.req.raw);
    }
  });

  // M3-R7: Block platform admins from disabling 2FA
  // Must be registered BEFORE the catch-all /auth/* handler
  app.post('/auth/two-factor/disable', async (c) => {
    const session = c.get('session');
    if (session) {
      const user = c.get('user');
      if (user) {
        const { PlatformAdminRepository } = await import('@/handlers/platformadmin/repos/platform-admin.repo');
        const adminRepo = new PlatformAdminRepository(database, logger);
        const admin = await adminRepo.findById(user.id);
        if (admin) {
          return c.json(
            { error: 'Platform administrators cannot disable two-factor authentication' },
            403,
          );
        }
      }
    }
    // Not a platform admin — pass through to Better-Auth and audit
    const result = await auth.handler(c.req.raw);
    if (result.ok && session) {
      const userId = session.userId;
      try {
        const { AuditRepository } = await import('@/handlers/audit/repos/audit.repo');
        const auditRepo = new AuditRepository(database, logger);
        await auditRepo.logEvent({
          eventType: 'security',
          eventSubType: 'authentication.mfa-disabled',
          category: 'security',
          action: 'update',
          outcome: 'success',
          user: userId,
          userType: 'client',
          resourceType: 'user',
          resource: userId,
          description: 'Two-factor authentication disabled (AL-002)',
        });
      } catch (auditErr) {
        logger?.warn({ error: auditErr }, 'AL-002: Failed to audit MFA disable');
      }
    }
    return result;
  });

  // AL-002: Audit MFA enable
  app.post('/auth/two-factor/enable', async (c) => {
    const result = await auth.handler(c.req.raw);
    if (result.ok) {
      const session = c.get('session');
      const userId = session?.userId;
      if (userId) {
        try {
          const { AuditRepository } = await import('@/handlers/audit/repos/audit.repo');
          const auditRepo = new AuditRepository(database, logger);
          await auditRepo.logEvent({
            eventType: 'security',
            eventSubType: 'authentication.mfa-enabled',
            category: 'security',
            action: 'update',
            outcome: 'success',
            user: userId,
            userType: 'client',
            resourceType: 'user',
            resource: userId,
            description: 'Two-factor authentication enabled (AL-002)',
          });
        } catch (auditErr) {
          logger?.warn({ error: auditErr }, 'AL-002: Failed to audit MFA enable');
        }
      }
    }
    return result;
  });

  // Better-Auth handles all /auth/* routes with all HTTP methods
  app.all("/auth/*", (c) => auth.handler(c.req.raw));
}
