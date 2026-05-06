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
 * Announcements Module
 *
 * Association-scoped announcement lifecycle management.
 * Officers create/publish/archive; members read.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Announcement lifecycle status")
enum AnnouncementStatus {
  draft: "draft",
  scheduled: "scheduled",
  sent: "sent",
  scheduledFailed: "scheduledFailed",
  archived: "archived",
}

@doc("Announcement audience visibility")
enum AnnouncementVisibility {
  @doc("Visible only to members of the organisation")
  internal: "internal",
  @doc("Visible to the wider network")
  network: "network",
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

@doc("An organisation-scoped announcement record")
model Announcement extends BaseEntity {
  @doc("Organisation this announcement belongs to")
  organizationId: UUID;

  @doc("Person who authored the announcement")
  authorId: UUID;

  @doc("Short descriptive title")
  @maxLength(200)
  title: string;

  @doc("Full announcement body (HTML or plain text)")
  content: string;

  @doc("Audience targeting strategy: 'all' members or 'by_category'")
  audienceType: string;

  @doc("Category IDs when audienceType is 'by_category'")
  audienceCategories?: string[];

  @doc("Whether to send a push notification")
  channelPush: boolean;

  @doc("Whether to send an email notification")
  channelEmail: boolean;

  @doc("Announcement visibility scope")
  visibility: AnnouncementVisibility;

  @doc("Lifecycle status of the announcement")
  status: AnnouncementStatus;

  @doc("When the announcement was/will be sent")
  scheduledAt?: utcDateTime;

  @doc("When the announcement was published")
  publishedAt?: utcDateTime;
}

@doc("Request body for creating an announcement")
model AnnouncementCreateRequest {
  @doc("Short descriptive title")
  @maxLength(200)
  title: string;

  @doc("Full announcement body")
  content: string;

  @doc("Audience targeting: 'all' or 'by_category'")
  audienceType?: string;

  @doc("Category IDs when audienceType is 'by_category'")
  audienceCategories?: string[];

  @doc("Whether to send a push notification")
  channelPush?: boolean;

  @doc("Whether to send an email notification")
  channelEmail?: boolean;

  @doc("Visibility scope")
  visibility?: AnnouncementVisibility;

  @doc("Initial status (defaults to 'draft')")
  status?: AnnouncementStatus;

  @doc("Scheduled send time (for status 'scheduled')")
  scheduledAt?: utcDateTime;
}

@doc("Request body for updating an announcement")
model AnnouncementUpdateRequest {
  @doc("Updated title")
  @maxLength(200)
  title?: string;

  @doc("Updated content")
  content?: string;

  @doc("Updated audience targeting")
  audienceType?: string;

  @doc("Updated category IDs")
  audienceCategories?: string[];

  @doc("Updated push channel setting")
  channelPush?: boolean;

  @doc("Updated email channel setting")
  channelEmail?: boolean;

  @doc("Updated visibility")
  visibility?: AnnouncementVisibility;

  @doc("Updated scheduled send time")
  scheduledAt?: utcDateTime;
}

// ---------------------------------------------------------------------------
// Namespace / Interface
// ---------------------------------------------------------------------------

namespace Association.Operations.Announcements {
  interface AnnouncementManagement {

    @doc("List announcements for an organisation. Accessible to association members.")
    @operationId("listAnnouncements")
    @get
    @route("/communications/announcements/{orgId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:member"])
    listAnnouncements(
      @path orgId: UUID,
      @query status?: AnnouncementStatus,
      @query search?: string,
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<Announcement>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a single announcement by ID. Accessible to association members.")
    @operationId("getAnnouncement")
    @get
    @route("/communications/announcements/detail/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:member"])
    getAnnouncement(
      @path id: UUID
    ): ApiOkResponse<Announcement>
      | ApiUnauthorizedResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Create a new announcement for an organisation. Requires officer role.")
    @operationId("createAnnouncement")
    @post
    @route("/communications/announcements/{orgId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:officer"])
    createAnnouncement(
      @path orgId: UUID,
      @body body: AnnouncementCreateRequest
    ): ApiCreatedResponse<Announcement>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Publish a draft announcement, making it visible to the audience. Requires officer role.")
    @operationId("publishAnnouncement")
    @post
    @route("/communications/announcements/{id}/publish")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:officer"])
    publishAnnouncement(
      @path id: UUID
    ): ApiOkResponse<Announcement>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Archive a published announcement. Requires officer role.")
    @operationId("archiveAnnouncement")
    @post
    @route("/communications/announcements/{id}/archive")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:officer"])
    archiveAnnouncement(
      @path id: UUID
    ): ApiOkResponse<Announcement>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update an existing announcement. Requires officer role.")
    @operationId("updateAnnouncement")
    @patch(#{implicitOptionality: true})
    @route("/communications/announcements/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:officer"])
    updateAnnouncement(
      @path id: UUID,
      @body updates: AnnouncementUpdateRequest
    ): ApiOkResponse<Announcement>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Delete an announcement. Requires officer role.")
    @operationId("deleteAnnouncement")
    @delete
    @route("/communications/announcements/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:officer"])
    deleteAnnouncement(
      @path id: UUID
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
