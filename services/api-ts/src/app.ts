/**
 * Main server setup with Hono, Better-Auth, and generated routes
 * Uses factory pattern for dependency injection with proper cleanup support
 */

import { Hono } from 'hono';
import type { Variables, App } from '@/types/app';
import type { Config } from '@/core/config';

// Core dependencies
import { createAuth } from '@/core/auth';
import { ensureAdminUsers } from '@/utils/auth';
import { createDatabase, checkDatabaseConnection, closeDatabaseConnection, runMigrations, type DatabaseInstance } from '@/core/database';
import { createJobScheduler } from '@/core/jobs';
import { createLogger } from '@/core/logger';
import { createStorageProvider } from '@/core/storage';
import { createNotificationService } from '@/core/notifs';
import { createEmailService } from '@/core/email';
import { createAuditService } from '@/core/audit';
import { createWebSocketService } from '@/core/ws';
import { createBillingService } from '@/core/billing';
import { registerEmailJobs } from '@/handlers/email/jobs';
import { registerNotifsJobs } from '@/handlers/notifs/jobs';
import { registerAuditJobs } from '@/handlers/audit/jobs';
import { registerBookingJobs } from '@/handlers/booking/jobs';
import { registerDuesJobs } from '@/handlers/association:member/jobs';
import { registerPersonJobs } from '@/handlers/person/jobs';
import { registerMembershipJobs } from '@/handlers/membership/jobs';

// Routes
import { registerRoutes as registerOpenAPIRoutes } from '@/generated/openapi/routes';
import { registerRoutes as registerHealthRoutes } from '@/core/health';
import { registerMetricsMiddleware, registerMetricsRoute } from '@/core/metrics';
import { registerRoutes as registerFeatureFlagRoutes } from '@/core/feature-flags';
import { registerRoutes as registerAuthRoutes } from '@/core/auth';
import { registerRoutes as registerDocsRoutes } from '@/core/openapi';
import { registerRoutes as registerWebSocketRoutes } from '@/generated/websocket/registry';
import { registerHandlers as registerErrorHandlers } from '@/core/errors';

// OpenAPI Specifications
import typespecOpenapi from '@monobase/api-spec/openapi.json';
import betterAuthOpenapi from '@/generated/better-auth/openapi.json';
import healthOpenapi from '@/core/health.openapi.json';

// Middleware
import { createRequestId, createRequestLogger } from '@/middleware/request';
import { createDependencyInjection } from '@/middleware/dependency';
import { createSecurityHeaders, createCorsMiddleware } from '@/middleware/security';
import { authMiddleware } from '@/middleware/auth';
import { platformAdminAuthMiddleware } from '@/middleware/platform-admin-auth';
import { createAuditMiddleware } from '@/middleware/audit';
import { createRateLimiter } from '@/middleware/rate-limit';
import { orgContextMiddleware, orgContextOptionalMiddleware } from '@/middleware/org-context';
import { impersonationResolver, impersonationWriteBlock } from '@/middleware/impersonation-guard';

// PRC Accredited Providers — hand-wired because these are org-scoped training
// routes (not in provider.tsp which covers healthcare provider profiles).
// Registered after registerOpenAPIRoutes() with explicit authMiddleware().
import { listAccreditedProviders } from '@/handlers/training/listAccreditedProviders';
import { createAccreditedProvider } from '@/handlers/training/createAccreditedProvider';
import { updateAccreditedProvider } from '@/handlers/training/updateAccreditedProvider';
import { deleteAccreditedProvider } from '@/handlers/training/deleteAccreditedProvider';

// Email: hand-wired for middleware ordering reasons.
// - unsubscribeEmail: MUST be registered BEFORE /email/* auth middleware (RFC 8058 public access)
// - listEmailSuppressions: registered AFTER /email/* auth middleware (officer-only)
import { unsubscribeEmail } from '@/handlers/email/unsubscribeEmail';
import { listEmailSuppressions } from '@/handlers/email/listEmailSuppressions';

// Event lifecycle: completeEvent hand-wired (not yet in TypeSpec)
import { completeEvent } from '@/handlers/association:operations/completeEvent';


/**
 * Create and configure the Hono application with proper dependency injection
 * Returns the Hono app instance with database, logger, auth, and storage attached
 */
export function createApp(config: Config): App {
  const app = new Hono<{ Variables: Variables }>();

  // P1-2: Internal service token — config-driven, supports rotation
  const internalServiceToken = config.internalService.activeToken;
  const internalServiceTokens = config.internalService.allTokens;

  // Create core dependencies with config
  const logger = createLogger(config);
  const database = createDatabase(config.database);
  const email = createEmailService(database, config, logger);
  const auth = createAuth(database, config, logger, email);
  const storage = createStorageProvider(config.storage, logger);
  const jobs = createJobScheduler(database, logger);
  const ws = createWebSocketService(logger);

  const notifs = createNotificationService(database, logger, config.notifs, ws);
  const audit = createAuditService(database, logger);
  const billing = createBillingService(config.billing, database, logger);

  // Attach dependencies to the app instance early for access throughout
  Object.assign(app, { database, logger, auth, storage, jobs, notifs, email, audit, ws, billing, internalServiceToken, internalServiceTokens });

  // Global middleware - order matters!

  // Request ID generation - Needed for all logging
  app.use('*', createRequestId(config));

  // Dependency injection - Inject logger, database, storage, auth, jobs early
  app.use('*', createDependencyInjection(app as App, config));

  // Audit trail - Automatically log all write operations (POST/PUT/PATCH/DELETE)
  app.use('*', createAuditMiddleware());

  // Request logger - Log all incoming requests
  app.use('*', createRequestLogger(config));

  // Security headers - Lightweight, security critical
  app.use('*', createSecurityHeaders(config));

  // CORS - Required early for preflight
  app.use('*', createCorsMiddleware(config, logger));

  // P1-5: Global rate limiting for custom endpoints (auth routes handled by Better-Auth)
  app.use('*', createRateLimiter());

  // Impersonation: resolve cookie → context, then block writes if impersonating
  app.use('*', impersonationResolver());
  app.use('*', impersonationWriteBlock());

  // Register metrics middleware (before routes, after app creation)
  registerMetricsMiddleware(app as App);

  // Register health check + metrics endpoints
  registerHealthRoutes(app as App);
  registerMetricsRoute(app as App);

  // Register feature flags endpoint (public, no auth)
  registerFeatureFlagRoutes(app as App);

  // Register auth routes
  registerAuthRoutes(app as App);

  // Platform admin authorization — auth first (sets user), then check platform_admin table
  app.use('/admin/*', authMiddleware(), platformAdminAuthMiddleware());

  // Public unsubscribe endpoint — registered BEFORE /email/* auth middleware
  // RFC 8058: users click from email client without being logged in
  app.get('/email/unsubscribe', unsubscribeEmail);
  app.post('/email/unsubscribe', unsubscribeEmail);

  // Org-context for email routes (admin creates templates per-org)
  // Auth middleware sets user/session; orgContextMiddleware sets orgId from request
  app.use('/email/*', authMiddleware());
  app.use('/email/*', orgContextMiddleware());

  // Officer-only suppression list (auth-protected, registered after auth middleware)
  app.get('/email/suppressions', listEmailSuppressions);

  // Public association endpoints that must NOT have auth middleware
  const ASSOCIATION_PUBLIC_PATHS = [
    '/association/member/credentials/public-verify',
    '/association/member/ethics/public-complaints',
    '/association/member/ethics/public-complaint',
    '/association/member/directory/public',
    '/association/member/directory/search', // covers /search/:personId/public
  ];

  // Auth middleware for all association routes EXCEPT public endpoints
  app.use('/association/*', async (c, next) => {
    const path = new URL(c.req.url).pathname;
    if (ASSOCIATION_PUBLIC_PATHS.some(p => path.startsWith(p))) {
      return next();
    }
    return authMiddleware()(c, next);
  });
  // Org-context middleware for association routes EXCEPT public endpoints
  app.use('/association/*', async (c, next) => {
    const path = new URL(c.req.url).pathname;
    if (ASSOCIATION_PUBLIC_PATHS.some(p => path.startsWith(p))) {
      return next();
    }
    return orgContextMiddleware()(c, next);
  });

  // Fail-open org-context for non-association routes that optionally use organizationId.
  // No auth override — per-route auth in generated routes stays as-is.
  // Skips silently when no user or no org context (webhooks, public discovery, etc.)
  for (const prefix of ['/billing/*', '/booking/*', '/comms/*', '/storage/*', '/reviews/*', '/audit/*', '/persons/*']) {
    app.use(prefix, orgContextOptionalMiddleware());
  }

  // Register API routes
  registerOpenAPIRoutes(app as unknown as Parameters<typeof registerOpenAPIRoutes>[0]); // structural: Hono app type narrowing

  // completeEvent — hand-wired (not yet in TypeSpec), follows cancelEvent pattern
  app.post('/association/events/:eventId/complete', authMiddleware(), completeEvent as any);

  // PRC Accredited Providers — hand-wired, org-scoped (no /api prefix per CLAUDE.md)
  app.get('/accredited-providers/:organizationId', authMiddleware(), listAccreditedProviders);
  app.post('/accredited-providers/:organizationId', authMiddleware(), createAccreditedProvider);
  app.patch('/accredited-providers/:organizationId/:providerId', authMiddleware(), updateAccreditedProvider);
  app.delete('/accredited-providers/:organizationId/:providerId', authMiddleware(), deleteAccreditedProvider);

  // Register WebSocket handlers
  registerWebSocketRoutes(app as App);

  // Register documentation routes with multiple OpenAPI specs
  registerDocsRoutes(app as App, [typespecOpenapi, betterAuthOpenapi, healthOpenapi], config);

  // Register error handlers - must be last!
  registerErrorHandlers(app as App, config);

  return app as App;
}

/**
 * Initialize application components and dependencies
 * Handles database, admin users, and job scheduler initialization
 */
export async function initializeApp(app: App, config: Config): Promise<void> {
  const { database, logger, jobs } = app;

  // Run database migrations (skip when an embedded host injected a pre-built
  // Drizzle instance — that host owns schema management).
  if (config.database.instance) {
    logger.debug('Skipping migrations: pre-built database instance was injected');
  } else {
    if (process.env['SKIP_MIGRATIONS'] === 'true') {
      logger.debug('Skipping migrations: SKIP_MIGRATIONS=true');
    } else {
      logger.debug('Running database migrations...');
      await runMigrations(database);
      logger.debug('Database migrations completed successfully');
    }
  }

  // Initialize email templates
  logger.debug('Initializing email templates...');
  await app.email.initializeDefaultTemplates();
  logger.debug('Email templates initialized successfully');

  // Setup admin users if configured
  if (config.auth.adminEmails && config.auth.adminEmails.length > 0) {
    logger.debug('Setting up admin users...');
    const promotedEmails = await ensureAdminUsers(database, config.auth.adminEmails);
    if (promotedEmails.length > 0) {
      logger.info({ promotedEmails }, `Promoted ${promotedEmails.length} users to admin role`);
    } else {
      logger.debug('No existing users found to promote to admin role');
    }
    logger.debug('Admin user setup completed successfully');
  }

  // Initialize and start background job scheduler
  registerEmailJobs(jobs, app.email);
  registerNotifsJobs(jobs, app.notifs);
  registerAuditJobs(jobs);
  registerBookingJobs(jobs, app.notifs);
  registerDuesJobs(jobs);
  registerPersonJobs(jobs);
  registerMembershipJobs(jobs, app.notifs);

  logger.debug('Starting background job scheduler...');
  await jobs.start();
  logger.debug('Background job scheduler started successfully');
}

/**
 * Cleanup helper function for graceful shutdown
 * Extracts database, logger, auth, and storage from the app instance and performs cleanup
 */
export async function cleanupApp(app: App): Promise<void> {
  const { database, logger, jobs } = app;
  
  logger.debug('Cleaning up application resources...');
  
  // Shutdown job scheduler first
  if (jobs) {
    logger.debug('Shutting down job scheduler...');
    await jobs.shutdown();
    logger.debug('Job scheduler shutdown successfully');
  }
  
  // Gracefully close db conn 
  await closeDatabaseConnection(database);
  logger.debug('Database connection closed successfully');
}
