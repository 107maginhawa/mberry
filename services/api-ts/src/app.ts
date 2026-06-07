/**
 * Main server setup with Hono, Better-Auth, and generated routes
 * Uses factory pattern for dependency injection with proper cleanup support
 */

import { Hono, type Handler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { csrf } from 'hono/csrf';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { validationErrorHandler } from '@/middleware/validation';
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
import { bindMembershipsTable } from '@/core/org-scoped-persons';
import { AuditRepository } from '@/handlers/audit/repos/audit.repo';
import { NotificationRepository } from '@/handlers/notifs/repos/notification.repo';
import { PersonRepository } from '@/handlers/person/repos/person.repo';
import { EmailTemplateRepository } from '@/handlers/email/repos/template.repo';
import { EmailQueueRepository } from '@/handlers/email/repos/queue.repo';
import { SuppressionRepository } from '@/handlers/email/repos/suppression.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { memberships } from '@/handlers/association:member/repos/membership.schema';
import { BulkRateLimiter } from '@/handlers/email/utils/bulk-rate-limiter';
import { generateUnsubToken } from '@/handlers/email/utils/unsub-token';
import { initializeEmailTemplates } from '@/handlers/email/templates/initializer';
import { createWebSocketService } from '@/core/ws';
import { createBillingService } from '@/core/billing';
import { registerEmailJobs } from '@/handlers/email/jobs';
import { registerNotifsJobs } from '@/handlers/notifs/jobs';
import { registerAuditJobs } from '@/handlers/audit/jobs';
import { registerBookingJobs } from '@/handlers/booking/jobs';
import { registerDuesJobs, registerStatusRecomputeJob } from '@/handlers/association:member/jobs';
import { registerPersonJobs } from '@/handlers/person/jobs';
import { registerMembershipJobs } from '@/handlers/membership/jobs';
import { registerSurveyJobs } from '@/handlers/surveys/jobs';
import { registerBreachJobs, registerTicketJobs, registerTrialExpiryMonitor, registerPastDueMonitor } from '@/handlers/platformadmin/jobs';
import { registerDomainEventConsumers } from '@/core/domain-event-consumers';

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
import { createTracingMiddleware } from '@/core/observability';
import { createRequestId, createRequestLogger } from '@/middleware/request';
import { createDependencyInjection } from '@/middleware/dependency';
import { createSecurityHeaders, createCorsMiddleware } from '@/middleware/security';
import { createCsrfTokenMiddleware, registerCsrfTokenEndpoint } from '@/middleware/csrf-token';
import { authMiddleware } from '@/middleware/auth';
import { platformAdminAuthMiddleware } from '@/middleware/platform-admin-auth';
import { createAuditMiddleware } from '@/middleware/audit';
import { createRateLimiter } from '@/middleware/rate-limit';
import { orgContextMiddleware, orgContextOptionalMiddleware } from '@/middleware/org-context';
import { impersonationResolver, impersonationWriteBlock } from '@/middleware/impersonation-guard';

// PRC Accredited Providers — MIGRATED to generated routes (association:operations).
// Training lifecycle — MIGRATED to generated routes (completeCustomTraining, publishTraining).

// Elections: deleteElection — MIGRATED to generated routes (Phase 35,
// /association/member/elections/{electionId}).

// Email: hand-wired for middleware ordering reasons.
// - unsubscribeEmail: MUST be registered BEFORE /email/* auth middleware (RFC 8058 public access)
// - listEmailSuppressions: registered AFTER /email/* auth middleware (officer-only)
import { unsubscribeEmail } from '@/handlers/email/unsubscribeEmail';
import { listEmailSuppressions } from '@/handlers/email/listEmailSuppressions';

// Saved Segments — now in generated routes (Phase 35)
// Communications: schedule + stats (hand-wired, Cycle 8)
import { scheduleAnnouncement } from '@/handlers/communication/scheduleAnnouncement';
import { getAnnouncementStats } from '@/handlers/communication/getAnnouncementStats';

// Documents: byte download (hand-wired, see handler header — browser GET, no x-org-id)
import { downloadDocument } from '@/handlers/documents/downloadDocument';
// Stripe webhook endpoint (hand-wired, must precede auth middleware)
import { stripeWebhookHandler } from '@/handlers/member/duesspecialassessments/stripeWebhook';
// National dashboard export (hand-wired, Cycle 8)
import { exportNationalDashboard } from '@/handlers/association:operations/exportNationalDashboard';

// Survey extras — hand-wired (export returns CSV, clone is convenience endpoint)
import { exportSurveyResponses } from '@/handlers/surveys/exportSurveyResponses';
import { cloneSurvey } from '@/handlers/surveys/cloneSurvey';
import { getNpsTrends } from '@/handlers/surveys/getNpsTrends';
import { listAdminSurveys } from '@/handlers/surveys/listAdminSurveys';
import { deleteMemberResponses } from '@/handlers/surveys/deleteMemberResponses';

// completeEvent now served via generated TypeSpec route (was hand-wired, duplicate removed)
// validatePaymentToken / checkoutPaymentToken / downloadReceipt — migrated to generated routes
// (Member/DuesSpecialAssessments cutover); hand-wired duplicates removed.

// Public org discovery — hand-wired (not yet in TypeSpec)
import { listPublicOrgs } from '@/handlers/platformadmin/listPublicOrgs';
import { createIsolatedFixture, deleteIsolatedFixture } from '@/handlers/test-isolation';

// Breach notification handlers — DPA 2012 / M3-R11
import { reportBreach } from '@/handlers/platformadmin/reportBreach';
import { listBreaches } from '@/handlers/platformadmin/listBreaches';
import { updateBreachStatus } from '@/handlers/platformadmin/updateBreachStatus';

// Support ticket SLA system — M3-R12
import { createTicket } from '@/handlers/platformadmin/createTicket';
import { listTickets } from '@/handlers/platformadmin/listTickets';
import { getTicket } from '@/handlers/platformadmin/getTicket';
import { updateTicketStatus } from '@/handlers/platformadmin/updateTicketStatus';
import { addTicketComment } from '@/handlers/platformadmin/addTicketComment';

// getNationalDashboard, listAllCommittees, getCommittee — served via generated routes (Phase 35)

// OG meta route for social sharing crawlers (WhatsApp, Facebook, Twitter)
import { serveEventOgMeta } from '@/handlers/events/serveEventOgMeta';
import { cancelRegistration } from '@/handlers/events/cancelRegistration';

// Public credential lookup (Wave 3a — Trust Directory)
import { lookupCredentialPublic } from '@/handlers/member/credentials/lookupCredentialPublic';

// ID card — JSON + PDF download (UJ-M02)
import { getMyIdCard } from '@/handlers/person/getMyIdCard';
import { getMyIdCardPdf } from '@/handlers/person/getMyIdCardPdf';
import { getCreditTranscript } from '@/handlers/member/credits/getCreditTranscript';
import { getCreditTranscriptPdf } from '@/handlers/member/credits/getCreditTranscriptPdf';
import { requestDataExport } from '@/handlers/person/requestDataExport';
import { getDataExportStatus } from '@/handlers/person/getDataExportStatus';
import { getDataExportDownload } from '@/handlers/person/getDataExportDownload';

// Wave 2b: Credit pipeline, CPD config, compliance, certificates
// getCpdConfig, updateCpdConfig, awardManualCredit, getComplianceReport, refreshCompliance —
// migrated to generated routes (member-credits cutover); orphan imports removed.
import { getMyCredits } from '@/handlers/person/getMyCredits';
// bulkIssueCertificates + verifyCertificatePublic — in generated routes
import { generateCertificatePdf } from '@/handlers/member/certificates/generateCertificatePdf';

// Special Assessments — now in generated routes (Phase 35)

// Officer transition — hand-wired (M4-R3 checklist-based handover, not in TypeSpec)
import { transitionOfficerTerm } from '@/handlers/association:member/transitionOfficerTerm';

// Org-wide dashboard — M4-DASHBOARD AC-M04-005 (hand-wired, not in TypeSpec)
import { getOrgDashboard } from '@/handlers/association:member/getOrgDashboard';

// voidCreditEntry — migrated to generated routes (member-credits cutover); hand-wired duplicate removed.

// Subscription system (UJ-M03) — pricing tier management and org subscriptions
import { listPricingTiers } from '@/handlers/platformadmin/listPricingTiers';
import { createPricingTier } from '@/handlers/platformadmin/createPricingTier';
import { updatePricingTier } from '@/handlers/platformadmin/updatePricingTier';
import { listSubscriptions } from '@/handlers/platformadmin/listSubscriptions';
import { getSubscription } from '@/handlers/platformadmin/getSubscription';
import { cancelSubscription } from '@/handlers/platformadmin/cancelSubscription';
import { getRevenueAnalytics } from '@/handlers/platformadmin/getRevenueAnalytics';
import { getOrgHealthScores } from '@/handlers/platformadmin/getOrgHealthScores';
import { getMySubscription } from '@/handlers/association:member/getMySubscription';
import { upgradeSubscription } from '@/handlers/association:member/upgradeSubscription';
import { createSubscriptionCheckout } from '@/handlers/association:member/createSubscriptionCheckout';

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

  // Construct repos here, inject into services (P1-2: core→handler dependency inversion)
  const auditRepo = new AuditRepository(database, logger);
  const personRepo = new PersonRepository(database, logger);
  const emailTemplateRepo = new EmailTemplateRepository(database, logger);
  const emailQueueRepo = new EmailQueueRepository(database, logger);
  const suppressionRepo = new SuppressionRepository(database, logger);
  const membershipRepo = new MembershipRepository(database, logger);
  const notifRepo = new NotificationRepository(database, personRepo, logger, config.notifs.onesignal);

  // Bind Drizzle table refs for core modules (P1-2: avoids core→handler schema imports)
  bindMembershipsTable(memberships as any);

  // Register domain event consumers (cross-module event bus)
  registerDomainEventConsumers({ membershipRepo, db: database }, logger);

  const email = createEmailService(config, logger, database, {
    templateRepo: emailTemplateRepo,
    queueRepo: emailQueueRepo,
    suppressionRepo,
    membershipLookup: membershipRepo,
    bulkRateLimiter: new BulkRateLimiter(),
    generateUnsubToken,
    initializeTemplates: initializeEmailTemplates,
  });
  const auth = createAuth(database, config, logger, email, { auditRepo, personRepo });
  const storage = createStorageProvider(config.storage, logger);
  const jobs = createJobScheduler(database, logger);
  const ws = createWebSocketService(logger);

  const notifs = createNotificationService(notifRepo, ws, logger);
  const audit = createAuditService(auditRepo);
  const billing = createBillingService(config.billing, database, logger);

  // Attach dependencies to the app instance early for access throughout
  Object.assign(app, { database, logger, auth, storage, jobs, notifs, email, audit, ws, billing, internalServiceToken, internalServiceTokens });

  // Global middleware - order matters!

  // Request ID generation - Needed for all logging
  app.use('*', createRequestId(config));

  // OpenTelemetry tracing — produces a server span per request, propagates
  // W3C traceparent context. No-op when OTEL_EXPORTER_OTLP_ENDPOINT unset.
  // Wired AFTER createRequestId so spans can carry the request.id attribute.
  app.use('*', createTracingMiddleware());

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

  // CSRF protection — origin verification + Sec-Fetch-Site header check
  // Blocks cross-origin state-changing requests (POST/PUT/PATCH/DELETE)
  // Uses same origins as CORS config for consistency
  app.use('*', csrf({ origin: config.cors.origins }));

  // CSRF token endpoint — issues double-submit token cookie + JSON body.
  // Must be registered BEFORE the token-enforcement middleware below so it
  // can answer requests that don't yet have a token.
  // @hand-wired reason="bootstrap endpoint for double-submit CSRF token; consumed by SDK provider before any TypeSpec route resolves" wave="by-design" oli-trace-accept="code-only"
  registerCsrfTokenEndpoint(app);

  // CSRF defense-in-depth: double-submit cookie pattern.
  // Above the origin check, this forces the requesting page to read a
  // same-origin cookie and mirror it into the x-csrf-token header — which a
  // pure CSRF attack cannot do. Webhooks and the public unsubscribe endpoint
  // intentionally precede auth and have their own integrity story; allowlist
  // those prefixes. See docs/product/THREAT_MODEL.md §A04 for rationale.
  app.use(
    '*',
    createCsrfTokenMiddleware({
      allowlist: [
        '/webhooks/',          // Stripe webhook signature is the integrity story
        '/email/unsubscribe',  // RFC 8058 List-Unsubscribe (signed token in query)
        '/pay/',               // signed one-tap payment token in URL
        '/auth/',              // Better-Auth has its own CSRF + cookie story
        '/test/',              // G10 test-only fixture endpoints (NODE_ENV-gated above)
      ],
    }),
  );

  // Body size limits — prevent large payload DoS
  app.use('*', bodyLimit({ maxSize: 1 * 1024 * 1024, onError: (c) => c.json({ error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE', maxSize: '1MB' }, 413) }));
  // Upload routes get higher limit (10MB)
  app.use('/storage/*', bodyLimit({ maxSize: 10 * 1024 * 1024, onError: (c) => c.json({ error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE', maxSize: '10MB' }, 413) }));
  app.use('/documents/*', bodyLimit({ maxSize: 10 * 1024 * 1024, onError: (c) => c.json({ error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE', maxSize: '10MB' }, 413) }));

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

  // @hand-wired reason="public discovery, not in TypeSpec" wave="pre-migration"
  app.get('/public/orgs', listPublicOrgs as unknown as Handler);

  // @hand-wired reason="test-only fixture isolation, never registered in production" wave="G10"
  // Routes themselves are guarded by NODE_ENV !== 'production' (handler
  // returns 404 if the gate trips), AND we skip registration entirely
  // here so they don't even appear in the route table in prod.
  if (process.env['NODE_ENV'] !== 'production') {
    app.post('/test/isolated-fixture', createIsolatedFixture as unknown as Handler);
    app.delete('/test/isolated-fixture/:orgId', deleteIsolatedFixture as unknown as Handler);
  }

  // @hand-wired reason="prospective applicants must see tiers before they're members" wave="G12"
  // /association/member/tiers requires association:member role — applicants
  // by definition don't have it. Mirror the tier-list handler here under
  // /public/* so the apply dialog can populate.
  app.get('/public/org/:orgId/tiers', async (c) => {
    const { orgId } = c.req.param();
    const db = c.get('database') as DatabaseInstance;
    const { membershipTiers } = await import('@/handlers/association:member/repos/membership.schema');
    const { eq } = await import('drizzle-orm');
    const rows = await db.select().from(membershipTiers).where(eq(membershipTiers.organizationId, orgId));
    return c.json({ data: rows });
  });

  // @hand-wired reason="HTML og:meta for social crawlers, not REST" wave="by-design"
  const slugParam = zValidator('param', z.object({ slug: z.string().min(1).max(512) }), validationErrorHandler);
  app.get('/og/events/:slug', slugParam, serveEventOgMeta as unknown as Handler);

  // @hand-wired reason="public credential lookup, no auth by design" wave="Wave-3a"
  const credentialNumberParam = zValidator('param', z.object({ credentialNumber: z.string().min(1).max(512) }), validationErrorHandler);
  app.get('/association/member/credentials/lookup/:credentialNumber', credentialNumberParam, lookupCredentialPublic as unknown as Handler);

  // Register auth routes
  registerAuthRoutes(app as App);

  // Platform admin authorization — auth first (sets user), then check platform_admin table
  app.use('/admin/*', authMiddleware(), platformAdminAuthMiddleware());

  // getNationalDashboard, listAllCommittees, getCommittee — migrated to generated routes (Phase 35)
  const assocIdParam = zValidator('param', z.object({ associationId: z.string().uuid() }), validationErrorHandler);
  const uuidIdParam = zValidator('param', z.object({ id: z.string().uuid() }), validationErrorHandler);

  // @hand-wired reason="DPA 2012 breach notification, admin-only" wave="M3-R11"
  const reportBreachBody = zValidator('json', z.object({
    organizationId: z.string().uuid().optional(),
    discoveredAt: z.string().min(1),
    description: z.string().min(1).max(5000),
    affectedRecordsCount: z.number().int().nonnegative().optional(),
    dataCategories: z.array(z.enum(['personal', 'sensitive_personal', 'health', 'financial', 'biometric', 'genetic', 'criminal'])).optional(),
  }), validationErrorHandler);
  app.post('/admin/breaches', reportBreachBody, reportBreach as unknown as Handler);
  app.get('/admin/breaches', listBreaches as unknown as Handler);
  const breachStatusBody = zValidator('json', z.object({
    status: z.enum(['investigating', 'notified', 'resolved']),
    npcReferenceNumber: z.string().min(1).max(255).optional(),
  }), validationErrorHandler);
  app.put('/admin/breaches/:id', uuidIdParam, breachStatusBody, updateBreachStatus as unknown as Handler);

  // @hand-wired reason="support ticket SLA system, not in TypeSpec" wave="M3-R12"
  const createTicketBody = zValidator('json', z.object({
    subject: z.string().min(1).max(500),
    description: z.string().min(1).max(10000),
    category: z.enum(['general', 'billing', 'technical', 'account', 'compliance']).optional(),
    priority: z.enum(['critical', 'high', 'standard', 'low']).optional(),
    organizationId: z.string().uuid().optional(),
  }), validationErrorHandler);
  app.post('/support/tickets', authMiddleware(), createTicketBody, createTicket as unknown as Handler);
  app.get('/admin/tickets', listTickets as unknown as Handler);
  app.get('/admin/tickets/:id', uuidIdParam, getTicket as unknown as Handler);
  const ticketStatusBody = zValidator('json', z.object({
    status: z.string().min(1).max(50),
    assignedTo: z.string().uuid().optional(),
    resolution: z.string().max(5000).optional(),
  }).passthrough(), validationErrorHandler);
  app.put('/admin/tickets/:id', uuidIdParam, ticketStatusBody, updateTicketStatus as unknown as Handler);
  const ticketCommentBody = zValidator('json', z.object({
    comment: z.string().min(1).max(5000),
    internal: z.boolean().optional(),
  }).passthrough(), validationErrorHandler);
  app.post('/admin/tickets/:id/comments', uuidIdParam, ticketCommentBody, addTicketComment as unknown as Handler);

  // @hand-wired reason="Stripe webhook, must precede auth middleware" wave="by-design"
  app.post('/webhooks/stripe', stripeWebhookHandler as unknown as Handler);
  // @hand-wired reason="RFC 8058 unsubscribe, must precede /email/* auth" wave="by-design"
  const unsubQuery = zValidator('query', z.object({
    token: z.string().min(1).max(512),
    email: z.string().email().max(320),
    orgId: z.string().uuid(),
  }), validationErrorHandler);
  app.get('/email/unsubscribe', unsubQuery, unsubscribeEmail);
  app.post('/email/unsubscribe', unsubQuery, unsubscribeEmail);

  // Org-context for email routes (admin creates templates per-org)
  // Auth middleware sets user/session; orgContextMiddleware sets orgId from request
  app.use('/email/*', authMiddleware());
  app.use('/email/*', orgContextMiddleware());

  // @hand-wired reason="suppression list, middleware ordering with /email/* auth" wave="by-design"
  app.get('/email/suppressions', listEmailSuppressions);

  // Public association endpoints that must NOT have auth middleware
  const ASSOCIATION_PUBLIC_PATHS = [
    '/association/member/credentials/public-verify',
    '/association/member/credentials/lookup',
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
  for (const prefix of ['/billing/*', '/booking/*', '/comms/*', '/communications/*', '/storage/*', '/reviews/*', '/audit/*', '/persons/*', '/surveys/*']) {
    // Auth must run first so orgContextOptionalMiddleware sees the user.
    // authMiddleware is idempotent — per-route auth still enforces role checks.
    app.use(prefix, authMiddleware({ required: false }));
    app.use(prefix, orgContextOptionalMiddleware());
  }

  // Invite routes middleware:
  // - /invite/validate/:token is PUBLIC (no auth) — user clicks link before logging in
  // - /invite/claim/:token requires auth — user must be logged in
  // - POST /invite requires auth + org context — officer invites member
  app.use('/invite', authMiddleware(), orgContextMiddleware());
  app.use('/invite/claim/*', authMiddleware());
  // /invite/validate/* intentionally has no auth — public endpoint

  // Accredited Providers — defense-in-depth wildcard (generated routes now have per-route auth)
  app.use('/accredited-providers/*', authMiddleware());

  // Register API routes
  registerOpenAPIRoutes(app as unknown as Parameters<typeof registerOpenAPIRoutes>[0]); // structural: Hono app type narrowing

  // ──────────────────────────────────────────────────────────────────────────
  // HAND-WIRED ROUTES — remaining routes not served via generated OpenAPI routes
  // See ROADMAP.md "TypeSpec Migration Backlog" for full inventory.
  //
  // BY DESIGN (9) — middleware ordering or public-before-auth requirements:
  //   /public/orgs, /og/events/:slug, /credentials/lookup/:num,
  //   /certificates/verify/:num, /pay/:token/* (2),
  //   /email/unsubscribe (GET+POST), /email/suppressions
  //
  // ALL PRE-MIGRATION ROUTES MIGRATED (Cycle 8 + Phase 35):
  //   Cycle 8: accredited-providers (4), cpd-config (2),
  //     credits/manual, compliance (2), persons/me/credits — 10 routes
  //   Phase 35: admin/* (3), send-link, special-assessments (6),
  //     bulk-issue, segments (3) — 14 routes
  //
  // HANDLER CONSOLIDATION STATUS (Wave 4):
  //   m05 membership/: query-rich repo (JOINs, search) — complementary to
  //       association:member/ CRUD repo. Both use same schema. No consolidation needed.
  //   m06 dues/: deprecated dues.repo.ts removed (zero consumers).
  //       Handlers import canonical association:member/repos/dues-payments.repo.
  //       Payment-token repos are unique to dues/ (no overlap).
  //   m09/m10 training/: hand-wired CRUD repo, shares schema with
  //       association:operations/ TypeSpec repo. Complementary bounded contexts.
  //   m12 elections/: entirely hand-wired. TypeSpec migration deferred.
  // ──────────────────────────────────────────────────────────────────────────

  // completeEvent — removed hand-wired duplicate; now served via generated TypeSpec route
  // (see generated/openapi/routes.ts)

  // sendPaymentLink — migrated to generated routes (Phase 35)
  // downloadReceipt — migrated to generated routes (Member/DuesSpecialAssessments cutover)
  const orgIdParam = zValidator('param', z.object({ organizationId: z.string().uuid() }), validationErrorHandler);

  // @hand-wired reason="document byte download, browser GET cannot send x-org-id; self-enforces membership" wave="oli-J-ORG-001"
  const documentIdParam = zValidator('param', z.object({ documentId: z.string().uuid() }), validationErrorHandler);
  app.get('/documents/:documentId/download', documentIdParam, authMiddleware(), downloadDocument as unknown as Handler);

  // @hand-wired reason="national dashboard CSV/JSON export, admin-only" wave="Cycle-8"
  app.post('/admin/national-dashboard/:associationId/export', assocIdParam, authMiddleware(), exportNationalDashboard as unknown as Handler);

  // PRC Accredited Providers — MIGRATED: now in generated routes.ts with authMiddleware.
  // Wildcard app.use('/accredited-providers/*', authMiddleware()) at line 362 provides
  // defense-in-depth. Hand-wired duplicates removed (Cycle 8 auth guard fix).

  // Training lifecycle — MIGRATED: completeCustomTraining + publishTraining now in generated routes.
  // Legacy paths /organizations/:organizationId/training/:id/complete and /org/:organizationId/trainings/:id/publish removed.

  // updateNomineeStatus — MIGRATED to TypeSpec as updateCandidateStatus
  // (POST /association/member/candidates/{candidateId}/status). Wave 12.
  // deleteElection — MIGRATED to TypeSpec
  // (DELETE /association/member/elections/{electionId}). Spec allows deleting
  // draft OR cancelled elections; implementation in
  // handlers/association:member/deleteElection.ts.

  // @hand-wired reason="ID card + bulk certificate issue, not in TypeSpec" wave="Wave-2b"
  const orgIdShortParam = zValidator('param', z.object({ orgId: z.string().uuid() }), validationErrorHandler);
  app.get('/persons/me/id-card/:orgId', orgIdShortParam, authMiddleware(), getMyIdCard as unknown as Handler);
  app.get('/persons/me/id-card/:orgId/pdf', orgIdShortParam, authMiddleware(), getMyIdCardPdf as unknown as Handler);
  // bulkIssueCertificates — migrated to generated routes (Phase 35)

  // @hand-wired reason="WF-074 certificate PDF download, handler exists but not in TypeSpec" wave="Wave-2b"
  const certIdParam = zValidator('param', z.object({ id: z.string().uuid() }), validationErrorHandler);
  app.get('/certificates/:id/pdf', certIdParam, authMiddleware(), generateCertificatePdf as unknown as Handler);

  // @hand-wired reason="WF-070 cross-org credit transcript export, inline query schema not in TypeSpec" wave="Wave-22"
  const creditTranscriptQuery = zValidator('query', z.object({
    registrationDate: z.string().min(1),
    cyclePeriodYears: z.string().optional(),
    requiredCredits: z.string().optional(),
    carryoverEnabled: z.string().optional(),
    previousCycleEarned: z.string().optional(),
    targetDate: z.string().optional(),
  }), validationErrorHandler);
  const creditTranscriptPdfQuery = zValidator('query', z.object({
    registrationDate: z.string().min(1),
    cyclePeriodYears: z.string().optional(),
    requiredCredits: z.string().optional(),
    carryoverEnabled: z.string().optional(),
    previousCycleEarned: z.string().optional(),
    targetDate: z.string().optional(),
    personName: z.string().optional(),
    cycleStartMonth: z.string().optional(),
    cycleStartDay: z.string().optional(),
  }), validationErrorHandler);
  app.get('/persons/me/credit-transcript', creditTranscriptQuery, authMiddleware(), getCreditTranscript as unknown as Handler);
  app.get('/persons/me/credit-transcript/pdf', creditTranscriptPdfQuery, authMiddleware(), getCreditTranscriptPdf as unknown as Handler);

  // @hand-wired reason="WF-014 async DPA data export (DataExport entity + status poll + download), inline schema not in TypeSpec" wave="Wave-24"
  const dataExportIdParam = zValidator('param', z.object({ id: z.string().uuid() }), validationErrorHandler);
  app.post('/persons/me/data-export', authMiddleware(), requestDataExport as unknown as Handler);
  app.get('/persons/me/data-export/:id', dataExportIdParam, authMiddleware(), getDataExportStatus as unknown as Handler);
  app.get('/persons/me/data-export/:id/download', dataExportIdParam, authMiddleware(), getDataExportDownload as unknown as Handler);

  // special-assessments CRUD — migrated to generated routes (Phase 35)

  // @hand-wired reason="officer transition checklist handover, not in TypeSpec" wave="M4-R3"
  const transitionParams = zValidator('param', z.object({ organizationId: z.string().uuid(), termId: z.string().uuid() }), validationErrorHandler);
  const transitionBody = zValidator('json', z.object({
    successorPersonId: z.string().uuid(),
    checklistItems: z.array(z.string().min(1).max(500)).optional(),
  }), validationErrorHandler);
  app.post('/association/member/org/:organizationId/officers/:termId/transition', transitionParams, transitionBody, authMiddleware(), orgContextMiddleware(), transitionOfficerTerm as unknown as Handler);

  // @hand-wired reason="org-wide dashboard, not in TypeSpec" wave="M4-DASHBOARD"
  app.get('/association/member/org/:organizationId/dashboard', orgIdParam, authMiddleware(), getOrgDashboard as unknown as Handler);

  // void-event hand-wired duplicate killed by member-credits cutover (Cr.7).
  // Generated route at routes.ts:1043 serves /association/member/credits/void-event.

  // @hand-wired reason="admin pricing tier CRUD, not in TypeSpec" wave="UJ-M03"
  const pricingBody = zValidator('json', z.object({
    name: z.string().min(1).max(255),
    amount: z.number().nonnegative(),
    currency: z.string().length(3).optional(),
    interval: z.enum(['monthly', 'quarterly', 'annually']).optional(),
    features: z.array(z.string()).optional(),
  }).passthrough(), validationErrorHandler);
  const tierIdParam = zValidator('param', z.object({ tierId: z.string().uuid() }), validationErrorHandler);
  app.get('/admin/pricing', listPricingTiers as unknown as Handler);
  app.post('/admin/pricing', pricingBody, createPricingTier as unknown as Handler);
  app.put('/admin/pricing/:tierId', tierIdParam, pricingBody, updatePricingTier as unknown as Handler);

  // @hand-wired reason="admin subscription management, not in TypeSpec" wave="UJ-M03"
  app.get('/admin/subscriptions', listSubscriptions as unknown as Handler);
  app.get('/admin/subscriptions/:id', uuidIdParam, getSubscription as unknown as Handler);
  app.put('/admin/subscriptions/:id/cancel', uuidIdParam, cancelSubscription as unknown as Handler);

  // @hand-wired reason="platform revenue/health analytics, not in TypeSpec" wave="23" finding="EM-M03-b4c5d6e7"
  app.get('/admin/analytics/revenue', getRevenueAnalytics as unknown as Handler);
  app.get('/admin/analytics/health', getOrgHealthScores as unknown as Handler);

  // @hand-wired reason="org-facing subscription routes, not in TypeSpec" wave="UJ-M03"
  app.get('/association/member/org/:organizationId/subscription', orgIdParam, getMySubscription as unknown as Handler);
  const subscriptionBody = zValidator('json', z.object({
    tierId: z.string().uuid(),
  }).passthrough(), validationErrorHandler);
  app.post('/association/member/org/:organizationId/subscription/upgrade', orgIdParam, subscriptionBody, upgradeSubscription as unknown as Handler);
  app.post('/association/member/org/:organizationId/subscription/checkout', orgIdParam, subscriptionBody, createSubscriptionCheckout as unknown as Handler);

  // savedSegments CRUD — migrated to generated routes (Phase 35)

  // @hand-wired reason="announcement scheduling + stats, not in TypeSpec" wave="Cycle-8"
  const scheduleBody = zValidator('json', z.object({
    scheduledAt: z.string().min(1),
  }).passthrough(), validationErrorHandler);
  app.post('/communications/announcements/:id/schedule', uuidIdParam, authMiddleware(), scheduleBody, scheduleAnnouncement as unknown as Handler);
  app.get('/communications/announcements/:id/stats', uuidIdParam, authMiddleware(), getAnnouncementStats as unknown as Handler);

  // @hand-wired reason="event registration cancel, org-scoped path per API_CONTRACTS" wave="pre-migration"
  const cancelRegParams = zValidator('param', z.object({ orgId: z.string().uuid(), eventId: z.string().uuid(), registrationId: z.string().uuid() }), validationErrorHandler);
  app.delete('/org/:orgId/events/:eventId/register/:registrationId', cancelRegParams, authMiddleware(), cancelRegistration as unknown as Handler);

  // @hand-wired reason="survey export/clone/analytics, not in TypeSpec" wave="pre-migration"
  const surveyParam = zValidator('param', z.object({ survey: z.string().uuid() }), validationErrorHandler);
  app.get('/surveys/:survey/export', surveyParam, authMiddleware(), orgContextMiddleware(), exportSurveyResponses as unknown as Handler);
  app.post('/surveys/:survey/clone', surveyParam, authMiddleware(), orgContextMiddleware(), cloneSurvey as unknown as Handler);
  app.get('/surveys/analytics/nps-trends', authMiddleware(), orgContextMiddleware(), getNpsTrends as unknown as Handler);
  app.delete('/surveys/my-responses', authMiddleware(), deleteMemberResponses as unknown as Handler);

  // @hand-wired reason="admin survey dashboard, platform admin only" wave="pre-migration"
  app.get('/admin/surveys', authMiddleware(), platformAdminAuthMiddleware(), listAdminSurveys as unknown as Handler);

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
  registerDuesJobs(jobs, app.billing);
  registerStatusRecomputeJob(jobs);
  registerPersonJobs(jobs);
  registerMembershipJobs(jobs, app.notifs);
  registerSurveyJobs(jobs, app.notifs);
  registerBreachJobs(jobs, app.notifs);
  registerTicketJobs(jobs, app.notifs);
  registerTrialExpiryMonitor(jobs);
  registerPastDueMonitor(jobs);

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
