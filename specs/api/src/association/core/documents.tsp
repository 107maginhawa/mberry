import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../common/models.tsp";
import "../../common/errors.tsp";
import "../../common/pagination.tsp";
import "../../common/security.tsp";
import "./primitives.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Domain 10 — Document Management
 *
 * Manages association documents (policies, minutes, forms, certificates)
 * including versioned storage, access-level controls, tagging, and an
 * immutable access log for compliance auditing.
 */
namespace Association.Core.Documents;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Who may access a document.")
enum DocumentAccessLevel {
  @doc("Accessible to anonymous public visitors.")
  public: "public",

  @doc("Accessible to any authenticated member of the tenant.")
  tenantOnly: "tenantOnly",

  @doc("Accessible only to members within the same organisational unit.")
  unitOnly: "unitOnly",

  @doc("Accessible to a specific list of granted persons.")
  restricted: "restricted",

  @doc("Accessible only to officers and staff with elevated privileges.")
  privileged: "privileged",
}

// ---------------------------------------------------------------------------
// Core entity models
// ---------------------------------------------------------------------------

@doc("A document stored on behalf of a person or organisational entity.")
model Document extends AssociationBaseEntity {
  @doc("Display title of the document.")
  title: string;

  @doc("Original file name uploaded by the user.")
  fileName: string;

  @doc("MIME type of the stored file (e.g. 'application/pdf', 'image/png').")
  mimeType: string;

  @doc("Size of the current version in bytes.")
  @minValue(0)
  size: int64;

  @doc("Opaque key used to retrieve the file from the object store.")
  storageKey: string;

  @doc("ID of the person or organisation that owns this document.")
  ownerId: string;

  @doc("Discriminator for the owner type (e.g. 'person', 'organization', 'chapter').")
  ownerType: string;

  @doc("Who may access this document.")
  accessLevel: DocumentAccessLevel;

  @doc("Optional category grouping (e.g. 'minutes', 'policy', 'certificate').")
  category?: string;

  @doc("Searchable tags attached to this document.")
  tags?: string[];

  @doc("ID of the currently active document version.")
  currentVersionId?: string;
}

@doc("An immutable snapshot of a document at a specific point in time.")
model DocumentVersion extends AssociationBaseEntity {
  @doc("Document this version belongs to.")
  documentId: string;

  @doc("Sequential version number (1-based).")
  @minValue(1)
  versionNumber: int32;

  @doc("File name at the time this version was uploaded.")
  fileName: string;

  @doc("Storage key for this specific version's bytes.")
  storageKey: string;

  @doc("Size of this version in bytes.")
  @minValue(0)
  size: int64;

  @doc("Person who uploaded this version.")
  uploadedBy: string;

  @doc("Timestamp at which this version was created.")
  uploadedAt: utcDateTime;

  @doc("Optional change notes describing what was updated.")
  changeNotes?: string;
}

@doc("A reusable label that can be attached to documents for filtering.")
model DocumentTag extends AssociationBaseEntity {
  @doc("Unique tag name within the tenant.")
  name: string;

  @doc("Display color for the tag in the UI (hex code, e.g. '#3B82F6').")
  color?: string;
}

// ---------------------------------------------------------------------------
// Request / response helpers
// ---------------------------------------------------------------------------

@doc("Request body to create a document metadata record (file upload handled separately).")
model DocumentCreateRequest {
  @doc("Display title.")
  title: string;

  @doc("Original file name.")
  fileName: string;

  @doc("MIME type.")
  mimeType: string;

  @doc("File size in bytes.")
  @minValue(0)
  size: int64;

  @doc("Object-store key returned by the upload endpoint.")
  storageKey: string;

  @doc("Owner ID.")
  ownerId: string;

  @doc("Owner type discriminator.")
  ownerType: string;

  @doc("Access level.")
  accessLevel: DocumentAccessLevel;

  @doc("Category (optional).")
  category?: string;

  @doc("Initial tags (optional).")
  tags?: string[];

  @doc("Initial publication status. Defaults to 'draft'; only 'draft' or 'published' are valid on creation.")
  status?: "draft" | "published";
}

@doc("Partial update for document metadata.")
model DocumentUpdateRequest {
  @doc("Display title.")
  title?: string;

  @doc("Access level.")
  accessLevel?: DocumentAccessLevel;

  @doc("Category — pass null to clear.")
  category?: string | null;

  @doc("Tag list — replaces existing tags. Pass empty array to remove all tags.")
  tags?: string[];
}

@doc("Request body to upload a new version of an existing document.")
model DocumentNewVersionRequest {
  @doc("Original file name for the new version.")
  fileName: string;

  @doc("File size in bytes.")
  @minValue(0)
  size: int64;

  @doc("Object-store key returned by the upload endpoint.")
  storageKey: string;

  @doc("Optional change notes.")
  changeNotes?: string;
}

@doc("Request body to create a document tag.")
model DocumentTagCreateRequest {
  @doc("Tag name.")
  name: string;

  @doc("Display color (optional).")
  color?: string;
}

@doc("Partial update for a document tag.")
model DocumentTagUpdateRequest {
  @doc("Tag name.")
  name?: string;

  @doc("Display color — pass null to remove the color.")
  color?: string | null;
}

@doc("A single entry in the document access log.")
model DocumentAccessLogEntry {
  @doc("Person who accessed the document.")
  accessedBy: string;

  @doc("Timestamp of the access.")
  accessedAt: utcDateTime;

  @doc("Type of access (e.g. 'view', 'download', 'share').")
  action: string;

  @doc("IP address of the accessor (if available).")
  ipAddress?: string;
}

@doc("Query parameters for searching documents.")
model DocumentSearchParams {
  ...OffsetPaginationParams;
  ...SearchFilterParams;

  @doc("Filter by owner ID.")
  @query
  ownerId?: string;

  @doc("Filter by owner type.")
  @query
  ownerType?: string;

  @doc("Filter by access level.")
  @query
  accessLevel?: DocumentAccessLevel;

  @doc("Filter by category.")
  @query
  category?: string;

  @doc("Filter by tag name.")
  @query
  tag?: string;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

namespace DocumentManagement {
  interface DocumentManagement {
    @doc("Create a document record after the file has been uploaded to object storage.")
    @operationId("createDocument")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator", "member:owner"])
    createDocument(
      @body body: DocumentCreateRequest
    ): ApiCreatedResponse<Document>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a document by ID.")
    @operationId("getDocument")
    @get
    @route("/{documentId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator", "member"])
    getDocument(
      @path documentId: string
    ): ApiOkResponse<Document>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update document metadata.")
    @operationId("updateDocument")
    @patch(#{implicitOptionality: true})
    @route("/{documentId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator", "member:owner"])
    updateDocument(
      @path documentId: string,
      @body updates: DocumentUpdateRequest
    ): ApiOkResponse<Document>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Delete a document and all its versions.")
    @operationId("deleteDocument")
    @delete
    @route("/{documentId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "member:owner"])
    deleteDocument(
      @path documentId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search and list documents.")
    @operationId("searchDocuments")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator", "member"])
    searchDocuments(
      ...DocumentSearchParams
    ): ApiOkResponse<PaginatedResponse<Document>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Upload a new version of an existing document.")
    @operationId("uploadNewDocumentVersion")
    @post
    @route("/{documentId}/versions")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator", "member:owner"])
    uploadNewDocumentVersion(
      @path documentId: string,
      @body body: DocumentNewVersionRequest
    ): ApiCreatedResponse<DocumentVersion>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Retrieve the access log for a document.")
    @operationId("getDocumentAccessLog")
    @get
    @route("/{documentId}/access-log")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    getDocumentAccessLog(
      @path documentId: string,
      ...OffsetPaginationParams
    ): ApiOkResponse<PaginatedResponse<DocumentAccessLogEntry>>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Archive a document (soft-delete; retains record for audit purposes).")
    @operationId("archiveDocument")
    @post
    @route("/{documentId}/archive")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    archiveDocument(
      @path documentId: string
    ): ApiOkResponse<Document>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}

namespace DocumentVersionManagement {
  interface DocumentVersionManagement {
    @doc("List all versions of a document.")
    @operationId("listDocumentVersions")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator", "member"])
    listDocumentVersions(
      @path documentId: string,
      ...OffsetPaginationParams
    ): ApiOkResponse<PaginatedResponse<DocumentVersion>>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a specific version of a document.")
    @operationId("getDocumentVersion")
    @get
    @route("/{versionId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator", "member"])
    getDocumentVersion(
      @path documentId: string,
      @path versionId: string
    ): ApiOkResponse<DocumentVersion>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}

namespace DocumentTagManagement {
  interface DocumentTagManagement {
    @doc("Create a document tag.")
    @operationId("createDocumentTag")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    createDocumentTag(
      @body body: DocumentTagCreateRequest
    ): ApiCreatedResponse<DocumentTag>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a document tag by ID.")
    @operationId("getDocumentTag")
    @get
    @route("/{tagId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator", "member"])
    getDocumentTag(
      @path tagId: string
    ): ApiOkResponse<DocumentTag>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a document tag.")
    @operationId("updateDocumentTag")
    @patch(#{implicitOptionality: true})
    @route("/{tagId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    updateDocumentTag(
      @path tagId: string,
      @body updates: DocumentTagUpdateRequest
    ): ApiOkResponse<DocumentTag>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Delete a document tag.")
    @operationId("deleteDocumentTag")
    @delete
    @route("/{tagId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    deleteDocumentTag(
      @path tagId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List all document tags for the tenant.")
    @operationId("listDocumentTags")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator", "member"])
    listDocumentTags(
      ...OffsetPaginationParams,
      ...SearchFilterParams
    ): ApiOkResponse<PaginatedResponse<DocumentTag>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
