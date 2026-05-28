/**
 * Main server setup with Hono, Better-Auth, and generated routes
 * Uses factory pattern for dependency injection with proper cleanup support
 */

import { Hono } from 'hono';
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

// Training entity lifecycle — completeTraining/publishTraining transition training status (not enrollment)
import { completeTraining } from '@/handlers/training/completeTraining';
import { publishTraining } from '@/handlers/training/publishTraining';

// Elections: hand-wired (not in TypeSpec)
import { updateNomineeStatus } from '@/handlers/elections/updateNomineeStatus';
import { deleteElection } from '@/handlers/elections/deleteElection';

// Email: hand-wired for middleware ordering reasons.
// - unsubscribeEmail: MUST be registered BEFORE /email/* auth middleware (RFC 8058 public access)
// - listEmailSuppressions: registered AFTER /email/* auth middleware (officer-only)
import { unsubscribeEmail } from '@/handlers/email/unsubscribeEmail';
import { listEmailSuppressions } from '@/handlers/email/listEmailSuppressions';

// Saved Segments — hand-wired CRUD (Wave 4β Lane C)
import { createSavedSegment, listSavedSegments, deleteSavedSegment } from '@/handlers/communication/savedSegments';
// Communications: schedule + stats (hand-wired, Cycle 8)
import { scheduleAnnouncement } from '@/handlers/communication/scheduleAnnouncement';
import { getAnnouncementStats } from '@/handlers/communication/getAnnouncementStats';

// Dues: receipt download (hand-wired, Cycle 8)
import { downloadReceipt } from '@/handlers/dues/downloadReceipt';
// National dashboard export (hand-wired, Cycle 8)
import { exportNationalDashboard } from '@/handlers/association:operations/exportNationalDashboard';

// Survey extras — hand-wired (export returns CSV, clone is convenience endpoint)
import { exportSurveyResponses } from '@/handlers/surveys/exportSurveyResponses';
import { cloneSurvey } from '@/handlers/surveys/cloneSurvey';
import { getNpsTrends } from '@/handlers/surveys/getNpsTrends';
import { listAdminSurveys } from '@/handlers/surveys/listAdminSurveys';
import { deleteMemberResponses } from '@/handlers/surveys/deleteMemberResponses';

// completeEvent now served via generated TypeSpec route (was hand-wired, duplicate removed)

// One-tap payment token: public validate + checkout, officer send-link
import { sendPaymentLink } from '@/handlers/dues/sendPaymentLink';
import { validatePaymentToken } from '@/handlers/dues/validatePaymentToken';
import { checkoutPaymentToken } from '@/handlers/dues/checkoutPaymentToken';

// Public org discovery — hand-wired (not yet in TypeSpec)
import { listPublicOrgs } from '@/handlers/platformadmin/listPublicOrgs';

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

// Platform admin: national dashboard + cross-org committee list (dark handlers → now wired)
import { getNationalDashboard } from '@/handlers/platformadmin/getNationalDashboard';
import { listAllCommittees } from '@/handlers/platformadmin/listAllCommittees';
import { getCommittee } from '@/handlers/association:operations/getCommittee';

// OG meta route for social sharing crawlers (WhatsApp, Facebook, Twitter)
import { serveEventOgMeta } from '@/handlers/events/serveEventOgMeta';
import { cancelRegistration } from '@/handlers/events/cancelRegistration';

// Public credential lookup (Wave 3a — Trust Directory)
import { lookupCredentialPublic } from '@/handlers/association:member/lookupCredentialPublic';

// ID card — JSON + PDF download (UJ-M02)
import { getMyIdCard } from '@/handlers/person/getMyIdCard';
import { getMyIdCardPdf } from '@/handlers/person/getMyIdCardPdf';

// Wave 2b: Credit pipeline, CPD config, compliance, certificates
import { getCpdConfig } from '@/handlers/association:member/getCpdConfig';
import { updateCpdConfig } from '@/handlers/association:member/updateCpdConfig';
import { awardManualCredit } from '@/handlers/association:member/awardManualCredit';
import { getComplianceReport } from '@/handlers/association:member/getComplianceReport';
import { refreshCompliance } from '@/handlers/association:member/refreshCompliance';
import { getMyCredits } from '@/handlers/person/getMyCredits';
import { bulkIssueCertificates } from '@/handlers/certificates/bulkIssueCertificates';
import { verifyCertificatePublic } from '@/handlers/certificates/verifyCertificatePublic';

// Wave 1 Financial: Special Assessments CRUD (T8)
import { createSpecialAssessment } from '@/handlers/association:member/createSpecialAssessment';
import { listSpecialAssessments } from '@/handlers/association:member/listSpecialAssessments';
import { updateSpecialAssessment } from '@/handlers/association:member/updateSpecialAssessment';
import { deleteSpecialAssessment } from '@/handlers/association:member/deleteSpecialAssessment';
import { applySpecialAssessment } from '@/handlers/association:member/applySpecialAssessment';
import { getSpecialAssessmentCollection } from '@/handlers/association:member/getSpecialAssessmentCollection';

// Officer transition — hand-wired (M4-R3 checklist-based handover, not in TypeSpec)
import { transitionOfficerTerm } from '@/handlers/association:member/transitionOfficerTerm';

// Org-wide dashboard — M4-DASHBOARD AC-M04-005 (hand-wired, not in TypeSpec)
import { getOrgDashboard } from '@/handlers/association:member/getOrgDashboard';

// Subscription system (UJ-M03) — pricing tier management and org subscriptions
import { listPricingTiers } from '@/handlers/platformadmin/listPricingTiers';
import { createPricingTier } from '@/handlers/platformadmin/createPricingTier';
import { updatePricingTier } from '@/handlers/platformadmin/updatePricingTier';
import { listSubscriptions } from '@/handlers/platformadmin/listSubscriptions';
import { getSubscription } from '@/handlers/platformadmin/getSubscription';
import { cancelSubscription } from '@/handlers/platformadmin/cancelSubscription';
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
  app.get('/public/orgs', listPublicOrgs as any);

  // @hand-wired reason="HTML og:meta for social crawlers, not REST" wave="by-design"
  app.get('/og/events/:slug', serveEventOgMeta as any);

  // @hand-wired reason="public credential lookup, no auth by design" wave="Wave-3a"
  app.get('/association/member/credentials/lookup/:credentialNumber', lookupCredentialPublic as any);

  // @hand-wired reason="public certificate verification, no auth by design" wave="Wave-2b"
  app.get('/certificates/verify/:certificateNumber', verifyCertificatePublic as any);

  // Register auth routes
  registerAuthRoutes(app as App);

  // Platform admin authorization — auth first (sets user), then check platform_admin table
  app.use('/admin/*', authMiddleware(), platformAdminAuthMiddleware());

  // @hand-wired reason="national dashboard + cross-org committees, not in TypeSpec" wave="M4-DASHBOARD"
  app.get('/admin/national-dashboard/:associationId', getNationalDashboard as any);
  app.get('/admin/committees', listAllCommittees as any);
  app.get('/admin/committees/:id', getCommittee as any);

  // @hand-wired reason="DPA 2012 breach notification, admin-only" wave="M3-R11"
  const reportBreachBody = zValidator('json', z.object({
    organizationId: z.string().uuid().optional(),
    discoveredAt: z.string().min(1),
    description: z.string().min(1).max(5000),
    affectedRecordsCount: z.number().int().nonnegative().optional(),
    dataCategories: z.array(z.enum(['personal', 'sensitive_personal', 'health', 'financial', 'biometric', 'genetic', 'criminal'])).optional(),
  }), validationErrorHandler);
  app.post('/admin/breaches', reportBreachBody, reportBreach as any);
  app.get('/admin/breaches', listBreaches as any);
  app.put('/admin/breaches/:id', updateBreachStatus as any);

  // @hand-wired reason="support ticket SLA system, not in TypeSpec" wave="M3-R12"
  app.post('/support/tickets', authMiddleware(), createTicket as any);
  app.get('/admin/tickets', listTickets as any);
  app.get('/admin/tickets/:id', getTicket as any);
  app.put('/admin/tickets/:id', updateTicketStatus as any);
  app.post('/admin/tickets/:id/comments', addTicketComment as any);

  // @hand-wired reason="public payment token, must precede auth middleware" wave="by-design"
  const paymentTokenParam = zValidator('param', z.object({ token: z.string().min(1).max(512) }), validationErrorHandler);
  app.get('/pay/:token/validate', paymentTokenParam, validatePaymentToken as any);
  app.post('/pay/:token/checkout', paymentTokenParam, checkoutPaymentToken as any);

  // @hand-wired reason="RFC 8058 unsubscribe, must precede /email/* auth" wave="by-design"
  app.get('/email/unsubscribe', unsubscribeEmail);
  app.post('/email/unsubscribe', unsubscribeEmail);

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
  for (const prefix of ['/billing/*', '/booking/*', '/comms/*', '/storage/*', '/reviews/*', '/audit/*', '/persons/*']) {
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
  // PRE-MIGRATION ROUTES — 33 hand-wired routes not in TypeSpec
  // See ROADMAP.md "TypeSpec Migration Backlog" for full inventory.
  //
  // BY DESIGN (9) — middleware ordering or public-before-auth requirements:
  //   /public/orgs, /og/events/:slug, /credentials/lookup/:num,
  //   /certificates/verify/:num, /pay/:token/* (2),
  //   /email/unsubscribe (GET+POST), /email/suppressions
  //
  // PRE-MIGRATION (14) — should be TypeSpec, migrate when touching module:
  //   /admin/* (3), /org/:id/payments/send-link,
  //   /certificates/bulk-issue, /special-assessments/* (6), /segments/* (3)
  //
  // MIGRATED TO GENERATED (Cycle 8): accredited-providers (4), cpd-config (2),
  //   credits/manual, compliance (2), persons/me/credits — 10 routes removed
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

  // @hand-wired reason="officer payment link generation, not in TypeSpec" wave="pre-migration"
  app.post('/org/:organizationId/payments/send-link', authMiddleware(), orgContextMiddleware(), sendPaymentLink as any);
  // @hand-wired reason="receipt PDF download, not in TypeSpec" wave="Cycle-8"
  app.get('/org/:organizationId/payments/:paymentId/receipt', authMiddleware(), downloadReceipt as any);

  // @hand-wired reason="national dashboard CSV/JSON export, admin-only" wave="Cycle-8"
  app.post('/admin/national-dashboard/:associationId/export', authMiddleware(), exportNationalDashboard as any);

  // PRC Accredited Providers — MIGRATED: now in generated routes.ts with authMiddleware.
  // Wildcard app.use('/accredited-providers/*', authMiddleware()) at line 362 provides
  // defense-in-depth. Hand-wired duplicates removed (Cycle 8 auth guard fix).

  // @hand-wired reason="training lifecycle transitions, hand-wired CRUD" wave="pre-migration"
  app.post('/organizations/:organizationId/training/:id/complete', authMiddleware(), completeTraining as any);
  app.put('/org/:organizationId/trainings/:id/publish', authMiddleware(), publishTraining as any);

  // @hand-wired reason="elections module entirely hand-wired, TypeSpec deferred" wave="pre-migration"
  app.patch('/association/member/elections/:electionId/nominees/:nomineeId', authMiddleware(), updateNomineeStatus as any);
  app.delete('/association/member/elections/:id', authMiddleware(), deleteElection as any);

  // @hand-wired reason="ID card + bulk certificate issue, not in TypeSpec" wave="Wave-2b"
  app.get('/persons/me/id-card/:orgId', authMiddleware(), getMyIdCard as any);
  app.get('/persons/me/id-card/:orgId/pdf', authMiddleware(), getMyIdCardPdf as any);
  app.post('/certificates/bulk-issue', authMiddleware(), orgContextMiddleware(), bulkIssueCertificates as any);

  // @hand-wired reason="special assessments CRUD, not in TypeSpec" wave="Wave-1"
  app.post('/association/member/special-assessments', authMiddleware(), createSpecialAssessment as any);
  app.get('/association/member/special-assessments/:orgId', authMiddleware(), listSpecialAssessments as any);
  app.put('/association/member/special-assessments/:id', authMiddleware(), updateSpecialAssessment as any);
  app.delete('/association/member/special-assessments/:id', authMiddleware(), deleteSpecialAssessment as any);
  app.post('/association/member/special-assessments/:id/apply', authMiddleware(), applySpecialAssessment as any);
  app.get('/association/member/special-assessments/:id/collection', authMiddleware(), getSpecialAssessmentCollection as any);

  // @hand-wired reason="officer transition checklist handover, not in TypeSpec" wave="M4-R3"
  app.post('/association/member/org/:organizationId/officers/:termId/transition', authMiddleware(), orgContextMiddleware(), transitionOfficerTerm as any);

  // @hand-wired reason="org-wide dashboard, not in TypeSpec" wave="M4-DASHBOARD"
  app.get('/association/member/org/:organizationId/dashboard', authMiddleware(), getOrgDashboard as any);

  // @hand-wired reason="admin pricing tier CRUD, not in TypeSpec" wave="UJ-M03"
  app.get('/admin/pricing', listPricingTiers as any);
  app.post('/admin/pricing', createPricingTier as any);
  app.put('/admin/pricing/:tierId', updatePricingTier as any);

  // @hand-wired reason="admin subscription management, not in TypeSpec" wave="UJ-M03"
  app.get('/admin/subscriptions', listSubscriptions as any);
  app.get('/admin/subscriptions/:id', getSubscription as any);
  app.put('/admin/subscriptions/:id/cancel', cancelSubscription as any);

  // @hand-wired reason="org-facing subscription routes, not in TypeSpec" wave="UJ-M03"
  app.get('/association/member/org/:organizationId/subscription', getMySubscription as any);
  app.post('/association/member/org/:organizationId/subscription/upgrade', upgradeSubscription as any);
  app.post('/association/member/org/:organizationId/subscription/checkout', createSubscriptionCheckout as any);

  // @hand-wired reason="saved segment CRUD, not in TypeSpec" wave="Wave-4b"
  app.post('/communications/segments', authMiddleware(), createSavedSegment as any);
  app.get('/communications/segments', authMiddleware(), listSavedSegments as any);
  app.delete('/communications/segments/:id', authMiddleware(), deleteSavedSegment as any);

  // @hand-wired reason="announcement scheduling + stats, not in TypeSpec" wave="Cycle-8"
  app.post('/communications/announcements/:id/schedule', authMiddleware(), scheduleAnnouncement as any);
  app.get('/communications/announcements/:id/stats', authMiddleware(), getAnnouncementStats as any);

  // @hand-wired reason="event registration cancel, org-scoped path per API_CONTRACTS" wave="pre-migration"
  app.delete('/org/:orgId/events/:eventId/register/:registrationId', authMiddleware(), cancelRegistration as any);

  // @hand-wired reason="survey export/clone/analytics, not in TypeSpec" wave="pre-migration"
  app.get('/surveys/:survey/export', authMiddleware(), orgContextMiddleware(), exportSurveyResponses as any);
  app.post('/surveys/:survey/clone', authMiddleware(), orgContextMiddleware(), cloneSurvey as any);
  app.get('/surveys/analytics/nps-trends', authMiddleware(), orgContextMiddleware(), getNpsTrends as any);
  app.delete('/surveys/my-responses', authMiddleware(), deleteMemberResponses as any);

  // @hand-wired reason="admin survey dashboard, platform admin only" wave="pre-migration"
  app.get('/admin/surveys', authMiddleware(), platformAdminAuthMiddleware(), listAdminSurveys as any);

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
