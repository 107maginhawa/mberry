import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/pagination.tsp";
import "../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Platform Administration Module
 *
 * Internal tooling for Memberry platform operations team.
 * Covers association provisioning, org management, feature flags,
 * user impersonation, and admin role management.
 */

namespace PlatformAdminModule {

  // ---------------------------------------------------------------------------
  // Enumerations
  // ---------------------------------------------------------------------------

  @doc("Lifecycle status of an organization")
  enum OrgLifecycleStatus {
    trial: "trial",
    active: "active",
    suspended: "suspended",
    cancelled: "cancelled",
  }

  @doc("Type of organization")
  enum OrgType {
    chapter: "chapter",
    society: "society",
    national: "national",
    clinic: "clinic",
  }

  @doc("Platform admin role")
  enum AdminRole {
    super: "super",
    support: "support",
    analyst: "analyst",
  }

  // ---------------------------------------------------------------------------
  // Models
  // ---------------------------------------------------------------------------

  @doc("Top-level tenant — a healthcare association")
  model Association {
    id: string;
    name: string;
    country: string;
    currency: string;
    locale: string;
    @doc("Regex pattern for validating professional license numbers")
    licenseFormatRegex?: string;
    @doc("Credit cycle period in years (1, 2, or 3)")
    creditCyclePeriod?: int32;
    @doc("Required credits per cycle")
    requiredCreditsPerCycle?: int32;
    @doc("Whether excess credits carry over to next cycle")
    carryoverEnabled?: boolean;
    status: string;
    createdAt: utcDateTime;
    updatedAt: utcDateTime;
  }

  @doc("Request body for creating/updating an association")
  model AssociationRequest {
    name: string;
    country: string;
    currency: string;
    locale?: string;
    licenseFormatRegex?: string;
    creditCyclePeriod?: int32;
    requiredCreditsPerCycle?: int32;
    carryoverEnabled?: boolean;
  }

  @doc("An organization within an association")
  model Organization {
    id: string;
    associationId: string;
    name: string;
    orgType: OrgType;
    region?: string;
    contactEmail?: string;
    status: OrgLifecycleStatus;
    trialStartDate?: utcDateTime;
    trialEndDate?: utcDateTime;
    @doc("Feature flags as JSONB — module-level toggles")
    featureFlags?: Record<boolean>;
    createdAt: utcDateTime;
    updatedAt: utcDateTime;
  }

  @doc("Request body for creating/updating an organization")
  model OrganizationRequest {
    associationId: string;
    name: string;
    orgType: OrgType;
    region?: string;
    contactEmail?: string;
    @doc("Initial officer email for invitation")
    initialOfficerEmail?: string;
    @doc("Trial duration in days (7-180)")
    trialDurationDays?: int32;
  }

  @doc("Feature flag configuration: module × tier matrix")
  model FeatureFlagConfig {
    id: string;
    @doc("Target: association ID, org ID, or tier name")
    targetType: string;
    targetId: string;
    @doc("Module name being flagged")
    moduleName: string;
    enabled: boolean;
    @doc("Per-org override (overrides tier default)")
    isOverride: boolean;
    updatedAt: utcDateTime;
    updatedBy: string;
  }

  @doc("Request body for setting a feature flag")
  model FeatureFlagRequest {
    targetType: string;
    targetId: string;
    moduleName: string;
    enabled: boolean;
  }

  @doc("Impersonation session record")
  model ImpersonationSession {
    id: string;
    adminId: string;
    targetUserId: string;
    targetOrgId?: string;
    @doc("Scoped read-only token")
    sessionToken: string;
    startedAt: utcDateTime;
    @doc("Auto-expires after 30 minutes")
    expiresAt: utcDateTime;
    endedAt?: utcDateTime;
  }

  @doc("Platform admin user")
  model PlatformAdmin {
    id: string;
    userId: string;
    email: string;
    name: string;
    role: AdminRole;
    createdAt: utcDateTime;
    updatedAt: utcDateTime;
  }

  @doc("Request body for inviting/updating a platform admin")
  model PlatformAdminRequest {
    email: string;
    name: string;
    role: AdminRole;
  }

  // ---------------------------------------------------------------------------
  // Interfaces
  // ---------------------------------------------------------------------------

  @doc("Association CRUD and provisioning")
  interface AssociationManagement {
    @doc("Create a new association (top-level tenant)")
    @operationId("createAssociation")
    @post
    @useAuth(bearerAuth)
    @extension("x-audit", #{ action: "create", resourceType: "association" })
    createAssociation(@body body: AssociationRequest): ApiCreatedResponse<Association> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("Get an association by ID")
    @operationId("getAssociation")
    @get
    @route("/{associationId}")
    @useAuth(bearerAuth)
    getAssociation(@path associationId: string): ApiOkResponse<Association> | ApiNotFoundResponse | ApiUnauthorizedResponse;

    @doc("List all associations")
    @operationId("listAssociations")
    @get
    @useAuth(bearerAuth)
    listAssociations(...PaginationQuery): ApiOkResponse<PaginatedResponse<Association>> | ApiUnauthorizedResponse;

    @doc("Update an association")
    @operationId("updateAssociation")
    @patch(#{implicitOptionality: true})
    @route("/{associationId}")
    @useAuth(bearerAuth)
    @extension("x-audit", #{ action: "update", resourceType: "association" })
    updateAssociation(@path associationId: string, @body updates: AssociationRequest): ApiOkResponse<Association> | ApiNotFoundResponse | ApiBadRequestResponse;

    @doc("Delete an association")
    @operationId("deleteAssociation")
    @delete
    @route("/{associationId}")
    @useAuth(bearerAuth)
    @extension("x-audit", #{ action: "delete", resourceType: "association" })
    deleteAssociation(@path associationId: string): ApiNoContentResponse | ApiNotFoundResponse | ApiConflictResponse;
  }

  @doc("Organization provisioning and lifecycle")
  interface OrganizationManagement {
    @doc("Provision a new organization within an association")
    @operationId("createOrganization")
    @post
    @useAuth(bearerAuth)
    @extension("x-audit", #{ action: "create", resourceType: "organization" })
    createOrganization(@body body: OrganizationRequest): ApiCreatedResponse<Organization> | ApiBadRequestResponse | ApiUnauthorizedResponse;

    @doc("Get an organization by ID")
    @operationId("getOrganization")
    @get
    @route("/{organizationId}")
    @useAuth(bearerAuth)
    getOrganization(@path organizationId: string): ApiOkResponse<Organization> | ApiNotFoundResponse | ApiUnauthorizedResponse;

    @doc("List organizations, optionally filtered by association")
    @operationId("listOrganizations")
    @get
    @useAuth(bearerAuth)
    listOrganizations(...PaginationQuery, @query associationId?: string, @query status?: OrgLifecycleStatus): ApiOkResponse<PaginatedResponse<Organization>> | ApiUnauthorizedResponse;

    @doc("Update an organization")
    @operationId("updateOrganization")
    @patch(#{implicitOptionality: true})
    @route("/{organizationId}")
    @useAuth(bearerAuth)
    @extension("x-audit", #{ action: "update", resourceType: "organization" })
    updateOrganization(@path organizationId: string, @body updates: OrganizationRequest): ApiOkResponse<Organization> | ApiNotFoundResponse | ApiBadRequestResponse;

    @doc("Transition org lifecycle status")
    @operationId("transitionOrgStatus")
    @post
    @route("/{organizationId}/transition")
    @useAuth(bearerAuth)
    @extension("x-audit", #{ action: "update", resourceType: "organization" })
    transitionOrgStatus(@path organizationId: string, @body body: { status: OrgLifecycleStatus }): ApiOkResponse<Organization> | ApiNotFoundResponse | ApiBadRequestResponse;
  }

  @doc("Feature flag management")
  interface FeatureFlagManagement {
    @doc("Set a feature flag")
    @operationId("setFeatureFlag")
    @post
    @useAuth(bearerAuth)
    @extension("x-audit", #{ action: "update", resourceType: "feature-flag" })
    setFeatureFlag(@body body: FeatureFlagRequest): ApiOkResponse<FeatureFlagConfig> | ApiBadRequestResponse | ApiUnauthorizedResponse;

    @doc("List feature flags for a target")
    @operationId("listFeatureFlags")
    @get
    @useAuth(bearerAuth)
    listFeatureFlags(@query targetType?: string, @query targetId?: string): ApiOkResponse<FeatureFlagConfig[]> | ApiUnauthorizedResponse;

    @doc("Delete a feature flag override")
    @operationId("deleteFeatureFlag")
    @delete
    @route("/{flagId}")
    @useAuth(bearerAuth)
    @extension("x-audit", #{ action: "delete", resourceType: "feature-flag" })
    deleteFeatureFlag(@path flagId: string): ApiNoContentResponse | ApiNotFoundResponse;
  }

  @doc("User impersonation for support")
  interface ImpersonationManagement {
    @doc("Start an impersonation session (read-only, 30-min expiry)")
    @operationId("startImpersonation")
    @post
    @useAuth(bearerAuth)
    @extension("x-audit", #{ action: "create", resourceType: "impersonation-session", eventSubType: "authentication.impersonation-started" })
    startImpersonation(@body body: { targetUserId: string; targetOrgId?: string }): ApiCreatedResponse<ImpersonationSession> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

    @doc("End an active impersonation session")
    @operationId("endImpersonation")
    @post
    @route("/{sessionId}/end")
    @useAuth(bearerAuth)
    @extension("x-audit", #{ action: "update", resourceType: "impersonation-session", eventSubType: "authentication.impersonation-ended" })
    endImpersonation(@path sessionId: string): ApiOkResponse<ImpersonationSession> | ApiNotFoundResponse;
  }

  @doc("Platform admin team management")
  interface AdminManagement {
    @doc("Invite a new platform admin")
    @operationId("inviteAdmin")
    @post
    @useAuth(bearerAuth)
    @extension("x-audit", #{ action: "create", resourceType: "platform-admin" })
    inviteAdmin(@body body: PlatformAdminRequest): ApiCreatedResponse<PlatformAdmin> | ApiBadRequestResponse | ApiConflictResponse | ApiUnauthorizedResponse;

    @doc("List platform admins")
    @operationId("listAdmins")
    @get
    @useAuth(bearerAuth)
    listAdmins(): ApiOkResponse<PlatformAdmin[]> | ApiUnauthorizedResponse;

    @doc("Update an admin's role")
    @operationId("updateAdmin")
    @patch(#{implicitOptionality: true})
    @route("/{adminId}")
    @useAuth(bearerAuth)
    @extension("x-audit", #{ action: "update", resourceType: "platform-admin" })
    updateAdmin(@path adminId: string, @body updates: PlatformAdminRequest): ApiOkResponse<PlatformAdmin> | ApiNotFoundResponse | ApiBadRequestResponse;

    @doc("Revoke admin access")
    @operationId("revokeAdmin")
    @delete
    @route("/{adminId}")
    @useAuth(bearerAuth)
    @extension("x-audit", #{ action: "delete", resourceType: "platform-admin" })
    revokeAdmin(@path adminId: string): ApiNoContentResponse | ApiNotFoundResponse | ApiConflictResponse;
  }
}
