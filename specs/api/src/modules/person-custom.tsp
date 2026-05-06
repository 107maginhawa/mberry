import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Person Custom Module
 *
 * Custom endpoints for authenticated users accessing their own data.
 * Routes under /persons/me — all require a valid Bearer session.
 */

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

@doc("Summary of a person's membership in an organisation")
model MyMembership {
  @doc("Membership record ID")
  id: UUID;

  @doc("Organisation ID the membership belongs to")
  organizationId: UUID;

  @doc("Member number assigned by the organisation")
  memberNumber?: string;

  @doc("Membership tier ID")
  tierId?: UUID;

  @doc("Current membership status")
  status: string;

  @doc("Date the membership started")
  startDate?: utcDateTime;

  @doc("Date the membership expires")
  endDate?: utcDateTime;
}

@doc("Lifetime credit total for the authenticated person")
model MyCreditSummary {
  @doc("Total CPD credits earned across all cycles")
  totalCredits: int32;
}

@doc("DPA 2012 personal data export envelope")
model MyDataExport {
  @doc("ISO 8601 timestamp when the export was generated")
  exportedAt: string;

  @doc("List of data categories included in the export")
  categories: string[];

  @doc("Person profile record (internal fields stripped)")
  profile: Record<unknown>;

  @doc("All membership records for this person")
  memberships: unknown[];

  @doc("All dues payment records for this person")
  payments: unknown[];

  @doc("All CPD credit entries for this person")
  credits: unknown[];

  @doc("Notification history for this person")
  notifications: unknown[];
}

@doc("Response from account deletion request")
model AccountDeletionResponse {
  @doc("ISO 8601 timestamp when deletion is scheduled to execute")
  deletionScheduledAt: string;

  @doc("Number of days in the grace period before deletion executes")
  gracePeriodDays: int32;
}

@doc("Cancel account deletion response")
model CancelDeletionResponse {
  @doc("Confirmation message")
  message: string;
}

@doc("Request body for creating a manual credit entry")
model CreateCreditEntryRequest {
  @doc("Name of the CPD activity")
  @minLength(1)
  @maxLength(255)
  activityName: string;

  @doc("Date the activity was completed (ISO 8601)")
  activityDate?: string;

  @doc("Number of CPD credits earned for this activity")
  @minValue(0)
  creditAmount: int32;

  @doc("Organisation ID to associate the entry with; defaults to user's first membership org")
  organizationId?: UUID;
}

@doc("A single CPD credit entry")
model CreditEntry extends BaseEntity {
  @doc("Person this credit belongs to")
  personId: UUID;

  @doc("Organisation the credit is associated with")
  organizationId: UUID;

  @doc("Name of the CPD activity")
  activityName: string;

  @doc("Date the activity was completed")
  activityDate: utcDateTime;

  @doc("Number of CPD credits")
  creditAmount: int32;

  @doc("Entry type (manual or system)")
  type: string;

  @doc("Start of the CPD cycle this entry counts toward")
  cycleStart: utcDateTime;

  @doc("End of the CPD cycle this entry counts toward")
  cycleEnd: utcDateTime;
}

@doc("Officer role data for a specific organisation")
model OfficerRoleData {
  @doc("Whether the authenticated user is an active officer in the org")
  isOfficer: boolean;

  @doc("List of active officer positions held by the user")
  positions: OfficerPosition[];
}

@doc("A single officer position held by the authenticated user")
model OfficerPosition {
  @doc("Position ID")
  id: UUID;

  @doc("Position title")
  title: string;

  @doc("Term record ID")
  termId: UUID;

  @doc("Term start date")
  startDate?: utcDateTime;

  @doc("Term end date")
  endDate?: utcDateTime;
}

@doc("Officer role response wrapper")
model OfficerRoleResponse {
  @doc("Officer role data for the requested org")
  data: OfficerRoleData;
}

@doc("Privacy visibility settings for the authenticated user in an organisation")
model PrivacySettings {
  @doc("Person ID")
  personId: UUID;

  @doc("Organisation scope for these settings")
  orgId?: UUID;

  @doc("Whether email is visible to other members in the directory")
  emailVisible: boolean;

  @doc("Whether phone number is visible to other members in the directory")
  phoneVisible: boolean;

  @doc("Whether profile photo is visible to other members in the directory")
  photoVisible: boolean;

  @doc("Whether address is visible to other members in the directory")
  addressVisible: boolean;
}

@doc("Request body for updating privacy settings")
model UpdatePrivacySettingsRequest {
  @doc("Organisation scope — required to scope the update")
  orgId: UUID;

  @doc("Whether email is visible to other members in the directory")
  emailVisible?: boolean;

  @doc("Whether phone number is visible to other members in the directory")
  phoneVisible?: boolean;

  @doc("Whether profile photo is visible to other members in the directory")
  photoVisible?: boolean;

  @doc("Whether address is visible to other members in the directory")
  addressVisible?: boolean;
}

@doc("Notification preference for a single category")
model NotificationPreference {
  @doc("Notification category (e.g. dues, events, credits)")
  category: string;

  @doc("Whether push notifications are enabled for this category")
  pushEnabled: boolean;

  @doc("Whether email notifications are enabled for this category")
  emailEnabled: boolean;

  @doc("Whether in-app notifications are enabled (always true per M02-R8)")
  inApp: boolean;
}

@doc("Request body for updating notification preferences")
model UpdateNotificationPreferencesRequest {
  @doc("List of preference updates to apply")
  preferences: NotificationPreferenceUpdate[];
}

@doc("A single notification preference update")
model NotificationPreferenceUpdate {
  @doc("Notification category to update")
  @minLength(1)
  category: string;

  @doc("Whether push notifications should be enabled")
  pushEnabled?: boolean;

  @doc("Whether email notifications should be enabled")
  emailEnabled?: boolean;
}

@doc("Partial person update request scoped to /persons/me")
model PersonMeUpdateRequest {
  @doc("First name")
  @maxLength(50)
  firstName?: string;

  @doc("Last name")
  @maxLength(50)
  lastName?: string;

  @doc("Middle name")
  @maxLength(50)
  middleName?: string;

  @doc("Professional specialization")
  @maxLength(100)
  specialization?: string;

  @doc("Date of birth (ISO 8601 date string)")
  dateOfBirth?: string;

  @doc("Gender identity")
  gender?: string;

  @doc("Primary phone number in E.164 format")
  phone?: string;

  @doc("IANA timezone identifier")
  timezone?: string;

  @doc("Preferred language code (ISO 639-1)")
  preferredLanguage?: string;
}

// ---------------------------------------------------------------------------
// Namespace / Interface
// ---------------------------------------------------------------------------

@route("/persons/me")
@tag("Person")
namespace PersonCustomModule {
  /**
   * Custom authenticated endpoints for the current user's own data.
   */
  interface PersonCustomManagement {
    @doc("List all memberships for the authenticated user across all organisations.")
    @operationId("getMyMemberships")
    @get
    @route("/memberships")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    getMyMemberships(): ApiOkResponse<{ data: MyMembership[] }>
      | ApiUnauthorizedResponse;

    @doc("Get lifetime CPD credit total for the authenticated user.")
    @operationId("getMyCreditSummary")
    @get
    @route("/credit-summary")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    getMyCreditSummary(): ApiOkResponse<MyCreditSummary>
      | ApiUnauthorizedResponse;

    @doc("Export all personal data for the authenticated user (DPA 2012 portability right).")
    @operationId("exportMyData")
    @get
    @route("/export")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    exportMyData(): ApiOkResponse<MyDataExport>
      | ApiUnauthorizedResponse
      | ApiNotFoundResponse;

    @doc("Request account deletion with a 30-day grace period (DPA 2012 / BR-32).")
    @operationId("requestMyAccountDeletion")
    @post
    @route("/delete")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    requestMyAccountDeletion(): ApiOkResponse<AccountDeletionResponse>
      | ApiUnauthorizedResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;

    @doc("Cancel a pending account deletion request during the grace period.")
    @operationId("cancelMyAccountDeletion")
    @post
    @route("/cancel-delete")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    cancelMyAccountDeletion(): ApiOkResponse<CancelDeletionResponse>
      | ApiUnauthorizedResponse
      | ApiNotFoundResponse;

    @doc("Create a manual CPD credit entry for the authenticated user (BR-13).")
    @operationId("createMyCreditEntry")
    @post
    @route("/credit-entries")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createMyCreditEntry(
      @body entry: CreateCreditEntryRequest
    ): ApiCreatedResponse<{ data: CreditEntry }>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @doc("List CPD credit entries for the authenticated user (most recent first, limit 50).")
    @operationId("listMyCreditEntries")
    @get
    @route("/credit-entries")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listMyCreditEntries(): ApiOkResponse<{ data: CreditEntry[] }>
      | ApiUnauthorizedResponse;

    @doc("Check whether the authenticated user holds an active officer position in the specified organisation.")
    @operationId("getMyOfficerRole")
    @get
    @route("/officer-role/{orgId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    getMyOfficerRole(
      @path @doc("Organisation ID to check officer status for") orgId: UUID
    ): ApiOkResponse<OfficerRoleResponse>
      | ApiUnauthorizedResponse
      | ApiBadRequestResponse;

    @doc("Get directory privacy visibility settings for the authenticated user.")
    @operationId("getMyPrivacySettings")
    @get
    @route("/privacy")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    getMyPrivacySettings(
      @query @doc("Organisation ID to scope the privacy settings lookup") orgId?: UUID
    ): ApiOkResponse<PrivacySettings | PrivacySettings[]>
      | ApiUnauthorizedResponse;

    @doc("Update directory privacy visibility settings for the authenticated user.")
    @operationId("updateMyPrivacySettings")
    @patch(#{implicitOptionality: true})
    @route("/privacy")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    updateMyPrivacySettings(
      @body updates: UpdatePrivacySettingsRequest
    ): ApiOkResponse<PrivacySettings>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @doc("Get notification preferences for all categories for the authenticated user.")
    @operationId("getMyNotificationPreferences")
    @get
    @route("/notification-preferences")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    getMyNotificationPreferences(): ApiOkResponse<NotificationPreference[]>
      | ApiUnauthorizedResponse;

    @doc("Update notification preferences for the authenticated user.")
    @operationId("updateMyNotificationPreferences")
    @patch(#{implicitOptionality: true})
    @route("/notification-preferences")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    updateMyNotificationPreferences(
      @body updates: UpdateNotificationPreferencesRequest
    ): ApiOkResponse<NotificationPreference[]>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @doc("Update the authenticated user's own person profile (accepts 'me' path — bypasses UUID validation).")
    @operationId("updateMyProfile")
    @patch(#{implicitOptionality: true})
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    updateMyProfile(
      @body updates: PersonMeUpdateRequest
    ): ApiOkResponse<Record<unknown>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiNotFoundResponse;
  }
}
