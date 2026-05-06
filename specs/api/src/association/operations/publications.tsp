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
 * Domains 47-48: Publications & Special Interest Groups (SIGs) / Forums
 *
 * Covers the full lifecycle of journals, newsletters, and magazines including
 * issues and articles, as well as member-driven special interest groups with
 * their own membership rosters.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Publication type category")
enum PublicationType {
  @doc("Peer-reviewed academic journal")
  journal: "journal",

  @doc("Member newsletter")
  newsletter: "newsletter",

  @doc("Trade magazine")
  magazine: "magazine",

  @doc("Research white paper series")
  whitePaper: "white_paper",

  @doc("Industry or committee report series")
  report: "report",
}

@doc("Publication frequency")
enum PublicationFrequency {
  @doc("Published monthly")
  monthly: "monthly",

  @doc("Published quarterly")
  quarterly: "quarterly",

  @doc("Published annually")
  annual: "annual",
}

@doc("Lifecycle status of a publication")
enum PublicationStatus {
  @doc("Publication is actively producing issues")
  active: "active",

  @doc("Publication has been temporarily suspended")
  suspended: "suspended",

  @doc("Publication has been retired and is no longer active")
  retired: "retired",
}

@doc("Lifecycle status of a publication issue")
enum PublicationIssueStatus {
  @doc("Issue is in draft/authoring stage")
  draft: "draft",

  @doc("Issue is under editorial review")
  inReview: "in_review",

  @doc("Issue has been published")
  published: "published",

  @doc("Issue has been retracted after publication")
  retracted: "retracted",
}

@doc("Access control level for an article")
enum ArticleAccessLevel {
  @doc("Freely available to the public")
  openAccess: "open_access",

  @doc("Available to association members only")
  memberOnly: "member_only",

  @doc("Available to paid subscribers")
  subscriber: "subscriber",

  @doc("Available for individual purchase")
  payPerView: "pay_per_view",
}

@doc("Lifecycle status of an article")
enum ArticleStatus {
  @doc("Submitted for consideration")
  submitted: "submitted",

  @doc("Undergoing peer review")
  peerReview: "peer_review",

  @doc("Accepted for publication")
  accepted: "accepted",

  @doc("Published in an issue")
  published: "published",

  @doc("Retracted after publication")
  retracted: "retracted",
}

@doc("Status of a Special Interest Group")
enum SIGStatus {
  @doc("SIG proposal submitted and awaiting approval")
  proposed: "proposed",

  @doc("SIG is active and holding meetings")
  active: "active",

  @doc("SIG has become inactive")
  dormant: "dormant",

  @doc("SIG has been formally dissolved")
  dissolved: "dissolved",
}

@doc("Member role within a SIG")
enum SIGMemberRole {
  @doc("Standard SIG member")
  member: "member",

  @doc("SIG chair")
  chair: "chair",

  @doc("SIG vice-chair")
  viceChair: "vice_chair",

  @doc("SIG secretary")
  secretary: "secretary",
}

@doc("Status of a SIG membership")
enum SIGMembershipStatus {
  @doc("Active member")
  active: "active",

  @doc("Member resigned")
  resigned: "resigned",

  @doc("Member was removed")
  removed: "removed",
}

// ---------------------------------------------------------------------------
// Domain Models
// ---------------------------------------------------------------------------

@doc("An association publication (journal, newsletter, magazine, etc.)")
model Publication extends BaseEntity {

  @doc("Publication display title")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Publication type category")
  type: PublicationType;

  @doc("Brief description of scope and purpose")
  description?: string;

  @doc("Publishing frequency")
  frequency?: PublicationFrequency;

  @doc("Person responsible for editorial oversight")
  editorId?: string;

  @doc("Current lifecycle status")
  status: PublicationStatus;
}

@doc("A single issue within a publication")
model PublicationIssue extends BaseEntity {

  @doc("Parent publication")
  publicationId: string;

  @doc("Issue number (e.g., 'Vol. 12 No. 3', '2024-Q1')")
  @minLength(1)
  @maxLength(100)
  issueNumber: string;

  @doc("Issue display title")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Planned or actual publication date")
  publishDate: utcDateTime;

  @doc("Current issue status")
  status: PublicationIssueStatus;

  @doc("URL of the cover image")
  coverImageUrl?: string;

  @doc("Formatted table of contents text")
  tableOfContents?: string;
}

@doc("An article within a publication issue")
model Article extends BaseEntity {

  @doc("Parent issue")
  issueId: string;

  @doc("Article title")
  @minLength(1)
  @maxLength(500)
  title: string;

  @doc("Author person identifiers (ordered)")
  authorIds: string[];

  @doc("Structured abstract summarizing the article")
  abstract?: string;

  @doc("Full article content (may be stored as rich text or HTML)")
  content?: string;

  @doc("Search and classification keywords")
  keywords?: string[];

  @doc("Digital Object Identifier")
  @maxLength(100)
  doi?: string;

  @doc("Access control level for this article")
  accessLevel: ArticleAccessLevel;

  @doc("Current article status")
  status: ArticleStatus;
}

@doc("A member-driven Special Interest Group")
model SpecialInterestGroup extends BaseEntity {

  @doc("SIG display name")
  @minLength(1)
  @maxLength(255)
  name: string;

  @doc("Parent organization")
  organizationId: string;

  @doc("SIG purpose and focus area")
  description?: string;

  @doc("Current SIG chair person identifier")
  chairId?: string;

  @doc("Maximum membership cap")
  @minValue(1)
  maxMembers?: int32;

  @doc("Current active member count")
  @minValue(0)
  memberCount: int32;

  @doc("Current SIG status")
  status: SIGStatus;
}

@doc("A person's membership record within a SIG")
model SIGMembership extends BaseEntity {

  @doc("Parent SIG")
  sigId: string;

  @doc("Member person identifier")
  personId: string;

  @doc("UTC timestamp when the person joined the SIG")
  joinedAt: utcDateTime;

  @doc("Member's role within the SIG")
  role: SIGMemberRole;

  @doc("Current membership status")
  status: SIGMembershipStatus;
}

// ---------------------------------------------------------------------------
// Request / Response Models
// ---------------------------------------------------------------------------

@doc("Request body for creating a publication")
model PublicationCreateRequest {
  @doc("Publication title")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Publication type")
  type: PublicationType;

  @doc("Description")
  description?: string;

  @doc("Frequency")
  frequency?: PublicationFrequency;

  @doc("Editor person identifier")
  editorId?: string;
}

@doc("Request body for creating a publication issue")
model PublicationIssueCreateRequest {
  @doc("Parent publication")
  publicationId: string;

  @doc("Issue number string")
  @minLength(1)
  @maxLength(100)
  issueNumber: string;

  @doc("Issue title")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Planned publication date")
  publishDate: utcDateTime;

  @doc("Cover image URL")
  coverImageUrl?: string;

  @doc("Table of contents")
  tableOfContents?: string;
}

@doc("Query parameters for publication issue search")
model IssueSearchParams {
  ...PaginationQuery;

  @doc("Filter by parent publication")
  @query
  publicationId?: string;

  @doc("Filter by issue status")
  @query
  status?: string;
}

@doc("Request body for creating an article")
model ArticleCreateRequest {
  @doc("Parent issue")
  issueId: string;

  @doc("Article title")
  @minLength(1)
  @maxLength(500)
  title: string;

  @doc("Author identifiers in order")
  authorIds: string[];

  @doc("Article abstract")
  abstract?: string;

  @doc("Full article content")
  content?: string;

  @doc("Keywords")
  keywords?: string[];

  @doc("DOI")
  doi?: string;

  @doc("Access level")
  accessLevel: ArticleAccessLevel;
}

@doc("Query parameters for article search")
model ArticleSearchParams {
  ...PaginationQuery;

  @doc("Filter by issue")
  @query
  issueId?: string;

  @doc("Filter by access level")
  @query
  accessLevel?: ArticleAccessLevel;

  @doc("Filter by status")
  @query
  status?: ArticleStatus;
}

@doc("Request body for creating a SIG")
model SIGCreateRequest {
  @doc("SIG name")
  @minLength(1)
  @maxLength(255)
  name: string;

  @doc("Parent organization")
  organizationId: string;

  @doc("SIG description")
  description?: string;

  @doc("Initial chair person identifier")
  chairId?: string;

  @doc("Maximum member cap")
  @minValue(1)
  maxMembers?: int32;
}

@doc("Query parameters for SIG search")
model SIGSearchParams {
  ...PaginationQuery;

  @doc("Filter by organization")
  @query
  organizationId?: string;

  @doc("Filter by status")
  @query
  status?: SIGStatus;
}

@doc("Request body for adding a member to a SIG")
model SIGMembershipCreateRequest {
  @doc("Target SIG")
  sigId: string;

  @doc("Person joining the SIG")
  personId: string;

  @doc("Member's role in the SIG")
  role: SIGMemberRole;
}

@doc("Query parameters for SIG membership search")
model SIGMembershipSearchParams {
  ...PaginationQuery;

  @doc("Filter by SIG")
  @query
  sigId?: string;

  @doc("Filter by person")
  @query
  personId?: string;

  @doc("Filter by membership status")
  @query
  status?: SIGMembershipStatus;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@route("/association/publications")
@tag("Association:Operations")
namespace Association.Operations.Publications {

  /**
   * Publication catalog management.
   */
  @useAuth(bearerAuth)
  interface PublicationManagement {
    @doc("Create a new publication.")
    @operationId("createPublication")
    @post
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createPublication(
      @body body: PublicationCreateRequest
    ): ApiCreatedResponse<Publication>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a publication by ID.")
    @operationId("getPublication")
    @get
    @route("/{publicationId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    getPublication(
      @path publicationId: string
    ): ApiOkResponse<Publication>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a publication.")
    @operationId("updatePublication")
    @patch(#{implicitOptionality: true})
    @route("/{publicationId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updatePublication(
      @path publicationId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<Publication>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a publication.")
    @operationId("deletePublication")
    @delete
    @route("/{publicationId}")
    @extension("x-security-required-roles", #["association:admin"])
    deletePublication(
      @path publicationId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search publications.")
    @operationId("searchPublications")
    @get
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    searchPublications(
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<Publication>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  /**
   * Publication issue management including publish workflow.
   */
  @useAuth(bearerAuth)
  interface PublicationIssueManagement {
    @doc("Create a new publication issue.")
    @operationId("createPublicationIssue")
    @post
    @route("/issues")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createPublicationIssue(
      @body body: PublicationIssueCreateRequest
    ): ApiCreatedResponse<PublicationIssue>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a publication issue by ID.")
    @operationId("getPublicationIssue")
    @get
    @route("/issues/{issueId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    getPublicationIssue(
      @path issueId: string
    ): ApiOkResponse<PublicationIssue>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a publication issue.")
    @operationId("updatePublicationIssue")
    @patch(#{implicitOptionality: true})
    @route("/issues/{issueId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updatePublicationIssue(
      @path issueId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<PublicationIssue>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a publication issue.")
    @operationId("deletePublicationIssue")
    @delete
    @route("/issues/{issueId}")
    @extension("x-security-required-roles", #["association:admin"])
    deletePublicationIssue(
      @path issueId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search publication issues with filtering and pagination.")
    @operationId("searchPublicationIssues")
    @get
    @route("/issues")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    searchPublicationIssues(
      ...IssueSearchParams
    ): ApiOkResponse<PaginatedResponse<PublicationIssue>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Publish an issue making it available to readers.")
    @operationId("publishPublicationIssue")
    @post
    @route("/issues/{issueId}/publish")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    publishPublicationIssue(
      @path issueId: string
    ): ApiOkResponse<PublicationIssue>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;
  }

  /**
   * Article management within publication issues.
   */
  @useAuth(bearerAuth)
  interface ArticleManagement {
    @doc("Create a new article.")
    @operationId("createArticle")
    @post
    @route("/articles")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createArticle(
      @body body: ArticleCreateRequest
    ): ApiCreatedResponse<Article>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get an article by ID.")
    @operationId("getArticle")
    @get
    @route("/articles/{articleId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    getArticle(
      @path articleId: string
    ): ApiOkResponse<Article>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update an article.")
    @operationId("updateArticle")
    @patch(#{implicitOptionality: true})
    @route("/articles/{articleId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateArticle(
      @path articleId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<Article>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete an article.")
    @operationId("deleteArticle")
    @delete
    @route("/articles/{articleId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteArticle(
      @path articleId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search articles with filtering and pagination.")
    @operationId("searchArticles")
    @get
    @route("/articles")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    searchArticles(
      ...ArticleSearchParams
    ): ApiOkResponse<PaginatedResponse<Article>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  /**
   * Special Interest Group management.
   */
  @useAuth(bearerAuth)
  interface SIGManagement {
    @doc("Create a new Special Interest Group.")
    @operationId("createSIG")
    @post
    @route("/sigs")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createSIG(
      @body body: SIGCreateRequest
    ): ApiCreatedResponse<SpecialInterestGroup>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a SIG by ID.")
    @operationId("getSIG")
    @get
    @route("/sigs/{sigId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    getSIG(
      @path sigId: string
    ): ApiOkResponse<SpecialInterestGroup>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a SIG.")
    @operationId("updateSIG")
    @patch(#{implicitOptionality: true})
    @route("/sigs/{sigId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateSIG(
      @path sigId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<SpecialInterestGroup>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a SIG.")
    @operationId("deleteSIG")
    @delete
    @route("/sigs/{sigId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteSIG(
      @path sigId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search SIGs with filtering and pagination.")
    @operationId("searchSIGs")
    @get
    @route("/sigs")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    searchSIGs(
      ...SIGSearchParams
    ): ApiOkResponse<PaginatedResponse<SpecialInterestGroup>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  /**
   * SIG membership roster management.
   */
  @useAuth(bearerAuth)
  interface SIGMembershipManagement {
    @doc("Add a member to a SIG.")
    @operationId("createSIGMembership")
    @post
    @route("/sigs/memberships")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member:owner"])
    createSIGMembership(
      @body body: SIGMembershipCreateRequest
    ): ApiCreatedResponse<SIGMembership>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a SIG membership record by ID.")
    @operationId("getSIGMembership")
    @get
    @route("/sigs/memberships/{membershipId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    getSIGMembership(
      @path membershipId: string
    ): ApiOkResponse<SIGMembership>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a SIG membership record.")
    @operationId("updateSIGMembership")
    @patch(#{implicitOptionality: true})
    @route("/sigs/memberships/{membershipId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateSIGMembership(
      @path membershipId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<SIGMembership>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Remove a member from a SIG.")
    @operationId("deleteSIGMembership")
    @delete
    @route("/sigs/memberships/{membershipId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    deleteSIGMembership(
      @path membershipId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search SIG memberships with filtering and pagination.")
    @operationId("searchSIGMemberships")
    @get
    @route("/sigs/memberships")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    searchSIGMemberships(
      ...SIGMembershipSearchParams
    ): ApiOkResponse<PaginatedResponse<SIGMembership>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
