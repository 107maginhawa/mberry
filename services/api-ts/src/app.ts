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
import { registerDuesJobs } from '@/handlers/dues/jobs';

// Dues handler
import { dues } from '@/handlers/dues';

// Membership handler
import { membership } from '@/handlers/membership';

// Communications handler
import { communications } from '@/handlers/communications';

// Certificates handler
import { certificates } from '@/handlers/certificates';

// Events handler
import { eventsRouter } from '@/handlers/events';

// Training handler
import { trainingRouter } from '@/handlers/training';

// Elections handler
import { electionsRouter } from '@/handlers/elections';

// Routes
import { registerRoutes as registerOpenAPIRoutes } from '@/generated/openapi/routes';
import { registerRoutes as registerHealthRoutes } from '@/core/health';
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


/**
 * Create and configure the Hono application with proper dependency injection
 * Returns the Hono app instance with database, logger, auth, and storage attached
 */
export function createApp(config: Config): App {
  const app = new Hono<{ Variables: Variables }>();

  // Generate internal service token for secure service-to-service communication
  // Used for expand requests and future microservice communication
  // TODO: Move to config/env for production deployments
  const internalServiceToken = crypto.randomUUID();

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
  Object.assign(app, { database, logger, auth, storage, jobs, notifs, email, audit, ws, billing, internalServiceToken });

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

  // Register health check endpoints
  registerHealthRoutes(app as App);

  // Public endpoints (no auth required)
  app.get('/public/org/:slug', async (ctx) => {
    const { getOrganizationBySlug } = await import('@/handlers/platformadmin/getOrganizationBySlug');
    return getOrganizationBySlug(ctx as any);
  });

  // Custom membership endpoint (auth required)
  app.get('/persons/me/memberships', authMiddleware(), async (ctx) => {
    const { getMyMemberships } = await import('@/handlers/association:member/getMyMemberships');
    return getMyMemberships(ctx as any);
  });

  // Credit summary (lifetime total, auth required)
  app.get('/persons/me/credit-summary', authMiddleware(), async (ctx) => {
    const user = ctx.get('user');
    if (!user) return ctx.json({ error: 'Unauthorized' }, 401);
    const db = ctx.get('database') as any;
    const { CreditEntryRepository } = await import('@/handlers/association:member/repos/credits.repo');
    const repo = new CreditEntryRepository(db, ctx.get('logger'));
    const total = await repo.sumCreditsForCycle(
      user.id,
      new Date('2000-01-01'),
      new Date('2099-12-31'),
    );
    return ctx.json({ totalCredits: total }, 200);
  });

  // List officer terms for org (custom endpoint bypassing org-context)
  app.get('/officer-terms/:orgId', authMiddleware(), async (ctx) => {
    const orgId = ctx.req.param('orgId');
    const db = ctx.get('database') as any;
    const { OfficerTermRepository } = await import('@/handlers/association:member/repos/governance.repo');
    const { PositionRepository } = await import('@/handlers/association:member/repos/governance.repo');
    const termRepo = new OfficerTermRepository(db);
    const posRepo = new PositionRepository(db);
    const terms = await termRepo.findByOrg(orgId, orgId);
    const positions = await posRepo.findByOrg(orgId, orgId);
    const posMap = new Map(positions.map(p => [p.id, p.title]));

    // Fetch person names for each term
    const personIds = [...new Set(terms.map(t => t.personId))];
    const personMap = new Map<string, string>();
    if (personIds.length > 0) {
      const { persons } = await import('@/handlers/person/repos/person.schema');
      const { inArray } = await import('drizzle-orm');
      try {
        const pRows = await db.select({ id: persons.id, firstName: persons.firstName, lastName: persons.lastName })
          .from(persons)
          .where(inArray(persons.id, personIds));
        for (const p of pRows) {
          personMap.set(p.id, [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unknown');
        }
      } catch { /* fallback */ }
    }

    const data = terms.map((t: any) => ({
      id: t.id,
      positionId: t.positionId,
      positionTitle: posMap.get(t.positionId) || 'Unknown',
      personId: t.personId,
      personName: personMap.get(t.personId) || 'Unknown',
      status: t.status,
      startDate: t.startDate,
      endDate: t.endDate,
    }));
    return ctx.json({ data }, 200);
  });

  // Data export — DPA 2012 portability
  app.get('/persons/me/export', authMiddleware(), async (ctx) => {
    const { exportPersonData } = await import('@/handlers/person/exportPersonData');
    return exportPersonData(ctx as any);
  });

  // Account deletion — DPA 2012 / M-25 / BR-32
  app.post('/persons/me/delete', authMiddleware(), async (ctx) => {
    const { requestAccountDeletion } = await import('@/handlers/person/requestAccountDeletion');
    return requestAccountDeletion(ctx as any);
  });
  app.post('/persons/me/cancel-delete', authMiddleware(), async (ctx) => {
    const { cancelAccountDeletion } = await import('@/handlers/person/cancelAccountDeletion');
    return cancelAccountDeletion(ctx as any);
  });

  // Mark all notifications read (custom endpoint bypassing OpenAPI role check)
  app.post('/notifs/read-all', authMiddleware(), async (ctx) => {
    const user = ctx.get('user');
    if (!user) return ctx.json({ error: 'Unauthorized' }, 401);
    const db = ctx.get('database') as any;
    const { notifications } = await import('@/handlers/notifs/repos/notification.schema');
    const { eq, and, ne } = await import('drizzle-orm');
    await db.update(notifications)
      .set({ status: 'read', readAt: new Date() })
      .where(and(eq(notifications.recipient, user.id), ne(notifications.status, 'read')));
    return ctx.json({ success: true }, 200);
  });

  // Update own profile (custom endpoint accepting "me" — bypasses OpenAPI UUID validation)
  app.patch('/persons/me', authMiddleware(), async (ctx) => {
    const user = ctx.get('user');
    if (!user) return ctx.json({ error: 'Unauthorized' }, 401);
    const db = ctx.get('database') as any;
    const body: any = await ctx.req.json();
    const { persons } = await import('@/handlers/person/repos/person.schema');
    const { eq } = await import('drizzle-orm');
    const updateData: any = { updatedAt: new Date() };
    if (body.firstName !== undefined) updateData.firstName = body.firstName;
    if (body.lastName !== undefined) updateData.lastName = body.lastName;
    if (body.middleName !== undefined) updateData.middleName = body.middleName;
    if (body.specialization !== undefined) updateData.specialization = body.specialization;
    if (body.dateOfBirth !== undefined) updateData.dateOfBirth = body.dateOfBirth;
    if (body.gender !== undefined) updateData.gender = body.gender;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.timezone !== undefined) updateData.timezone = body.timezone;
    if (body.preferredLanguage !== undefined) updateData.preferredLanguage = body.preferredLanguage;
    const [updated] = await db.update(persons).set(updateData).where(eq(persons.id, user.id)).returning();
    if (!updated) return ctx.json({ error: 'Person not found' }, 404);
    return ctx.json(updated, 200);
  });

  // Manual credit entry (auth required — BR-13)
  app.post('/persons/me/credit-entries', authMiddleware(), async (ctx) => {
    const user = ctx.get('user');
    if (!user) return ctx.json({ error: 'Unauthorized' }, 401);
    const db = ctx.get('database') as any;
    const body = await ctx.req.json();
    const { creditEntries } = await import('@/handlers/association:member/repos/credits.schema');
    // Get user's first org for tenantId/orgId (required NOT NULL fields)
    const { memberships } = await import('@/handlers/association:member/repos/membership.schema');
    const { eq: eqOp } = await import('drizzle-orm');
    const [firstMembership] = await db.select({ orgId: memberships.orgId })
      .from(memberships).where(eqOp(memberships.personId, user.id)).limit(1);
    const orgId = body.organizationId || firstMembership?.orgId;
    if (!orgId) return ctx.json({ error: 'No organization membership found' }, 400);

    const now = new Date();
    const cycleStart = new Date(now.getFullYear(), 0, 1); // Jan 1 of current year
    const cycleEnd = new Date(now.getFullYear(), 11, 31); // Dec 31 of current year
    const [entry] = await db.insert(creditEntries).values({
      personId: user.id,
      organizationId: orgId,
      tenantId: orgId,
      activityName: body.activityName,
      activityDate: body.activityDate ? new Date(body.activityDate) : now,
      creditAmount: body.creditAmount || 0,
      type: 'manual',
      cycleStart,
      cycleEnd,
    }).returning();
    return ctx.json({ data: entry }, 201);
  });

  // Credit entries list (auth required)
  app.get('/persons/me/credit-entries', authMiddleware(), async (ctx) => {
    const user = ctx.get('user');
    if (!user) return ctx.json({ error: 'Unauthorized' }, 401);
    const db = ctx.get('database') as any;
    const { creditEntries } = await import('@/handlers/association:member/repos/credits.schema');
    const { eq, desc } = await import('drizzle-orm');
    const rows = await db.select().from(creditEntries)
      .where(eq(creditEntries.personId, user.id))
      .orderBy(desc(creditEntries.activityDate))
      .limit(50);
    return ctx.json({ data: rows }, 200);
  });

  // Credit compliance report for officers (auth required)
  app.get('/credit-compliance/:orgId', authMiddleware(), async (ctx) => {
    const db = ctx.get('database') as any;
    const orgId = ctx.req.param('orgId');
    const { sql } = await import('drizzle-orm');
    const requiredCredits = 40; // default per cycle

    const rows = await db.execute(sql`
      SELECT
        m.person_id,
        p.first_name,
        p.last_name,
        m.member_number,
        m.status as membership_status,
        COALESCE(SUM(c.credit_amount), 0)::int as earned,
        ${requiredCredits} as required,
        GREATEST(${requiredCredits} - COALESCE(SUM(c.credit_amount), 0), 0)::int as remaining,
        CASE
          WHEN COALESCE(SUM(c.credit_amount), 0) >= ${requiredCredits} THEN 'compliant'
          WHEN COALESCE(SUM(c.credit_amount), 0) >= ${requiredCredits} * 0.5 THEN 'at_risk'
          ELSE 'non_compliant'
        END as compliance_status
      FROM membership m
      JOIN person p ON m.person_id = p.id
      LEFT JOIN credit_entry c ON c.person_id = m.person_id AND c.organization_id = m.org_id
      WHERE m.org_id = ${orgId} AND m.status IN ('active', 'gracePeriod')
      GROUP BY m.person_id, p.first_name, p.last_name, m.member_number, m.status
      ORDER BY COALESCE(SUM(c.credit_amount), 0) ASC
    `);

    const data = (rows as any).rows ?? rows ?? [];
    const compliant = data.filter((r: any) => r.compliance_status === 'compliant').length;
    const atRisk = data.filter((r: any) => r.compliance_status === 'at_risk').length;
    const nonCompliant = data.filter((r: any) => r.compliance_status === 'non_compliant').length;

    return ctx.json({
      data,
      summary: { compliant, atRisk, nonCompliant, total: data.length, requiredCredits },
    }, 200);
  });

  // Officer role check (auth required)
  app.get('/persons/me/officer-role/:orgId', authMiddleware(), async (ctx) => {
    const { getMyOfficerRole } = await import('@/handlers/association:member/getMyOfficerRole');
    return getMyOfficerRole(ctx as any);
  });

  // Custom person endpoints (privacy + notification preferences, auth required)
  app.get('/persons/me/privacy', authMiddleware(), async (ctx) => {
    const { getPrivacySettings } = await import('@/handlers/person/getPrivacySettings');
    return getPrivacySettings(ctx as any);
  });
  app.patch('/persons/me/privacy', authMiddleware(), async (ctx) => {
    const { updatePrivacySettings } = await import('@/handlers/person/updatePrivacySettings');
    return updatePrivacySettings(ctx as any);
  });
  app.get('/persons/me/notification-preferences', authMiddleware(), async (ctx) => {
    const { getNotificationPreferences } = await import('@/handlers/person/getNotificationPreferences');
    return getNotificationPreferences(ctx as any);
  });
  app.patch('/persons/me/notification-preferences', authMiddleware(), async (ctx) => {
    const { updateNotificationPreferences } = await import('@/handlers/person/updateNotificationPreferences');
    return updateNotificationPreferences(ctx as any);
  });

  // Register auth routes
  registerAuthRoutes(app as App);

  // Auth middleware for all custom module routes
  // These were previously unprotected — any request could reach handlers
  app.use('/dues/*', authMiddleware());
  app.use('/membership/*', authMiddleware());
  app.use('/communications/*', authMiddleware());
  app.use('/certificates/*', authMiddleware());
  app.use('/events/*', authMiddleware());
  app.use('/training/*', authMiddleware());
  app.use('/elections/*', authMiddleware());

  // Register module routes (no /api prefix — Vite proxy strips it)
  app.route('/dues', dues);
  app.route('/membership', membership);
  app.route('/communications', communications);
  app.route('/certificates', certificates);
  app.route('/events', eventsRouter);
  app.route('/training', trainingRouter);
  app.route('/elections', electionsRouter);

  // Platform admin authorization — auth first (sets user), then check platform_admin table
  app.use('/admin/*', authMiddleware(), platformAdminAuthMiddleware());

  // Platform admin role check endpoint (used by admin app guard)
  app.get('/admin/me/role', async (ctx) => {
    const admin = ctx.get('platformAdmin');
    if (!admin) return ctx.json({ error: 'Not a platform admin' }, 403);
    return ctx.json({ role: admin.role, email: admin.email, name: admin.name }, 200);
  });

  // Register API routes
  registerOpenAPIRoutes(app as any);

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
    logger.debug('Running database migrations...');
    await runMigrations(database);
    logger.debug('Database migrations completed successfully');
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
