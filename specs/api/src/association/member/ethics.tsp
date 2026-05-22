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
 * Association Member Lifecycle — Domain 32: Ethics, Discipline & Attestations
 *
 * Covers ethics complaints, peer review panels, disciplinary actions, public
 * sanction records, and conflict-of-interest attestation cycles.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Category of an ethics complaint")
enum ComplaintCategory {
  @doc("Conduct inconsistent with professional standards")
  professionalMisconduct: "professionalMisconduct",

  @doc("Violation of the association's code of ethics")
  codeViolation: "codeViolation",

  @doc("Misappropriation or misuse of funds")
  financialImpropriety: "financialImpropriety",

  @doc("Failure to disclose or manage a conflict of interest")
  conflictOfInterest: "conflictOfInterest",

  @doc("Discriminatory conduct")
  discrimination: "discrimination",

  @doc("Harassing conduct")
  harassment: "harassment",

  @doc("Any other ethics violation not covered above")
  other: "other",
}

@doc("Lifecycle status of an ethics complaint")
enum ComplaintStatus {
  @doc("Complaint has been submitted and is awaiting initial review")
  filed: "filed",

  @doc("Complaint is undergoing preliminary review to determine merit")
  preliminaryReview: "preliminaryReview",

  @doc("Complaint is under active investigation")
  investigation: "investigation",

  @doc("A formal hearing has been convened")
  hearing: "hearing",

  @doc("A decision has been reached")
  decision: "decision",

  @doc("The decision is under appeal")
  appeal: "appeal",

  @doc("The complaint process has concluded")
  closed: "closed",
}

@doc("Type of disciplinary action imposed on a member")
enum DisciplinaryActionType {
  @doc("Formal written warning")
  warning: "warning",

  @doc("Official reprimand placed on record")
  reprimand: "reprimand",

  @doc("Monetary penalty")
  fine: "fine",

  @doc("Temporary suspension of membership privileges")
  suspension: "suspension",

  @doc("Permanent removal from the association")
  expulsion: "expulsion",

  @doc("Conditional status with monitoring")
  probation: "probation",

  @doc("Required completion of a specific training program")
  mandatoryTraining: "mandatoryTraining",

  @doc("No action imposed after review")
  none: "none",
}

@doc("Status of a disciplinary action")
enum DisciplinaryActionStatus {
  @doc("Action has been formally imposed")
  imposed: "imposed",

  @doc("Action is currently in effect")
  active: "active",

  @doc("Action has run its course")
  completed: "completed",

  @doc("Action is under appeal")
  appealed: "appealed",

  @doc("Action was overturned on appeal")
  overturned: "overturned",
}

@doc("Status of a sanction record")
enum SanctionRecordStatus {
  @doc("Sanction is currently active")
  active: "active",

  @doc("Sanction period has ended")
  expired: "expired",

  @doc("Sanction was overturned by appeal")
  overturned: "overturned",
}

@doc("Status of a peer review panel")
enum PanelStatus {
  @doc("Panel has been formed and members notified")
  formed: "formed",

  @doc("Panel is actively deliberating")
  deliberating: "deliberating",

  @doc("Panel has reached a decision")
  decided: "decided",
}

@doc("Status of a COI attestation")
enum AttestationStatus {
  @doc("Attestation has been submitted by the member")
  submitted: "submitted",

  @doc("Attestation is under staff review")
  reviewed: "reviewed",

  @doc("Attestation has been reviewed and no conflicts identified")
  cleared: "cleared",

  @doc("Potential conflict has been flagged for further review")
  flagged: "flagged",
}

@doc("Category of a conflict-of-interest disclosure")
enum COIDisclosureCategory {
  @doc("Financial interest in an entity related to association business")
  financial: "financial",

  @doc("Board membership in a related entity")
  board: "board",

  @doc("Vendor relationship")
  vendor: "vendor",

  @doc("Employment relationship")
  employment: "employment",

  @doc("Family relationship with a relevant party")
  family: "family",

  @doc("Any other type of potential conflict")
  other: "other",
}

// ---------------------------------------------------------------------------
// Value Models (non-entity, embedded)
// ---------------------------------------------------------------------------

@doc("A single conflict-of-interest disclosure within an attestation")
model COIDisclosure {
  @doc("Category of the disclosed relationship")
  category: COIDisclosureCategory;

  @doc("Description of the potential conflict")
  @minLength(1)
  @maxLength(3000)
  description: string;

  @doc("Name of the organization or individual involved")
  @minLength(1)
  @maxLength(200)
  entityName: string;

  @doc("Plan to manage or mitigate the conflict")
  @maxLength(3000)
  mitigationPlan?: string;
}

// ---------------------------------------------------------------------------
// Entity Models
// ---------------------------------------------------------------------------

@doc("An ethics complaint filed against a member")
model EthicsComplaint extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  organizationId: string;

  @doc("ID of the complainant (null for anonymous complaints where policy allows)")
  complainantId?: string;

  @doc("ID of the member against whom the complaint is filed")
  respondentId: string;

  @doc("Category of the alleged ethics violation")
  category: ComplaintCategory;

  @doc("Detailed description of the alleged violation")
  @minLength(1)
  @maxLength(20000)
  description: string;

  @doc("Timestamp when the complaint was formally filed")
  filedAt: utcDateTime;

  @doc("Current status of the complaint")
  status: ComplaintStatus;

  @doc("ID of the staff member assigned to review this complaint")
  assignedTo?: string;

  @doc("Whether this complaint record is treated as confidential")
  confidential: boolean;
}

@doc("A peer review panel convened to deliberate on an ethics complaint")
model PeerReviewPanel extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  organizationId: string;

  @doc("ID of the complaint this panel is reviewing")
  complaintId: string;

  @doc("IDs of the panel members")
  panelMembers: string[];

  @doc("ID of the panel chair")
  chairId: string;

  @doc("Scheduled date when the panel will convene")
  conveneDate?: plainDate;

  @doc("Current status of the panel")
  status: PanelStatus;
}

@doc("A disciplinary action imposed on a member following an ethics review")
model DisciplinaryAction extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  organizationId: string;

  @doc("ID of the complaint that led to this action")
  complaintId: string;

  @doc("Type of action imposed")
  actionType: DisciplinaryActionType;

  @doc("Description of the action and its terms")
  @minLength(1)
  @maxLength(5000)
  description: string;

  @doc("Date on which the action takes effect")
  effectiveDate: plainDate;

  @doc("Date on which the action ends (null for permanent actions)")
  endDate?: plainDate;

  @doc("ID of the officer or body that imposed the action")
  imposedBy: string;

  @doc("Current status of the disciplinary action")
  status: DisciplinaryActionStatus;
}

@doc("A public or internal record of a sanction imposed on a member")
model SanctionRecord extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  organizationId: string;

  @doc("ID of the sanctioned member")
  personId: string;

  @doc("ID of the disciplinary action this sanction derives from")
  actionId: string;

  @doc("Type label for the sanction as it appears in the public register")
  @minLength(1)
  @maxLength(100)
  sanctionType: string;

  @doc("Whether this sanction is visible in the public sanctions register")
  publiclyVisible: boolean;

  @doc("Date on which the sanction begins")
  startDate: plainDate;

  @doc("Date on which the sanction ends (null for permanent sanctions)")
  endDate?: plainDate;

  @doc("Current status of the sanction record")
  status: SanctionRecordStatus;
}

@doc("A conflict-of-interest attestation submitted by a member")
model COIAttestation extends BaseEntity {
  @doc("Tenant identifier for multi-tenancy isolation")
  organizationId: string;

  @doc("ID of the member submitting the attestation")
  personId: string;

  @doc("ID of the attestation cycle this submission belongs to (if the association uses defined cycles)")
  attestationCycleId?: string;

  @doc("List of conflict-of-interest disclosures included in this attestation")
  disclosures: COIDisclosure[];

  @doc("Timestamp when the attestation was submitted")
  attestedAt: utcDateTime;

  @doc("Review status of this attestation")
  status: AttestationStatus;
}

// ---------------------------------------------------------------------------
// Request / Response Models
// ---------------------------------------------------------------------------

@doc("Request to file an ethics complaint")
model EthicsComplaintCreateRequest {
  complainantId?: string;
  respondentId: string;
  category: ComplaintCategory;
  description?: string;
  confidential: boolean;
}

@doc("Request to update an ethics complaint")
model EthicsComplaintUpdateRequest {
  category?: ComplaintCategory;
  description?: string;
  status?: ComplaintStatus;
  assignedTo?: string | null;
  confidential?: boolean;
}

@doc("Request to assign a reviewer to an ethics complaint")
model AssignReviewerRequest {
  @doc("ID of the staff member to assign")
  assignedTo: string;
}

@doc("Request to create or update a peer review panel")
model PeerReviewPanelRequest {
  complaintId: string;
  panelMembers: string[];
  chairId: string;
  conveneDate?: plainDate;
}

@doc("Request to create or update a disciplinary action")
model DisciplinaryActionRequest {
  complaintId: string;
  actionType: DisciplinaryActionType;
  description?: string;
  effectiveDate: plainDate;
  endDate?: plainDate;
  imposedBy: string;
}

@doc("Query parameters for the public sanctions register search")
model SanctionSearchParams {
  ...PaginationQuery;

  @doc("Filter by sanction type label")
  @query
  sanctionType?: string;

  @doc("Filter by sanction status")
  @query
  status?: SanctionRecordStatus;
}

@doc("Request to submit a COI attestation")
model COIAttestationCreateRequest {
  personId: string;
  attestationCycleId?: string;
  disclosures: COIDisclosure[];
}

@doc("Request to review a COI attestation")
model COIAttestationReviewRequest {
  @doc("Review outcome")
  status: AttestationStatus;

  @doc("Reviewer notes")
  @maxLength(3000)
  notes?: string;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@route("/association/member/ethics/complaints")
@tag("Association:Member")
namespace Association.Member.Ethics {
  @doc("CRUD, search, and reviewer assignment for ethics complaints")
  interface EthicsComplaintManagement {
    @doc("File a new ethics complaint.")
    @operationId("createEthicsComplaint")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:member", "association:admin"])
    createEthicsComplaint(
      @body body: EthicsComplaintCreateRequest
    ): ApiCreatedResponse<EthicsComplaint>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get an ethics complaint by ID.")
    @operationId("getEthicsComplaint")
    @get
    @route("/{complaintId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "ethics:reviewer"])
    getEthicsComplaint(
      @path complaintId: string
    ): ApiOkResponse<EthicsComplaint>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List ethics complaints with optional filters.")
    @operationId("listEthicsComplaints")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "ethics:reviewer"])
    listEthicsComplaints(
      ...PaginationQuery,
      @query respondentId?: string,
      @query status?: ComplaintStatus,
      @query category?: ComplaintCategory
    ): ApiOkResponse<PaginatedResponse<EthicsComplaint>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update an ethics complaint record.")
    @operationId("updateEthicsComplaint")
    @patch(#{implicitOptionality: true})
    @route("/{complaintId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "ethics:reviewer"])
    updateEthicsComplaint(
      @path complaintId: string,
      @body updates: EthicsComplaintUpdateRequest
    ): ApiOkResponse<EthicsComplaint>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete an ethics complaint record.")
    @operationId("deleteEthicsComplaint")
    @delete
    @route("/{complaintId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteEthicsComplaint(
      @path complaintId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;

    @doc("Assign a staff reviewer to an ethics complaint.")
    @operationId("assignEthicsComplaintReviewer")
    @post
    @route("/{complaintId}/assign-reviewer")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    assignEthicsComplaintReviewer(
      @path complaintId: string,
      @body body: AssignReviewerRequest
    ): ApiOkResponse<EthicsComplaint>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;
  }

  @doc("CRUD for peer review panels")
  @route("/association/member/ethics/panels")
  interface PeerReviewPanelManagement {
    @doc("Create a peer review panel for an ethics complaint.")
    @operationId("createPeerReviewPanel")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createPeerReviewPanel(
      @body body: PeerReviewPanelRequest
    ): ApiCreatedResponse<PeerReviewPanel>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a peer review panel by ID.")
    @operationId("getPeerReviewPanel")
    @get
    @route("/{panelId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "ethics:reviewer"])
    getPeerReviewPanel(
      @path panelId: string
    ): ApiOkResponse<PeerReviewPanel>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a peer review panel.")
    @operationId("updatePeerReviewPanel")
    @patch(#{implicitOptionality: true})
    @route("/{panelId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updatePeerReviewPanel(
      @path panelId: string,
      @body updates: PeerReviewPanelRequest
    ): ApiOkResponse<PeerReviewPanel>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete a peer review panel.")
    @operationId("deletePeerReviewPanel")
    @delete
    @route("/{panelId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deletePeerReviewPanel(
      @path panelId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;
  }

  @doc("CRUD and search for disciplinary actions")
  @route("/association/member/ethics/disciplinary-actions")
  interface DisciplinaryActionManagement {
    @doc("Create a disciplinary action.")
    @operationId("createDisciplinaryAction")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    createDisciplinaryAction(
      @body body: DisciplinaryActionRequest
    ): ApiCreatedResponse<DisciplinaryAction>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a disciplinary action by ID.")
    @operationId("getDisciplinaryAction")
    @get
    @route("/{actionId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "ethics:reviewer"])
    getDisciplinaryAction(
      @path actionId: string
    ): ApiOkResponse<DisciplinaryAction>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List disciplinary actions with optional filters.")
    @operationId("listDisciplinaryActions")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "ethics:reviewer"])
    listDisciplinaryActions(
      ...PaginationQuery,
      @query complaintId?: string,
      @query actionType?: DisciplinaryActionType,
      @query status?: DisciplinaryActionStatus
    ): ApiOkResponse<PaginatedResponse<DisciplinaryAction>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a disciplinary action.")
    @operationId("updateDisciplinaryAction")
    @patch(#{implicitOptionality: true})
    @route("/{actionId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    updateDisciplinaryAction(
      @path actionId: string,
      @body updates: DisciplinaryActionRequest
    ): ApiOkResponse<DisciplinaryAction>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Delete a disciplinary action record.")
    @operationId("deleteDisciplinaryAction")
    @delete
    @route("/{actionId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin"])
    deleteDisciplinaryAction(
      @path actionId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiForbiddenResponse;
  }

  @doc("Public sanctions register — returns only publicly visible sanctions, no authentication required")
  @route("/association/member/ethics/sanctions")
  interface SanctionRegistryService {
    @doc("Search the public sanctions register.")
    @operationId("searchSanctionRegistry")
    @get
    @useAuth(Http.NoAuth)
    @extension("x-security-required-roles", #[])
    searchSanctionRegistry(
      ...SanctionSearchParams
    ): ApiOkResponse<PaginatedResponse<SanctionRecord>>;

    @doc("Get a specific sanction record by ID (public sanctions only).")
    @operationId("getSanctionRecord")
    @get
    @route("/{sanctionId}")
    @useAuth(Http.NoAuth)
    @extension("x-security-required-roles", #[])
    getSanctionRecord(
      @path sanctionId: string
    ): ApiOkResponse<SanctionRecord>
      | ApiNotFoundResponse;
  }

  @doc("Create, search, and review conflict-of-interest attestations")
  @route("/association/member/ethics/coi-attestations")
  interface COIAttestationManagement {
    @doc("Submit a COI attestation.")
    @operationId("createCOIAttestation")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:member:owner", "association:admin"])
    createCOIAttestation(
      @body body: COIAttestationCreateRequest
    ): ApiCreatedResponse<COIAttestation>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a COI attestation by ID.")
    @operationId("getCOIAttestation")
    @get
    @route("/{attestationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "ethics:reviewer", "association:member:owner"])
    getCOIAttestation(
      @path attestationId: string
    ): ApiOkResponse<COIAttestation>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search COI attestations.")
    @operationId("listCOIAttestations")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "ethics:reviewer"])
    listCOIAttestations(
      ...PaginationQuery,
      @query personId?: string,
      @query status?: AttestationStatus,
      @query attestationCycleId?: string
    ): ApiOkResponse<PaginatedResponse<COIAttestation>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Review a COI attestation and update its status.")
    @operationId("reviewCOIAttestation")
    @post
    @route("/{attestationId}/review")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["association:admin", "ethics:reviewer"])
    reviewCOIAttestation(
      @path attestationId: string,
      @body body: COIAttestationReviewRequest
    ): ApiOkResponse<COIAttestation>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiForbiddenResponse;
  }
}
