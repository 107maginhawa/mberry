import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../common/models.tsp";
import "../../common/errors.tsp";
import "../../common/pagination.tsp";
import "../../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Association Member Lifecycle — Domains 27-28: Credentials, Digital IDs & Professional Licensing
 *
 * Covers credential template design, digital credential issuance and revocation,
 * cryptographic verification, professional license tracking, and renewal alerts.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Type of credential artifact")
enum CredentialType {
  @doc("Membership card")
  memberCard: "memberCard",

  @doc("Completion certificate")
  certificate: "certificate",

  @doc("Digital achievement badge")
  badge: "badge",

  @doc("Professional license document")
  license: "license",
}

@doc("Lifecycle status of a digital credential")
enum CredentialStatus {
  @doc("Credential is valid and in good standing")
  active: "active",

  @doc("Credential has been temporarily suspended")
  suspended: "suspended",

  @doc("Credential has been permanently revoked")
  revoked: "revoked",

  @doc("Credential has passed its expiration date")
  expired: "expired",
}

@doc("Result of a credential verification attempt")
enum VerificationResult {
  @doc("Credential is valid and not expired or revoked")
  valid: "valid",

  @doc("Credential exists but has passed its expiration date")
  expired: "expired",

  @doc("Credential has been revoked")
  revoked: "revoked",

  @doc("No credential matching the supplied identifier was found")
  notFound: "notFound",
}

@doc("Lifecycle status of a professional license")
enum LicenseStatus {
  @doc("License is current and in good standing")
  active: "active",

  @doc("License has passed its expiration date")
  expired: "expired",

  @doc("License has been temporarily suspended by the issuing authority")
  suspended: "suspended",

  @doc("License has been permanently revoked")
  revoked: "revoked",

  @doc("License application is pending review by the issuing authority")
  pending: "pending",
}

@doc("Status of a license renewal alert")
enum RenewalAlertStatus {
  @doc("Alert has been created but not yet sent")
  pending: "pending",

  @doc("Alert notification has been dispatched to the member")
  sent: "sent",

  @doc("Member has acknowledged the alert")
  acknowledged: "acknowledged",

  @doc("Member has dismissed the alert")
  dismissed: "dismissed",
}

@doc("Lifecycle status of a credential template")
enum CredentialTemplateStatus {
  @doc("Template is available for credential issuance")
  active: "active",

  @doc("Template is no longer used for new credentials")
  retired: "retired",
}

// ---------------------------------------------------------------------------
// Entity Models
// ---------------------------------------------------------------------------

@doc("A reusable design template for generating digital credentials")
model CredentialTemplate extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  organizationId: string;

  @doc("Display name of the template")
  @minLength(1)
  @maxLength(100)
  name: string;

  @doc("Type of credential this template produces")
  type: CredentialType;

  @doc("JSON or HTML design specification for the credential layout")
  @maxLength(50000)
  design?: string;

  @doc("Duration (in months) for which credentials issued from this template remain valid; null means no expiry")
  @minValue(1)
  validityPeriod?: int32;

  @doc("Lifecycle status of this template")
  status: CredentialTemplateStatus;
}

@doc("A digital credential issued to a specific member")
model DigitalCredential extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  organizationId: string;

  @doc("ID of the person this credential was issued to")
  personId: string;

  @doc("ID of the template used to generate this credential")
  templateId: string;

  @doc("ID of the membership this credential is associated with (if applicable)")
  membershipId?: string;

  @doc("Human-readable or machine-readable credential identifier")
  @minLength(1)
  @maxLength(100)
  credentialNumber: string;

  @doc("Timestamp when the credential was issued")
  issuedAt: utcDateTime;

  @doc("Timestamp after which the credential is no longer valid")
  expiresAt?: utcDateTime;

  @doc("Current lifecycle status of the credential")
  status: CredentialStatus;

  @doc("Base64-encoded or JSON payload embedded in the credential's QR code")
  @maxLength(4096)
  qrPayload?: string;

  @doc("HMAC key used for server-side verification of the QR payload (never exposed to clients)")
  @maxLength(256)
  hmacKey?: string;

  @doc("URL of the generated PDF credential document")
  @format("uri")
  pdfUrl?: string;

  @doc("Public URL for online verification of this credential")
  @format("uri")
  verificationUrl?: string;
}

@doc("A log entry recording a credential verification attempt")
model CredentialVerificationLog extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  organizationId: string;

  @doc("ID of the credential that was verified")
  credentialId: string;

  @doc("Timestamp when the verification was performed")
  verifiedAt: utcDateTime;

  @doc("IP address of the verifier (anonymised for GDPR compliance where required)")
  @maxLength(45)
  verifierIp?: string;

  @doc("Result of the verification attempt")
  result: VerificationResult;
}

@doc("A professional license held by a member and tracked by the association")
model ProfessionalLicense extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  organizationId: string;

  @doc("ID of the person holding the license")
  personId: string;

  @doc("Category or type of professional license (e.g. RN, CPA, PE)")
  @minLength(1)
  @maxLength(100)
  licenseType: string;

  @doc("Official license number assigned by the issuing authority")
  @minLength(1)
  @maxLength(100)
  licenseNumber: string;

  @doc("Name of the authority that issued the license")
  @minLength(1)
  @maxLength(200)
  issuingAuthority: string;

  @doc("State, province, or country jurisdiction under which the license is valid")
  @minLength(1)
  @maxLength(100)
  jurisdiction: string;

  @doc("Date on which the license was originally issued")
  issuedDate: plainDate;

  @doc("Date on which the license expires and must be renewed")
  expirationDate: plainDate;

  @doc("Current lifecycle status of the license")
  status: LicenseStatus;

  @doc("Reference to the stored license document file")
  @maxLength(500)
  documentRef?: string;

  @doc("Timestamp when the license details were last verified by association staff")
  verifiedAt?: utcDateTime;

  @doc("ID of the staff member who last verified the license")
  verifiedBy?: string;
}

@doc("An alert notifying a member that one of their licenses is approaching expiry")
model LicenseRenewalAlert extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  organizationId: string;

  @doc("ID of the professional license triggering this alert")
  licenseId: string;

  @doc("ID of the member receiving the alert")
  personId: string;

  @doc("Date on which this alert is scheduled to be sent")
  alertDate: plainDate;

  @doc("Number of days remaining until license expiry at the time of the alert")
  @minValue(0)
  daysUntilExpiry: int32;

  @doc("Current status of this alert")
  status: RenewalAlertStatus;
}

// ---------------------------------------------------------------------------
// Request / Response Models
// ---------------------------------------------------------------------------

@doc("Request to create a credential template")
model CredentialTemplateCreateRequest {
  name: string;
  type: CredentialType;
  design?: string;
  validityPeriod?: int32;
  status: CredentialTemplateStatus;
}

@doc("Request to update a credential template")
model CredentialTemplateUpdateRequest {
  name?: string;
  design?: string | null;
  validityPeriod?: int32 | null;
  status?: TemplateStatus;
}

@doc("Request to issue a digital credential to a member")
model IssueCredentialRequest {
  personId: string;
  templateId: string;
  membershipId?: string;
  credentialNumber: string;
}

@doc("Request to revoke a digital credential")
model RevokeCredentialRequest {
  @doc("Reason for revoking the credential")
  @minLength(1)
  @maxLength(500)
  reason?: string;
}

@doc("Request to verify a digital credential")
model VerifyCredentialRequest {
  @doc("Credential number or QR payload to verify")
  @minLength(1)
  @maxLength(4096)
  token: string;
}

@doc("Result of a credential verification request")
model VerifyCredentialResult {
  @doc("Outcome of the verification")
  result: VerificationResult;

  @doc("Credential details if valid")
  credential?: DigitalCredential;

  @doc("Human-readable explanation of the result")
  @maxLength(500)
  message: string;
}

@doc("Request to create a professional license record")
model ProfessionalLicenseCreateRequest {
  personId: string;
  licenseType: string;
  licenseNumber: string;
  issuingAuthority: string;
  jurisdiction: string;
  issuedDate: plainDate;
  expirationDate: plainDate;
  status: LicenseStatus;
  documentRef?: string;
}

@doc("Request to update a professional license record")
model ProfessionalLicenseUpdateRequest {
  licenseType?: string;
  licenseNumber?: string;
  issuingAuthority?: string;
  jurisdiction?: string;
  issuedDate?: plainDate;
  expirationDate?: plainDate;
  status?: LicenseStatus;
  documentRef?: string | null;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

namespace Association.Member.Credentials {
  @doc("CRUD for credential design templates")
  interface CredentialTemplateManagement {
    @doc("Create a new credential template.")
    @operationId("createCredentialTemplate")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createCredentialTemplate(
      @body body: CredentialTemplateCreateRequest
    ): ApiCreatedResponse<CredentialTemplate>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a credential template by ID.")
    @operationId("getCredentialTemplate")
    @get
    @route("/{templateId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    getCredentialTemplate(
      @path templateId: string
    ): ApiOkResponse<CredentialTemplate>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List credential templates.")
    @operationId("listCredentialTemplates")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listCredentialTemplates(
      ...PaginationQuery,
      @query type?: CredentialType,
      @query status?: TemplateStatus
    ): ApiOkResponse<PaginatedResponse<CredentialTemplate>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a credential template.")
    @operationId("updateCredentialTemplate")
    @patch(#{implicitOptionality: true})
    @route("/{templateId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateCredentialTemplate(
      @path templateId: string,
      @body updates: CredentialTemplateUpdateRequest
    ): ApiOkResponse<CredentialTemplate>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete a credential template.")
    @operationId("deleteCredentialTemplate")
    @delete
    @route("/{templateId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteCredentialTemplate(
      @path templateId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;
  }

  @doc("CRUD, search, issuance, revocation, and verification of digital credentials")
  interface DigitalCredentialManagement {
    @doc("Issue a new digital credential to a member.")
    @operationId("issueDigitalCredential")
    @post
    @route("/issue")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    issueDigitalCredential(
      @body body: IssueCredentialRequest
    ): ApiCreatedResponse<DigitalCredential>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a digital credential by ID.")
    @operationId("getDigitalCredential")
    @get
    @route("/{credentialId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member:owner"])
    getDigitalCredential(
      @path credentialId: string
    ): ApiOkResponse<DigitalCredential>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List digital credentials with optional filters.")
    @operationId("listDigitalCredentials")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listDigitalCredentials(
      ...PaginationQuery,
      @query personId?: string,
      @query templateId?: string,
      @query status?: CredentialStatus
    ): ApiOkResponse<PaginatedResponse<DigitalCredential>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a digital credential record.")
    @operationId("updateDigitalCredential")
    @patch(#{implicitOptionality: true})
    @route("/{credentialId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateDigitalCredential(
      @path credentialId: string,
      @body updates: IssueCredentialRequest
    ): ApiOkResponse<DigitalCredential>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete a digital credential record.")
    @operationId("deleteDigitalCredential")
    @delete
    @route("/{credentialId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteDigitalCredential(
      @path credentialId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Revoke a digital credential.")
    @operationId("revokeDigitalCredential")
    @post
    @route("/{credentialId}/revoke")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    revokeDigitalCredential(
      @path credentialId: string,
      @body body: RevokeCredentialRequest
    ): ApiOkResponse<DigitalCredential>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Verify a credential by number or QR token and record the verification attempt.")
    @operationId("verifyDigitalCredentialAuthenticated")
    @post
    @route("/verify")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member"])
    verifyDigitalCredentialAuthenticated(
      @body body: VerifyCredentialRequest
    ): ApiOkResponse<VerifyCredentialResult>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  @doc("Public credential verification endpoint — no authentication required")
  interface CredentialVerificationService {
    @doc("Verify a credential by number or QR token. This endpoint is publicly accessible and records the verification event.")
    @operationId("verifyCredentialPublic")
    @post
    @useAuth(Http.NoAuth)
    @extension("x-security-required-roles", #[])
    verifyCredential(
      @body body: VerifyCredentialRequest
    ): ApiOkResponse<VerifyCredentialResult>
      | ApiBadRequestResponse;
  }

  @doc("CRUD and search for professional license records")
  interface ProfessionalLicenseManagement {
    @doc("Create a professional license record.")
    @operationId("createProfessionalLicense")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member:owner"])
    createProfessionalLicense(
      @body body: ProfessionalLicenseCreateRequest
    ): ApiCreatedResponse<ProfessionalLicense>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a professional license by ID.")
    @operationId("getProfessionalLicense")
    @get
    @route("/{licenseId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member:owner"])
    getProfessionalLicense(
      @path licenseId: string
    ): ApiOkResponse<ProfessionalLicense>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List professional licenses with optional filters.")
    @operationId("listProfessionalLicenses")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listProfessionalLicenses(
      ...PaginationQuery,
      @query personId?: string,
      @query licenseType?: string,
      @query status?: LicenseStatus,
      @query jurisdiction?: string
    ): ApiOkResponse<PaginatedResponse<ProfessionalLicense>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a professional license record.")
    @operationId("updateProfessionalLicense")
    @patch(#{implicitOptionality: true})
    @route("/{licenseId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateProfessionalLicense(
      @path licenseId: string,
      @body updates: ProfessionalLicenseUpdateRequest
    ): ApiOkResponse<ProfessionalLicense>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete a professional license record.")
    @operationId("deleteProfessionalLicense")
    @delete
    @route("/{licenseId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteProfessionalLicense(
      @path licenseId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;
  }

  @doc("Search and acknowledge license renewal alerts")
  interface LicenseRenewalAlertService {
    @doc("List license renewal alerts with optional filters.")
    @operationId("listLicenseRenewalAlerts")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member:owner"])
    listLicenseRenewalAlerts(
      ...PaginationQuery,
      @query personId?: string,
      @query licenseId?: string,
      @query status?: RenewalAlertStatus
    ): ApiOkResponse<PaginatedResponse<LicenseRenewalAlert>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Acknowledge a license renewal alert.")
    @operationId("acknowledgeLicenseRenewalAlert")
    @post
    @route("/{alertId}/acknowledge")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:member:owner"])
    acknowledgeLicenseRenewalAlert(
      @path alertId: string
    ): ApiOkResponse<LicenseRenewalAlert>
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
