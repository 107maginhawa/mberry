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
}
