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
 * Association Member — Certificates
 *
 * Issued certificates for members who have completed a training activity.
 * Certificates are immutable records issued by the association and viewable
 * by the member who holds them.
 */

// ---------------------------------------------------------------------------
// Entity Models
// ---------------------------------------------------------------------------

@doc("A certificate issued to a member upon completing a training activity")
model Certificate extends BaseEntity {

  @doc("ID of the organization that issued the certificate")
  organizationId: string;

  @doc("ID of the person the certificate was issued to")
  personId: string;

  @doc("ID of the training activity this certificate relates to")
  trainingId: string;

  @doc("Unique certificate number for verification")
  @minLength(1)
  @maxLength(50)
  certificateNumber: string;

  @doc("Date and time the certificate was issued")
  issuedAt: utcDateTime;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Request / Response Models
// ---------------------------------------------------------------------------

@doc("Public certificate verification result")
model CertificateVerificationResult {
  @doc("Certificate number")
  certificateNumber: string;

  @doc("Name of the certificate holder")
  holderName: string;

  @doc("When the certificate was issued")
  issuedAt: utcDateTime;

  @doc("Certificate status (issued, revoked)")
  status: string;

  @doc("Number of CPD credit hours awarded")
  creditHours?: float64;

  @doc("CPD activity type")
  cpdActivityType?: string;

  @doc("Whether the certificate is currently valid (not revoked)")
  isValid: boolean;
}

@doc("Request body for bulk certificate issuance")
model BulkIssueCertificatesRequest {
  @doc("Organization ID issuing the certificates")
  organizationId: string;

  @doc("Person IDs to issue certificates to (max 100)")
  @maxItems(100)
  personIds: string[];

  @doc("Title of the training activity")
  @minLength(1)
  trainingTitle: string;

  @doc("Type of certificate: attendance, completion, or speaker")
  certificateType: string;

  @doc("CPD activity type categorization")
  cpdActivityType?: string;

  @doc("Number of CPD credit hours")
  creditHours?: float64;

  @doc("Template ID for certificate generation")
  templateId?: string;

  @doc("ID of the signing officer")
  signingOfficerId: string;

  @doc("Organization code for certificate numbering")
  @minLength(1)
  orgCode: string;

  @doc("Organization branding overrides")
  orgBranding?: Record<unknown>;

  @doc("Signatory name override")
  signatoryName?: string;

  @doc("Signatory title override")
  signatoryTitle?: string;
}

@doc("Result of an individual certificate issuance")
model BulkIssueCertificateResult {
  @doc("Person ID the certificate was issued to")
  personId: string;

  @doc("Generated certificate number (or ERROR if failed)")
  certificateNumber: string;

  @doc("URL to the generated PDF (null if not yet generated)")
  pdfUrl: string | null;
}

@doc("Bulk issuance response when queued as a background job")
model BulkIssueQueuedResponse {
  @doc("Processing status")
  status: string;

  @doc("Background job ID for tracking")
  jobId: string;

  @doc("Human-readable message")
  message: string;
}

@route("/association/member/certificates")
@tag("Association:Member")
namespace Association.Member.Certificates {
  @doc("Read-only certificate access for members — list own certificates and retrieve by ID")
  interface CertificateManagement {
    @doc("List certificates issued to the authenticated member.")
    @operationId("listMyCertificates")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:member"])
    listMyCertificates(
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<Certificate>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a certificate by ID.")
    @operationId("getCertificate")
    @get
    @route("/{certificateId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:member"])
    getCertificate(
      @path certificateId: string
    ): ApiOkResponse<Certificate>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  @doc("Public certificate verification — no authentication required")
  interface CertificateVerificationService {
    @doc("Verify a certificate by its certificate number. Returns holder name, issue date, status, and CPD details.")
    @operationId("verifyCertificatePublic")
    @get
    @route("/verify/{certificateNumber}")
    verifyCertificatePublic(
      @path certificateNumber: string,
    ): ApiOkResponse<{ data: CertificateVerificationResult }>
      | ApiNotFoundResponse;
  }

  @doc("Bulk certificate issuance for officers (President/Secretary)")
  interface CertificateBulkIssuance {
    @doc("Issue certificates in bulk for a list of persons. Batches >10 are queued as background jobs. Requires President or Secretary officer role.")
    @operationId("bulkIssueCertificates")
    @post
    @route("/bulk-issue")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    @extension("x-require-position", #{ titles: #["President", "Secretary"], from: "body.organizationId" })
    bulkIssueCertificates(
      @body body: BulkIssueCertificatesRequest,
    ): {
      @statusCode statusCode: 201;
      @body body: { data: BulkIssueCertificateResult[] };
    } | {
      @statusCode statusCode: 202;
      @body body: { data: BulkIssueQueuedResponse };
    }
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
