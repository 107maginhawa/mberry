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
 * Domains 16–17 — Reporting & Data Import / Export
 *
 * Provides the full reporting pipeline: reusable report definitions, on-demand
 * and scheduled report runs, as well as bulk data import and export jobs that
 * allow the association to move data between the platform and external systems.
 */
namespace Association.Core.Reporting;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("High-level domain category of a report.")
enum ReportCategory {
  @doc("Membership statistics and roster reports.")
  membership: "membership",

  @doc("Financial summaries, revenue, and dues collection reports.")
  financial: "financial",

  @doc("Event attendance and registration reports.")
  events: "events",

  @doc("Continuing-education and credit-hour reports.")
  credits: "credits",

  @doc("Governance, election, and committee reports.")
  governance: "governance",

  @doc("Member engagement and retention reports.")
  engagement: "engagement",

  @doc("Ad-hoc or tenant-defined custom reports.")
  custom: "custom",
}

@doc("Lifecycle status of a report definition.")
enum ReportStatus {
  @doc("Under construction; not yet runnable by end-users.")
  draft: "draft",

  @doc("Published and runnable.")
  active: "active",

  @doc("Superseded or discontinued; read-only historical reference.")
  retired: "retired",
}

@doc("Output format for a report or export job.")
enum ReportFormat {
  @doc("Portable Document Format.")
  pdf: "pdf",

  @doc("Comma-Separated Values.")
  csv: "csv",

  @doc("Microsoft Excel workbook.")
  xlsx: "xlsx",

  @doc("JSON data file.")
  json: "json",
}

@doc("Lifecycle status of a single report run.")
enum RunStatus {
  @doc("Queued and waiting for an available worker.")
  queued: "queued",

  @doc("Currently being generated.")
  running: "running",

  @doc("Successfully generated; output available for download.")
  completed: "completed",

  @doc("Generation failed; see error details.")
  failed: "failed",
}

@doc("Type of entities being imported.")
enum ImportType {
  @doc("Member person records.")
  members: "members",

  @doc("Organisation records (chapters, committees).")
  organizations: "organizations",

  @doc("Dues payment records.")
  dues: "dues",

  @doc("Credit / CPE records.")
  credits: "credits",

  @doc("Event and attendance records.")
  events: "events",
}

@doc("Source file format for an import job.")
enum ImportFormat {
  @doc("Comma-Separated Values.")
  csv: "csv",

  @doc("JSON data file.")
  json: "json",

  @doc("Microsoft Excel workbook.")
  xlsx: "xlsx",

  @doc("vCard contact file.")
  vcard: "vcard",
}

@doc("Lifecycle status of an import job.")
enum ImportJobStatus {
  @doc("Job record created; file not yet uploaded.")
  created: "created",

  @doc("File uploaded; validation in progress.")
  validating: "validating",

  @doc("Validation complete; ready to execute.")
  validated: "validated",

  @doc("Data is being written to the database.")
  importing: "importing",

  @doc("All records processed successfully.")
  completed: "completed",

  @doc("Job failed; see error details.")
  failed: "failed",
}

@doc("Lifecycle status of an export job.")
enum ExportStatus {
  @doc("Queued and waiting for a worker.")
  queued: "queued",

  @doc("Output file is being generated.")
  generating: "generating",

  @doc("Output file is ready for download.")
  completed: "completed",

  @doc("Download link has expired; file is no longer available.")
  expired: "expired",
}

// ---------------------------------------------------------------------------
// Value-object models
// ---------------------------------------------------------------------------

@doc("A configurable parameter accepted by a report at run time.")
model ReportParameter {
  @doc("Parameter name (used as the key in the run-time parameters map).")
  name: string;

  @doc("Data type of the parameter value (e.g. 'string', 'date', 'integer', 'boolean').")
  type: string;

  @doc("Whether the parameter must be supplied for every run.")
  required: boolean;

  @doc("Default value applied when the parameter is omitted (string-encoded).")
  defaultValue?: string;
}

@doc("Automated schedule controlling when a report is run and distributed.")
model ReportSchedule {
  @doc("Recurrence frequency of the scheduled run.")
  frequency: "daily" | "weekly" | "monthly" | "quarterly";

  @doc("Email addresses (or person IDs) that receive the output file.")
  recipients: string[];

  @doc("Output file format for scheduled deliveries.")
  format: ReportFormat;
}

@doc("A single row from an import job's error log.")
model ImportError {
  @doc("1-based row number in the source file.")
  rowNumber: int64;

  @doc("Field that caused the error.")
  field?: string;

  @doc("Raw value that was rejected.")
  value?: string;

  @doc("Machine-readable error code.")
  code: string;

  @doc("Human-readable error message.")
  message: string;
}

// ---------------------------------------------------------------------------
// Core entity models
// ---------------------------------------------------------------------------

@doc("A saved report definition that can be run on demand or on a schedule.")
model Report extends AssociationBaseEntity {
  @doc("Human-readable name of the report.")
  name: string;

  @doc("Optional longer description of what the report covers.")
  description?: string;

  @doc("Domain category.")
  category: ReportCategory;

  @doc("Identifier of the underlying data source or query module.")
  dataSource: string;

  @doc("Configurable parameters accepted at run time.")
  parameters?: ReportParameter[];

  @doc("Automated run schedule (omit for on-demand-only reports).")
  schedule?: ReportSchedule;

  @doc("Lifecycle status.")
  status: ReportStatus;
}

@doc("A single execution of a report definition.")
model ReportRun extends AssociationBaseEntity {
  @doc("Report definition that was executed.")
  reportId: string;

  @doc("Run-time parameter values supplied for this execution.")
  parameters?: Record<unknown>;

  @doc("Current processing status.")
  status: RunStatus;

  @doc("Timestamp at which processing began.")
  startedAt?: utcDateTime;

  @doc("Timestamp at which processing completed (success or failure).")
  completedAt?: utcDateTime;

  @doc("Signed URL from which the output file can be downloaded.")
  outputUrl?: string;

  @doc("Person who triggered this run.")
  requestedBy: string;
}

@doc("A bulk data import job.")
model ImportJob extends AssociationBaseEntity {
  @doc("Human-readable job name.")
  name: string;

  @doc("Type of entity being imported.")
  type: ImportType;

  @doc("Source file format.")
  sourceFormat: ImportFormat;

  @doc("Current processing status.")
  status: ImportJobStatus;

  @doc("Total number of records found in the source file.")
  totalRecords?: int64;

  @doc("Number of records successfully processed.")
  processedRecords?: int64;

  @doc("Number of records that failed validation or import.")
  failedRecords?: int64;

  @doc("Object-store key of the uploaded source file.")
  uploadedFile?: string;

  @doc("When true, the import runs in validation-only mode without writing data.")
  dryRun: boolean;
}

@doc("A bulk data export job.")
model ExportJob extends AssociationBaseEntity {
  @doc("Human-readable job name.")
  name: string;

  @doc("Type of data being exported (e.g. 'members', 'invoices', 'events').")
  type: string;

  @doc("Output file format.")
  format: ReportFormat;

  @doc("Filters applied to scope the export data set.")
  filters?: Record<unknown>;

  @doc("Current processing status.")
  status: ExportStatus;

  @doc("Signed URL from which the export file can be downloaded.")
  outputUrl?: string;

  @doc("Timestamp after which the download URL will expire.")
  expiresAt?: utcDateTime;

  @doc("Person who requested this export.")
  requestedBy: string;
}

// ---------------------------------------------------------------------------
// Request / response helpers
// ---------------------------------------------------------------------------

@doc("Request body to create a report definition.")
model ReportCreateRequest {
  @doc("Report name.")
  name: string;

  @doc("Description (optional).")
  description?: string;

  @doc("Domain category.")
  category: ReportCategory;

  @doc("Data source identifier.")
  dataSource: string;

  @doc("Parameter definitions (optional).")
  parameters?: ReportParameter[];

  @doc("Automated schedule (optional).")
  schedule?: ReportSchedule;
}

@doc("Partial update for a report definition.")
model ReportUpdateRequest {
  @doc("Report name.")
  name?: string;

  @doc("Description — pass null to clear.")
  description?: string | null;

  @doc("Parameter definitions — replaces existing list.")
  parameters?: ReportParameter[];

  @doc("Schedule — pass null to remove the schedule.")
  schedule?: ReportSchedule | null;

  @doc("Lifecycle status.")
  status?: ReportStatus;
}

@doc("Request body to execute a report run.")
model ReportRunCreateRequest {
  @doc("Report to run.")
  reportId: string;

  @doc("Run-time parameter values.")
  parameters?: Record<unknown>;
}

@doc("Request body to create an import job.")
model ImportJobCreateRequest {
  @doc("Job name.")
  name: string;

  @doc("Import type.")
  type: ImportType;

  @doc("Source file format.")
  sourceFormat: ImportFormat;

  @doc("Whether to run in dry-run validation mode.")
  dryRun: boolean;
}

@doc("Request body to provide the uploaded file key for an import job.")
model ImportJobUploadRequest {
  @doc("Object-store key of the uploaded source file.")
  uploadedFile: string;
}

@doc("Request body to create an export job.")
model ExportJobCreateRequest {
  @doc("Job name.")
  name: string;

  @doc("Type of data to export.")
  type: string;

  @doc("Output format.")
  format: ReportFormat;

  @doc("Filter criteria for the export (optional).")
  filters?: Record<unknown>;
}

@doc("Query parameters for searching report definitions.")
model ReportSearchParams {
  ...OffsetPaginationParams;
  ...SearchFilterParams;

  @doc("Filter by category.")
  @query
  category?: ReportCategory;

  @doc("Filter by status.")
  @query
  status?: ReportStatus;
}

@doc("Query parameters for searching report runs.")
model ReportRunSearchParams {
  ...OffsetPaginationParams;

  @doc("Filter by report ID.")
  @query
  reportId?: string;

  @doc("Filter by run status.")
  @query
  status?: RunStatus;

  @doc("Runs requested by this person.")
  @query
  requestedBy?: string;

  @doc("Runs started on or after this timestamp.")
  @query
  startedAfter?: utcDateTime;
}

@doc("Query parameters for searching export jobs.")
model ExportJobSearchParams {
  ...OffsetPaginationParams;

  @doc("Filter by export status.")
  @query
  status?: ExportStatus;

  @doc("Filter by data type.")
  @query
  type?: string;

  @doc("Filter by requesting person.")
  @query
  requestedBy?: string;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@route("/association/reports")
@tag("Reporting")
namespace ReportManagement {
  interface ReportManagement {
    @doc("Create a report definition.")
    @operationId("createReport")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "executive"])
    createReport(
      @body body: ReportCreateRequest
    ): ApiCreatedResponse<Report>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a report definition by ID.")
    @operationId("getReport")
    @get
    @route("/{reportId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "executive", "accountant", "coordinator"])
    getReport(
      @path reportId: string
    ): ApiOkResponse<Report>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a report definition.")
    @operationId("updateReport")
    @patch(#{implicitOptionality: true})
    @route("/{reportId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "executive"])
    updateReport(
      @path reportId: string,
      @body updates: ReportUpdateRequest
    ): ApiOkResponse<Report>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Delete a report definition.")
    @operationId("deleteReport")
    @delete
    @route("/{reportId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    deleteReport(
      @path reportId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search and list report definitions.")
    @operationId("searchReports")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "executive", "accountant", "coordinator"])
    searchReports(
      ...ReportSearchParams
    ): ApiOkResponse<PaginatedResponse<Report>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}

@route("/association/report-runs")
@tag("Reporting")
namespace ReportRunManagement {
  interface ReportRunManagement {
    @doc("Submit a report for execution.")
    @operationId("createReportRun")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "executive", "accountant", "coordinator"])
    createReportRun(
      @body body: ReportRunCreateRequest
    ): ApiCreatedResponse<ReportRun>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search and list report runs.")
    @operationId("searchReportRuns")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "executive", "accountant"])
    searchReportRuns(
      ...ReportRunSearchParams
    ): ApiOkResponse<PaginatedResponse<ReportRun>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get the current status of a report run.")
    @operationId("getReportRunStatus")
    @get
    @route("/{runId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "executive", "accountant", "coordinator"])
    getReportRunStatus(
      @path runId: string
    ): ApiOkResponse<ReportRun>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get the download URL for a completed report run.")
    @operationId("downloadReportRun")
    @get
    @route("/{runId}/download")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "executive", "accountant", "coordinator"])
    downloadReportRun(
      @path runId: string
    ): ApiOkResponse<{ url: string; expiresAt: utcDateTime }>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}

@route("/association/import-jobs")
@tag("Reporting")
namespace ImportJobManagement {
  interface ImportJobManagement {
    @doc("Create an import job record.")
    @operationId("createImportJob")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    createImportJob(
      @body body: ImportJobCreateRequest
    ): ApiCreatedResponse<ImportJob>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Associate an uploaded source file with an import job.")
    @operationId("uploadImportFile")
    @post
    @route("/{jobId}/upload")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    uploadImportFile(
      @path jobId: string,
      @body body: ImportJobUploadRequest
    ): ApiOkResponse<ImportJob>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Trigger validation of the uploaded source file without writing data.")
    @operationId("validateImportJob")
    @post
    @route("/{jobId}/validate")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    validateImportJob(
      @path jobId: string
    ): ApiOkResponse<ImportJob>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Execute the import job after successful validation.")
    @operationId("executeImportJob")
    @post
    @route("/{jobId}/execute")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    executeImportJob(
      @path jobId: string
    ): ApiOkResponse<ImportJob>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get the status of an import job.")
    @operationId("getImportJobStatus")
    @get
    @route("/{jobId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    getImportJobStatus(
      @path jobId: string
    ): ApiOkResponse<ImportJob>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Retrieve the per-row error log for a failed or partially-failed import job.")
    @operationId("getImportJobErrors")
    @get
    @route("/{jobId}/errors")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    getImportJobErrors(
      @path jobId: string,
      ...OffsetPaginationParams
    ): ApiOkResponse<PaginatedResponse<ImportError>>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}

@route("/association/export-jobs")
@tag("Reporting")
namespace ExportJobManagement {
  interface ExportJobManagement {
    @doc("Create and queue a data export job.")
    @operationId("createExportJob")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "executive", "accountant"])
    createExportJob(
      @body body: ExportJobCreateRequest
    ): ApiCreatedResponse<ExportJob>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search and list export jobs.")
    @operationId("searchExportJobs")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "executive", "accountant"])
    searchExportJobs(
      ...ExportJobSearchParams
    ): ApiOkResponse<PaginatedResponse<ExportJob>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get the status of an export job.")
    @operationId("getExportJob")
    @get
    @route("/{jobId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "executive", "accountant"])
    getExportJob(
      @path jobId: string
    ): ApiOkResponse<ExportJob>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get the download URL for a completed export job.")
    @operationId("downloadExportJob")
    @get
    @route("/{jobId}/download")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "executive", "accountant"])
    downloadExportJob(
      @path jobId: string
    ): ApiOkResponse<{ url: string; expiresAt: utcDateTime }>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
