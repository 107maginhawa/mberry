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
 * Association Member Lifecycle — Domain 26: Member Directory
 *
 * Covers member-controlled directory profiles with granular visibility settings
 * and a searchable index supporting full-text and geo-spatial lookup.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Visibility level of a member directory profile")
enum DirectoryVisibility {
  @doc("Profile is visible to anyone on the internet without authentication")
  public: "public",

  @doc("Profile is visible to authenticated association members only")
  memberOnly: "memberOnly",

  @doc("Profile is hidden from directory listings and searches")
  hidden: "hidden",
}

// ---------------------------------------------------------------------------
// Entity Models
// ---------------------------------------------------------------------------

@doc("A member's curated public-facing profile in the association directory")
model DirectoryProfile extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  tenantId: string;

  @doc("ID of the person this profile belongs to")
  personId: string;

  @doc("Name as it should appear in the directory")
  @minLength(1)
  @maxLength(150)
  displayName: string;

  @doc("Professional title shown in the directory")
  @maxLength(100)
  title?: string;

  @doc("Employer or organization shown in the directory")
  @maxLength(150)
  organization?: string;

  @doc("Area of professional specialty")
  @maxLength(150)
  specialty?: string;

  @doc("City, state, or region used as a location label")
  @maxLength(150)
  location?: string;

  @doc("URL of the member's directory photo")
  @format("uri")
  photoUrl?: string;

  @doc("Short biography displayed on the directory profile")
  @maxLength(3000)
  bio?: string;

  @doc("Email address shown in the directory (may differ from account email)")
  @format("email")
  contactEmail?: string;

  @doc("Phone number shown in the directory")
  contactPhone?: string;

  @doc("Personal or professional website URL")
  @format("uri")
  website?: string;

  @doc("Map of social network names to profile URLs (e.g. { \"linkedin\": \"https://...\" })")
  socialLinks?: Record<unknown>;

  @doc("Controls who can view this profile in the directory")
  visibility: DirectoryVisibility;

  @doc("Timestamp when the profile was first published to the directory")
  publishedAt?: utcDateTime;

  @doc("Timestamp of the most recent profile update")
  lastUpdatedAt: utcDateTime;
}

@doc("Optimized search index entry for a member directory profile")
model DirectorySearchIndex extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  tenantId: string;

  @doc("ID of the person this index entry represents")
  personId: string;

  @doc("Concatenated searchable text derived from the directory profile fields")
  @minLength(1)
  searchableText: string;

  @doc("Tags used for faceted filtering (e.g. specialty tags, chapter names)")
  tags: string[];

  @doc("Geographic coordinates enabling proximity-based search")
  geoLocation?: GeoCoordinates;

  @doc("Whether the profile has been verified by association staff")
  verified: boolean;
}

// ---------------------------------------------------------------------------
// Request / Response Models
// ---------------------------------------------------------------------------

@doc("Request to create a directory profile")
model DirectoryProfileCreateRequest {
  personId: string;
  displayName: string;
  title?: string;
  organization?: string;
  specialty?: string;
  location?: string;
  photoUrl?: string;
  bio?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  socialLinks?: Record<unknown>;
  visibility: DirectoryVisibility;
}

@doc("Request to update a directory profile")
model DirectoryProfileUpdateRequest {
  displayName?: string;
  title?: string | null;
  organization?: string | null;
  specialty?: string | null;
  location?: string | null;
  photoUrl?: string | null;
  bio?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  socialLinks?: Record<unknown> | null;
  visibility?: DirectoryVisibility;
}

@doc("Query parameters for directory search")
model DirectorySearchParams {
  ...PaginationQuery;

  @doc("Specialty filter")
  @query
  specialty?: string;

  @doc("Location label filter")
  @query
  location?: string;

  @doc("Tag filter (comma-separated values)")
  @query
  tags?: string;

  @doc("Latitude for proximity search")
  @query
  lat?: float64;

  @doc("Longitude for proximity search")
  @query
  lng?: float64;

  @doc("Radius in kilometres for proximity search (requires lat + lng)")
  @query
  @minValue(0)
  radiusKm?: float64;

  @doc("Filter by verified status")
  @query
  verified?: boolean;
}

@doc("A public directory profile view with reduced fields")
model PublicDirectoryProfile {
  @doc("Person ID")
  personId: string;

  @doc("Display name")
  displayName: string;

  @doc("Professional title")
  title?: string;

  @doc("Organization")
  organization?: string;

  @doc("Specialty")
  specialty?: string;

  @doc("Location label")
  location?: string;

  @doc("Photo URL")
  photoUrl?: string;

  @doc("Short biography")
  bio?: string;

  @doc("Contact email")
  contactEmail?: string;

  @doc("Website URL")
  website?: string;

  @doc("Social links")
  socialLinks?: Record<unknown>;

  @doc("Whether the profile has been verified")
  verified: boolean;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

namespace Association.Member.Directory {
  @doc("CRUD and search for member directory profiles")
  interface DirectoryProfileManagement {
    @doc("Create a directory profile for a member.")
    @operationId("createDirectoryProfile")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:member:owner", "association:admin"])
    createDirectoryProfile(
      @body body: DirectoryProfileCreateRequest
    ): ApiCreatedResponse<DirectoryProfile>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a directory profile by ID.")
    @operationId("getDirectoryProfile")
    @get
    @route("/{profileId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:member:owner", "association:admin"])
    getDirectoryProfile(
      @path profileId: string
    ): ApiOkResponse<DirectoryProfile>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List directory profiles (admin view with all visibility levels).")
    @operationId("listDirectoryProfiles")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    listDirectoryProfiles(
      ...PaginationQuery,
      @query visibility?: DirectoryVisibility
    ): ApiOkResponse<PaginatedResponse<DirectoryProfile>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a directory profile.")
    @operationId("updateDirectoryProfile")
    @patch(#{implicitOptionality: true})
    @route("/{profileId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:member:owner", "association:admin"])
    updateDirectoryProfile(
      @path profileId: string,
      @body updates: DirectoryProfileUpdateRequest
    ): ApiOkResponse<DirectoryProfile>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete a directory profile.")
    @operationId("deleteDirectoryProfile")
    @delete
    @route("/{profileId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:member:owner", "association:admin"])
    deleteDirectoryProfile(
      @path profileId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;
  }

  @doc("Member directory search service for full-text and geo-spatial lookups")
  interface DirectorySearchService {
    @doc("Search the member directory with full-text and optional geo-spatial filters.")
    @operationId("searchDirectory")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:member", "association:admin"])
    searchDirectory(
      ...DirectorySearchParams
    ): ApiOkResponse<PaginatedResponse<DirectoryProfile>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get the public-facing profile of a member by their person ID. No authentication required for public profiles.")
    @operationId("getPublicDirectoryProfile")
    @get
    @route("/{personId}/public")
    @useAuth(bearerAuth | Http.NoAuth)
    @extension("x-security-required-roles", #[])
    getPublicDirectoryProfile(
      @path personId: string
    ): ApiOkResponse<PublicDirectoryProfile>
      | ApiNotFoundResponse;
  }
}
