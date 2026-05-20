/**
 * Better-Auth configuration for Monobase Application Platform
 * Simplified version for basic authentication
 */

import { randomUUID } from 'crypto';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP, openAPI, admin, bearer, twoFactor, magicLink, apiKey, lastLoginMethod } from 'better-auth/plugins';
import { oneTimeToken } from "better-auth/plugins/one-time-token";
import { passkey } from 'better-auth/plugins/passkey'
import type { App } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';
import type { EmailService } from '@/core/email';
import { maskEmail } from '@/core/logger';
import type { AuthInstance } from '@/utils/auth';
import { EmailTemplateTags } from '@/handlers/email/repos/email.schema';
import { AuditRepository } from '@/handlers/audit/repos/audit.repo';
import { PersonRepository } from '@/handlers/person/repos/person.repo';
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
export function createAuth(database: DatabaseInstance, config: Config, logger: Logger | undefined, emailService: EmailService): AuthInstance {
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
            // Check if user email is in admin list
            const adminEmails = config.auth.adminEmails || [];
            if (!adminEmails.includes(user.email)) {
              return { data: user }; // No modification needed
            }

            // Modify role data before it gets stored
            const currentRole = user['role'] || 'user';
            const existingRoles = typeof currentRole === 'string' 
              ? currentRole.split(',').map((r: string) => r.trim()).filter(r => r)
              : [];

            if (!existingRoles.includes('admin')) {
              existingRoles.push('admin');
              const newRole = existingRoles.join(',');

              if (logger) {
                logger.info(`Auto-promoting new user ${maskEmail(user.email)} to admin role during creation`);
              }

              // Return wrapped in data object - Better-Auth requirement
              return {
                data: {
                  ...user,
                  role: newRole
                }
              };
            }

            return { data: user }; // Return unchanged if already admin
          },
          after: async (user) => {
            // Auto-create person record so profile/dashboard work immediately
            try {
              const personRepo = new PersonRepository(database, logger);
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
                    const auditRepo = new AuditRepository(database, logger);
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
            try {
              const [userRow] = await database
                .select({ email: schema.user.email })
                .from(schema.user)
                .where(eq(schema.user.id, session.userId))
                .limit(1);
              if (userRow?.email) {
                clearFailedAttempts(userRow.email);
              }
            } catch (clearErr) {
              logger?.warn({ error: clearErr, userId: session.userId }, 'Failed to clear lockout on login');
            }

            try {
              const auditRepo = new AuditRepository(database, logger);
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
                ipAddress: session.ipAddress ?? undefined,
                userAgent: session.userAgent ?? undefined,
              });
            } catch (err) {
              logger?.warn({ error: err, userId: session.userId }, 'Failed to audit login event');
            }

            // V-15: Enforce concurrent session limit — revoke oldest sessions
            try {
              const limit = config.auth.sessionLimit ?? DEFAULT_SESSION_LIMIT;
              await enforceSessionLimit(database, session.userId, limit, logger);
            } catch (err) {
              logger?.warn({ error: err, userId: session.userId }, 'V-15: Failed to enforce session limit');
            }
          },
        },
        delete: {
          after: async (session: { id: string; userId: string }) => {
            try {
              const auditRepo = new AuditRepository(database, logger);
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
        sendChangeEmailVerification: async ({ user, newEmail, url, token }) => {
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
        enabled: true,
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
            await applyLockout(database, email, logger);
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
            (logFn as any).call(logger, message, ...args);
          }
        }
      },
    },
  });
}


/**
 * Register auth routes with the Hono app
 * Better-Auth handles all authentication endpoints
 */
export function registerRoutes(app: App): void {
  const { auth } = app;

  // Better-Auth handles all /auth/* routes with all HTTP methods
  app.all("/auth/*", (c) => auth.handler(c.req.raw));
}
