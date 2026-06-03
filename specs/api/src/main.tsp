import "@typespec/http";
import "@typespec/versioning";
import "@typespec/openapi";

import "./common/models.tsp";
import "./common/errors.tsp";
import "./common/pagination.tsp";
import "./common/security.tsp";

// Import all module definitions
// Note: identity/auth is handled by Better-Auth, not TypeSpec
import "./modules/person.tsp";
import "./modules/person-custom.tsp";
import "./modules/billing.tsp";
import "./modules/audit.tsp";
import "./modules/notifs.tsp";
import "./modules/notifs-custom.tsp";
import "./modules/comms.tsp";
import "./modules/storage.tsp";
import "./modules/email.tsp";
import "./modules/booking.tsp";
import "./modules/reviews.tsp";

// Association domain modules
import "./modules/patient.tsp";
import "./modules/provider.tsp";

// Platform administration
import "./modules/platform-admin.tsp";
import "./modules/platform-admin-custom.tsp";

// Officer dashboard custom endpoints
import "./modules/membership-custom.tsp";
import "./modules/dues-custom.tsp";

// Invite module — officer invites, public validation, authenticated claim
import "./modules/invite.tsp";

// Onboarding module — resumable org setup wizard (m01 auth-onboarding)
import "./modules/onboarding.tsp";

// Surveys & NPS — Wave 6
import "./modules/surveys.tsp";

// Wave G3 — Standards Adoption (TypeSpec coverage for legacy hand-wired modules)
// Note: routes for advertising/jobs/marketplace are NOT mounted in app.ts.
// TypeSpec authored to surface contracts in the OpenAPI spec; activation deferred.
import "./modules/advertising.tsp";
import "./modules/jobs.tsp";
import "./modules/marketplace.tsp";

// Infrastructure endpoints (health.tsp and feature-flags.tsp removed — real
// implementations live in core/health.ts and platformadmin/listFeatureFlags.ts)

// Association management specs
import "./association/core/primitives.tsp";
import "./association/core/engagement.tsp";
import "./association/core/staff.tsp";
import "./association/core/scheduling.tsp";
import "./association/core/fee-schedule.tsp";
import "./association/core/billing.tsp";
import "./association/core/documents.tsp";
import "./association/core/communication.tsp";
import "./association/core/consent.tsp";
import "./association/core/reporting.tsp";
import "./association/member/membership.tsp";
import "./association/member/dues.tsp";
import "./association/member/credits.tsp";
import "./association/member/chapters.tsp";
import "./association/member/governance.tsp";
import "./association/member/certificates.tsp";
import "./association/member/directory.tsp";
import "./association/member/credentials.tsp";
import "./association/member/certification.tsp";
import "./association/member/ethics.tsp";
import "./association/member/awards.tsp";
import "./association/member/fundraising.tsp";
import "./association/member/special-assessments.tsp";
import "./association/operations/events.tsp";
import "./association/operations/training.tsp";
import "./association/operations/conference.tsp";
import "./association/operations/volunteer.tsp";
import "./association/operations/publications.tsp";
import "./association/operations/marketplace.tsp";
import "./association/operations/portal.tsp";
import "./association/operations/marketing.tsp";
import "./association/integration/webhooks.tsp";
import "./association/integration/automation.tsp";

// Association communications — announcements
import "./association/operations/announcements.tsp";

using TypeSpec.Http;
using TypeSpec.Versioning;
using TypeSpec.OpenAPI;

/**
 * Monobase Application API
 *
 * Generic API for SaaS application platforms. Provides identity, billing,
 * scheduling, communications, storage, and notification primitives that
 * any product can compose into its own domain workflows.
 */
@server("https://api.example.com", "Production server")
@server("https://stg.api.example.com", "Staging server")
@versioned(Versions)
@service(#{
  title: "Monobase Application API"
})
// Tag Metadata Definitions
@tagMetadata("Person", #{
  description: "Central person management module serving as the foundation for all user types in the platform. Handles core PII (Personally Identifiable Information) with strict data protection. Manages identity verification, profile updates, consent preferences (marketing, data sharing, SMS, email), and serves as the single source of truth for user information across the platform ecosystem."
})
@tagMetadata("Billing", #{
  description: "Invoice-based payment processing with Stripe integration. Manages invoices, merchant accounts, payment processing, and refunds. Supports both automatic and manual payment capture flows with comprehensive authorization controls. Any person can become a merchant and receive payments through Stripe Connect."
})
@tagMetadata("Audit", #{
  description: "Enterprise-grade audit logging and compliance tracking system. Records all data access, modifications, and system events with immutable audit trails. Provides detailed activity logs with user attribution, IP tracking, timestamp recording, and data change history. Supports compliance reporting, suspicious activity detection, audit log retention policies, and integration with security information and event management (SIEM) systems."
})
@tagMetadata("Notifs", #{
  description: "Multi-channel notification delivery system for user engagement and communications. Manages email, push notifications, and in-app messaging with delivery tracking. Handles booking reminders, billing notifications, security alerts, and system announcements. Provides read-only API for users with internal service-based creation."
})
@tagMetadata("Comms", #{
  description: "Real-time communication module providing chat rooms and embedded video calls. Features Messenger-style chat with immutable message history, direct booking integration, and action-based video call management with WebRTC signaling. Supports one active video call per chat room with efficient state management."
})
@tagMetadata("Storage", #{
  description: "Secure document and file management system with AWS S3 integration. Handles documents, reports, files, and consent forms with encryption at rest and in transit. Provides presigned URLs for secure uploads/downloads, automatic file type validation, virus scanning, PDF generation, and retention policy enforcement with enterprise-grade access controls."
})
@tagMetadata("System", #{
  description: "System administration and monitoring endpoints for platform health and operations. Provides health checks for all system components, database connectivity monitoring, service dependency status, API version information, performance metrics, and graceful degradation handling. Includes diagnostic endpoints for troubleshooting, system configuration verification, and operational readiness checks."
})
@tagMetadata("Email", #{
  description: "Runtime-configurable email service with dynamic template management. Enables administrators to create and modify email templates without code deployments, with changes taking effect immediately. Features template tag-based referencing, Handlebars variable substitution, JSON Schema validation, multi-provider support (SMTP/Postmark), asynchronous job-based processing, and comprehensive queue management with retry logic and admin controls."
})
@tagMetadata("Booking", #{
  description: "Booking and scheduling system for time-based services. Hosts define booking events with flexible availability patterns, location options (in-person, virtual, or hybrid), and automated time slot generation. Supports booking lifecycle management with confirmation workflows, mutual cancellation, no-show tracking, and schedule exception handling. Features public event discovery for seamless booking experiences."
})
@tagMetadata("Reviews", #{
  description: "Flexible NPS review system for feedback collection. Enables users to submit Net Promoter Score (0-10) reviews with optional comments for any context (appointments, sessions, orders). Supports application-defined review types and optional reviewed entities for maximum flexibility. Features immutable reviews, role-based access control, and duplicate prevention."
})
@tagMetadata("Association:Member", #{
  description: "Association member management domain. Covers membership tiers, individual and institutional memberships, applications, dues configuration, invoicing, dunning, chapter affiliations, transfers, royalty splits, member directory profiles, digital credentials, professional licenses, and renewal alerts."
})
@tagMetadata("Association:Operations", #{
  description: "Association operations domain. Covers event lifecycle management, registrations, waitlists, check-ins, instructor-led training sessions, enrollments, online courses, course enrollments, and quiz attempts."
})
@tagMetadata("Communication", #{
  description: "Association communication system. Manages message templates with variable substitution, message composition and delivery (send, schedule, cancel), subscription topics for opt-in/opt-out, and per-person subscription preferences with bulk update support."
})
@tagMetadata("Documents", #{
  description: "Association document management. Handles document lifecycle (create, update, archive), version tracking, access logging, and tag-based organization for association files, policies, and shared resources."
})
@tagMetadata("PlatformAdmin", #{
  description: "Platform administration endpoints for Memberry ops team. Association provisioning, org lifecycle management, feature flags, user impersonation, and admin team management. Desktop-only, internal tooling."
})
@tagMetadata("Onboarding", #{
  description: "Resumable organization setup wizard for the m01 auth-onboarding flow. Officers walk through profile, member import, dues configuration, payment gateway, and invite steps. Progress is persisted org-scoped so the wizard can be resumed across sessions, with completion emitting an OnboardingCompleted domain event."
})
namespace MonobaseAPI {

  // Note: Identity/Auth endpoints are handled by Better-Auth
  // and will be merged in the final OpenAPI spec
  
  // Person Management
  @tag("Person")
  @route("/persons")
  interface PersonManagement extends PersonModule.PersonManagement {}

  // Person Custom (me endpoints — privacy, notification prefs, credits, export, deletion)
  @tag("Person")
  @route("/persons/me")
  interface PersonCustomManagement extends PersonCustomModule.PersonCustomManagement {}

  // Billing Management
  @tag("Billing")
  @route("/billing")
  interface BillingInvoiceManagement extends BillingModule.InvoiceManagement {}
  
  @tag("Billing")
  @route("/billing")
  interface BillingPaymentProcessing extends BillingModule.PaymentProcessing {}
  
  @tag("Billing")
  @route("/billing")
  interface BillingMerchantAccountManagement extends BillingModule.MerchantAccountManagement {}
  
  // Audit Management
  @tag("Audit")
  @route("/audit")
  interface AuditManagement extends AuditModule.AuditManagement {}
  
  // Notification Management
  @tag("Notifs")
  @route("/notifs")
  interface NotificationManagement extends Notifs.NotificationManagement {}

  // Notification Custom (bulk read-all)
  @tag("Notifs")
  interface NotifsCustomManagement extends NotifsCustomModule.NotifsCustomManagement {}
  
  // Comms Management
  @tag("Comms")
  @route("/comms")
  interface CommsManagement extends CommsModule.CommsManagement {}

  // Storage Management
  @tag("Storage")
  interface StorageManagement extends StorageModule.StorageManagement {}

  // Email Management - template and queue management
  @tag("Email")
  @route("/email")
  interface EmailTemplateManagement extends EmailModule.EmailTemplateManagement {}

  @tag("Email")
  @route("/email")
  interface EmailQueueManagement extends EmailModule.EmailQueueManagement {}

  @tag("Email")
  @route("/email")
  interface EmailUnsubscribeEndpoints extends EmailModule.EmailUnsubscribeEndpoints {}

  @tag("Email")
  @route("/email")
  interface EmailSuppressionManagement extends EmailModule.EmailSuppressionManagement {}

  // Booking Management - events, slots, bookings, and schedule exceptions
  @tag("Booking")
  @route("/booking")
  interface BookingEventManagement extends BookingModule.BookingEventManagement {}

  @tag("Booking")
  @route("/booking")
  interface SlotDiscovery extends BookingModule.SlotDiscovery {}

  @tag("Booking")
  @route("/booking")
  interface BookingManagement extends BookingModule.BookingManagement {}

  @tag("Booking")
  @route("/booking")
  interface ScheduleExceptionManagement extends BookingModule.ScheduleExceptionManagement {}

  // Reviews Management
  @tag("Reviews")
  @route("/reviews")
  interface ReviewsManagement extends ReviewsModule.ReviewsManagement {}

  // Surveys & NPS Management (Wave 6)
  @tag("Surveys")
  @route("/surveys")
  interface SurveysManagement extends SurveysModule.SurveysManagement {}

  // Platform-admin cross-org survey listing
  @tag("Surveys")
  @route("/admin/surveys")
  interface AdminSurveysManagement extends SurveysModule.AdminSurveysManagement {}

  // =========================================================================
  // Association Domain — Membership (test: one interface)
  // =========================================================================

  // =========================================================================
  // Association Domain — Membership
  // =========================================================================

  @tag("Association:Member")
  @route("/association/member/tiers")
  interface AssocMembershipTierManagement extends Association.Member.Membership.MembershipTierManagement {}

  @tag("Association:Member")
  @route("/association/member/memberships")
  interface AssocMembershipManagement extends Association.Member.Membership.MembershipManagement {}

  @tag("Association:Member")
  @route("/association/member/applications")
  interface AssocMembershipApplicationManagement extends Association.Member.Membership.MembershipApplicationManagement {}

  @tag("Association:Member")
  @route("/association/member/institutional-memberships")
  interface AssocInstitutionalMembershipManagement extends Association.Member.Membership.InstitutionalMembershipManagement {}

  @tag("Association:Member")
  @route("/association/member/institutional-memberships/{institutionalMembershipId}/seats")
  interface AssocSeatAllocationManagement extends Association.Member.Membership.SeatAllocationManagement {}

  @tag("Association:Member")
  @route("/association/member/roster")
  interface AssocMemberRosterManagement extends Association.Member.Membership.MemberRosterManagement {}

  @tag("Association:Member")
  @route("/association/member/membership-categories")
  interface AssocMembershipCategoryManagement extends Association.Member.Membership.MembershipCategoryManagement {}

  @tag("Association:Member")
  @route("/association/member/org-profile")
  interface AssocOrganizationProfileManagement extends Association.Member.Membership.OrganizationProfileManagement {}

  // =========================================================================
  // Association Domain — CPD Credits (compliance report + officer terms)
  // =========================================================================

  @tag("Association:Member")
  @route("/credit-compliance")
  interface CreditComplianceManagement extends Association.Member.Credits.CreditComplianceManagement {}

  @tag("Association:Member")
  @route("/officer-terms")
  interface OfficerTermsManagement extends Association.Member.Credits.OfficerTermsManagement {}

  // =========================================================================
  // Association Domain — Dues
  // =========================================================================

  @tag("Association:Member")
  @route("/association/member/dues-configs")
  interface AssocDuesConfigManagement extends Association.Member.Dues.DuesConfigManagement {}

  @tag("Association:Member")
  @route("/association/member/dues-invoices")
  interface AssocDuesInvoiceManagement extends Association.Member.Dues.DuesInvoiceManagement {}

  @tag("Association:Member")
  @route("/association/member/aging-buckets")
  interface AssocAgingBucketService extends Association.Member.Dues.AgingBucketService {}

  @tag("Association:Member")
  @route("/association/member/dunning")
  interface AssocDunningManagement extends Association.Member.Dues.DunningManagement {}

  @tag("Association:Member")
  @route("/association/member/dues-payments")
  interface AssocDuesPaymentManagement extends Association.Member.Dues.DuesPaymentManagement {}

  @tag("Association:Member")
  @route("/association/member/dues-payments")
  interface AssocDuesPaymentProofManagement extends Association.Member.Dues.DuesPaymentProofManagement {}

  @tag("Association:Member")
  @route("/association/member/dues-gateway")
  interface AssocDuesGatewayManagement extends Association.Member.Dues.DuesGatewayManagement {}

  @tag("Association:Member")
  @route("/association/member/dues-reporting")
  interface AssocDuesReportingService extends Association.Member.Dues.DuesReportingService {}

  // =========================================================================
  // Association Domain — Special Assessments (one-time charges)
  // =========================================================================

  @tag("Association:Member")
  @route("/association/member/special-assessments")
  interface AssocSpecialAssessmentManagement extends Association.Member.SpecialAssessments.SpecialAssessmentManagement {}

  // =========================================================================
  // Association Domain — Chapters
  // =========================================================================

  @tag("Association:Member")
  @route("/association/member/chapter-affiliations")
  interface AssocChapterAffiliationManagement extends Association.Member.Chapters.ChapterAffiliationManagement {}

  @tag("Association:Member")
  @route("/association/member/affiliation-transfers")
  interface AssocAffiliationTransferManagement extends Association.Member.Chapters.AffiliationTransferManagement {}

  @tag("Association:Member")
  @route("/association/member/royalty-splits")
  interface AssocRoyaltySplitManagement extends Association.Member.Chapters.RoyaltySplitManagement {}

  // =========================================================================
  // Association Domain — Governance (Positions & Officer Terms — Wave 1)
  // =========================================================================

  @tag("Association:Member")
  @route("/association/member/positions")
  interface AssocPositionManagement extends Association.Member.Governance.PositionManagement {}

  @tag("Association:Member")
  @route("/association/member/officer-terms")
  interface AssocOfficerTermManagement extends Association.Member.Governance.OfficerTermManagement {}

  // =========================================================================
  // Association Domain — Governance (Elections, Candidates & Ballots)
  // =========================================================================

  @tag("Association:Member")
  @route("/association/member/elections")
  interface AssocElectionManagement extends Association.Member.Governance.ElectionManagement {}

  @tag("Association:Member")
  @route("/association/member/candidates")
  interface AssocCandidateManagement extends Association.Member.Governance.CandidateManagement {}

  @tag("Association:Member")
  @route("/association/member/ballots")
  interface AssocBallotManagement extends Association.Member.Governance.BallotManagement {}

  // =========================================================================
  // Association Domain — Certificates
  // =========================================================================

  @tag("Association:Member")
  @route("/association/member/certificates")
  interface AssocCertificateManagement extends Association.Member.Certificates.CertificateManagement {}

  @tag("Association:Member")
  @route("/certificates")
  interface CertificateVerificationService extends Association.Member.Certificates.CertificateVerificationService {}

  @tag("Association:Member")
  @route("/certificates")
  interface CertificateBulkIssuance extends Association.Member.Certificates.CertificateBulkIssuance {}

  // =========================================================================
  // Association Domain — Directory
  // =========================================================================

  @tag("Association:Member")
  @route("/association/member/directory/profiles")
  interface AssocDirectoryProfileManagement extends Association.Member.Directory.DirectoryProfileManagement {}

  @tag("Association:Member")
  @route("/association/member/directory/search")
  interface AssocDirectorySearchService extends Association.Member.Directory.DirectorySearchService {}

  // =========================================================================
  // Association Domain — Credentials
  // =========================================================================

  @tag("Association:Member")
  @route("/association/member/credential-templates")
  interface AssocCredentialTemplateManagement extends Association.Member.Credentials.CredentialTemplateManagement {}

  @tag("Association:Member")
  @route("/association/member/credentials")
  interface AssocDigitalCredentialManagement extends Association.Member.Credentials.DigitalCredentialManagement {}

  @tag("Association:Member")
  @route("/association/member/credentials/public-verify")
  interface AssocCredentialVerificationService extends Association.Member.Credentials.CredentialVerificationService {}

  @tag("Association:Member")
  @route("/association/member/credentials/lookup")
  interface AssocCredentialLookupService extends Association.Member.Credentials.CredentialLookupService {}

  @tag("Association:Member")
  @route("/association/member/licenses")
  interface AssocProfessionalLicenseManagement extends Association.Member.Credentials.ProfessionalLicenseManagement {}

  @tag("Association:Member")
  @route("/association/member/license-renewal-alerts")
  interface AssocLicenseRenewalAlertService extends Association.Member.Credentials.LicenseRenewalAlertService {}

  // =========================================================================
  // Association Domain — Communication
  // =========================================================================

  @tag("Communication")
  @route("/association/message-templates")
  interface AssocMessageTemplateManagement extends Association.Core.Communication.MessageTemplateManagement.MessageTemplateManagement {}

  @tag("Communication")
  @route("/association/messages")
  interface AssocMessageManagement extends Association.Core.Communication.MessageManagement.MessageManagement {}

  @tag("Communication")
  @route("/association/subscription-topics")
  interface AssocSubscriptionTopicManagement extends Association.Core.Communication.SubscriptionTopicManagement.SubscriptionTopicManagement {}

  @tag("Communication")
  @route("/association/person-subscriptions")
  interface AssocPersonSubscriptionManagement extends Association.Core.Communication.PersonSubscriptionManagement.PersonSubscriptionManagement {}

  @tag("Communication")
  @route("/communications/segments")
  interface AssocSavedSegmentManagement extends Association.Core.Communication.SavedSegmentManagement.SavedSegmentManagement {}

  // =========================================================================
  // Association Domain — Documents
  // =========================================================================

  @tag("Documents")
  @route("/association/documents")
  interface AssocDocumentManagement extends Association.Core.Documents.DocumentManagement.DocumentManagement {}

  @tag("Documents")
  @route("/association/documents/{documentId}/versions")
  interface AssocDocumentVersionManagement extends Association.Core.Documents.DocumentVersionManagement.DocumentVersionManagement {}

  @tag("Documents")
  @route("/association/document-tags")
  interface AssocDocumentTagManagement extends Association.Core.Documents.DocumentTagManagement.DocumentTagManagement {}

  // =========================================================================
  // Association Domain — Events
  // =========================================================================

  @tag("Association:Operations")
  @route("/association/events")
  interface AssocEventManagement extends Association.Operations.Events.EventManagement {}

  @tag("Association:Operations")
  @route("/association/events")
  interface AssocEventRegistrationManagement extends Association.Operations.Events.EventRegistrationManagement {}

  @tag("Association:Operations")
  @route("/association/events")
  interface AssocWaitlistManagement extends Association.Operations.Events.WaitlistManagement {}

  @tag("Association:Operations")
  @route("/association/events")
  interface AssocCheckInManagement extends Association.Operations.Events.CheckInManagement {}

  @tag("Association:Operations")
  @route("/association/event-lifecycle")
  interface AssocEventLifecycleService extends Association.Operations.Events.EventLifecycleService {}

  // =========================================================================
  // Association Domain — Training
  // =========================================================================

  @tag("Association:Operations")
  @route("/association/training")
  interface AssocTrainingManagement extends Association.Operations.Training.TrainingManagement {}

  @tag("Association:Operations")
  @route("/association/training")
  interface AssocTrainingEnrollmentManagement extends Association.Operations.Training.TrainingEnrollmentManagement {}

  @tag("Association:Operations")
  @route("/association/training")
  interface AssocCourseManagement extends Association.Operations.Training.CourseManagement {}

  @tag("Association:Operations")
  @route("/association/training")
  interface AssocCourseEnrollmentManagement extends Association.Operations.Training.CourseEnrollmentManagement {}

  @tag("Association:Operations")
  @route("/association/training")
  interface AssocQuizAttemptManagement extends Association.Operations.Training.QuizAttemptManagement {}

  @tag("Association:Operations")
  @route("/association/training-lifecycle")
  interface AssocTrainingLifecycleService extends Association.Operations.Training.TrainingLifecycleService {}

  // =========================================================================
  // Association Domain — Accredited Providers (org-scoped training providers)
  // =========================================================================

  @tag("Association:Operations")
  @route("/accredited-providers")
  interface AssocOrgAccreditedProviderManagement extends Association.Operations.Training.OrgAccreditedProviderManagement {}

  // =========================================================================
  // Association Domain — CPD Config
  // =========================================================================

  @tag("Association:Member")
  @route("/association/member/cpd-config")
  interface AssocCpdConfigManagement extends Association.Operations.Training.CpdConfigManagement {}

  // =========================================================================
  // Association Domain — Manual Credit Award
  // =========================================================================

  @tag("Association:Member")
  @route("/association/member/credits/manual")
  interface AssocManualCreditManagement extends Association.Operations.Training.ManualCreditManagement {}

  // =========================================================================
  // Association Domain — Credit Adjustment (officer award/deduct with reason)
  // =========================================================================

  @tag("Association:Member")
  @route("/association/member/credits/adjust")
  interface AssocCreditAdjustmentManagement extends Association.Operations.Training.CreditAdjustmentManagement {}

  // =========================================================================
  // Association Domain — Event Credit Void (bulk revoke)
  // =========================================================================

  @tag("Association:Member")
  @route("/association/member/credits/void-event")
  interface AssocEventCreditVoidManagement extends Association.Operations.Training.EventCreditVoidManagement {}

  // =========================================================================
  // Association Domain — My Credits (member-facing)
  // =========================================================================

  @tag("Person")
  @route("/persons/me/credits")
  interface PersonMyCreditsManagement extends Association.Operations.Training.MyCreditsManagement {}

  // =========================================================================
  // Association Domain — Compliance Reporting
  // =========================================================================

  @tag("Association:Member")
  @route("/association/member/compliance")
  interface AssocComplianceManagement extends Association.Operations.Training.ComplianceManagement {}

  // =========================================================================
  // Platform Administration (M03)
  // =========================================================================

  @tag("PlatformAdmin")
  @route("/admin/associations")
  interface PlatformAssociationManagement extends PlatformAdminModule.AssociationManagement {}

  @tag("PlatformAdmin")
  @route("/admin/organizations")
  interface PlatformOrganizationManagement extends PlatformAdminModule.OrganizationManagement {}

  @tag("PlatformAdmin")
  @route("/admin/feature-flags")
  interface PlatformFeatureFlagManagement extends PlatformAdminModule.FeatureFlagManagement {}

  @tag("PlatformAdmin")
  @route("/admin/impersonate")
  interface PlatformImpersonationManagement extends PlatformAdminModule.ImpersonationManagement {}

  @tag("PlatformAdmin")
  @route("/admin/admins")
  interface PlatformAdminManagement extends PlatformAdminModule.AdminManagement {}

  // =========================================================================
  // Public Event Endpoints (no auth — shareable event pages)
  // =========================================================================

  @tag("Events")
  interface PublicEventEndpoints extends Association.Operations.Events.PublicEventEndpoints {}

  // =========================================================================
  // Platform Admin Custom (public org lookup + admin identity)
  // =========================================================================

  @tag("PlatformAdmin")
  interface PlatformPublicEndpoints extends PlatformAdminCustomModule.PublicEndpoints {}

  @tag("PlatformAdmin")
  interface PlatformAdminIdentityEndpoints extends PlatformAdminCustomModule.AdminIdentityEndpoints {}

  @tag("PlatformAdmin")
  interface PlatformAdminDashboardEndpoints extends PlatformAdminCustomModule.AdminDashboardEndpoints {}

  // =========================================================================
  // Association Domain — Announcements
  // =========================================================================

  @tag("Communication")
  interface AssocAnnouncementManagement extends Association.Operations.Announcements.AnnouncementManagement {}

  // =========================================================================
  // Membership Custom (officer dashboard endpoints)
  // =========================================================================

  @tag("Membership")
  interface MembershipCustomManagement extends MembershipCustomModule.MembershipCustomManagement {}

  // =========================================================================
  // Dues Custom (officer dashboard endpoint)
  // =========================================================================

  @tag("Dues")
  interface DuesCustomManagement extends DuesCustomModule.DuesCustomManagement {}

  @tag("Dues")
  interface DuesMetricsManagement extends DuesCustomModule.DuesMetricsManagement {}

  @tag("Dues")
  interface PaymentTokenEndpoints extends DuesCustomModule.PaymentTokenEndpoints {}

  @tag("Dues")
  interface PaymentLinkManagement extends DuesCustomModule.PaymentLinkManagement {}

  @tag("Dues")
  interface ReceiptEndpoints extends DuesCustomModule.ReceiptEndpoints {}

  // =========================================================================
  // Invite Module — officer invites, public validation, authenticated claim
  // =========================================================================

  @tag("Invite")
  interface InviteManagement extends InviteModule.InviteManagement {}

  @tag("Invite")
  interface InviteTokenEndpoints extends InviteModule.InviteTokenEndpoints {}

  // =========================================================================
  // Onboarding Module — resumable org setup wizard (m01 auth-onboarding)
  // =========================================================================

  @tag("Onboarding")
  interface OnboardingManagement extends OnboardingModule.OnboardingManagement {}

  // =========================================================================
  // Wave G3 — Advertising / Jobs / Marketplace
  // (TypeSpec-only; routes are NOT mounted in app.ts pending product decision)
  // =========================================================================

  @tag("Advertising")
  interface AdvertisingAdvertiserManagement extends AdvertisingModule.AdvertiserManagement {}

  @tag("Advertising")
  interface AdvertisingCampaignManagement extends AdvertisingModule.CampaignManagement {}

  @tag("Advertising")
  interface AdvertisingCreativeManagement extends AdvertisingModule.CreativeManagement {}

  @tag("Advertising")
  interface AdvertisingAdPlacement extends AdvertisingModule.AdPlacement {}

  @tag("Jobs")
  interface JobsJobPostingManagement extends JobsModule.JobBoardPostingManagement {}

  @tag("Jobs")
  interface JobsJobApplicationManagement extends JobsModule.JobBoardApplicationManagement {}

  @tag("Marketplace")
  interface MarketplaceVendorManagement extends MarketplaceModule.VendorManagement {}

  @tag("Marketplace")
  interface MarketplaceListingManagement extends MarketplaceModule.ListingManagement {}

  @tag("Marketplace")
  interface MarketplaceOrderManagement extends MarketplaceModule.OrderManagement {}

  // =========================================================================
  // Infrastructure Endpoints
  // =========================================================================
  // Health checks (/livez, /readyz) registered in core/health.ts (inline routes)
  // Feature flags (/admin/feature-flags) registered in platformadmin module above

}

/**
 * API versioning scheme
 */
enum Versions {
  @doc("Initial API version")
  v1: "1.0",
}

/**
 * Global security configuration
 * Uses bearer token authentication from common/security.tsp
 */
