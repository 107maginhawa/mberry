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
 * Domain 7 — Calendar & Scheduling
 *
 * Provides schedule containers, individual time slots, date-range blocks, and
 * recurrence rules used for booking rooms, resources, and staff time across
 * the association platform.
 */
namespace Association.Core.Scheduling;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Purpose or ownership type of a schedule.")
enum ScheduleType {
  @doc("Belongs to a single person (e.g. a staff member's calendar).")
  personal: "personal",

  @doc("Belongs to a physical or virtual resource (e.g. a projector).")
  resource: "resource",

  @doc("Belongs to a bookable room or venue.")
  room: "room",

  @doc("Shared team or chapter-level calendar.")
  shared: "shared",
}

@doc("Availability status of a time slot.")
enum SlotStatus {
  @doc("Slot is open for booking.")
  free: "free",

  @doc("Slot is confirmed as occupied.")
  busy: "busy",

  @doc("Slot is provisionally held, subject to confirmation.")
  tentative: "tentative",

  @doc("Slot is administratively blocked and cannot be booked.")
  blocked: "blocked",
}

@doc("Frequency unit for a recurrence rule.")
enum RecurrenceFrequency {
  @doc("Repeats every N days.")
  daily: "daily",

  @doc("Repeats every N weeks.")
  weekly: "weekly",

  @doc("Repeats every N months.")
  monthly: "monthly",

  @doc("Repeats every N years.")
  yearly: "yearly",
}

// ---------------------------------------------------------------------------
// Core models
// ---------------------------------------------------------------------------

@doc("A schedule container that owns slots and blocks.")
model Schedule extends AssociationBaseEntity {
  @doc("Human-readable display name for this schedule.")
  name: string;

  @doc("ID of the owning person or organisation (polymorphic).")
  owner: string;

  @doc("Type of schedule.")
  type: ScheduleType;

  @doc("IANA timezone that governs how local times are interpreted for this schedule.")
  timezone: string;
}

@doc("A single bookable or occupied time slot within a schedule.")
model Slot extends AssociationBaseEntity {
  @doc("Schedule this slot belongs to.")
  scheduleId: string;

  @doc("UTC start time of the slot.")
  startTime: utcDateTime;

  @doc("UTC end time of the slot.")
  endTime: utcDateTime;

  @doc("Availability status.")
  status: SlotStatus;

  @doc("Optional human-readable label (e.g. 'Board Meeting Prep').")
  label?: string;
}

@doc("A date-range block that marks a schedule as unavailable for an extended period.")
model ScheduleBlock extends AssociationBaseEntity {
  @doc("Schedule this block applies to.")
  scheduleId: string;

  @doc("First date of the block (inclusive).")
  startDate: plainDate;

  @doc("Last date of the block (inclusive).")
  endDate: plainDate;

  @doc("Reason for the block (e.g. 'Annual conference', 'Public holiday').")
  reason: string;

  @doc("Whether the block spans entire calendar days with no time-of-day consideration.")
  allDay: boolean;
}

@doc("Recurrence rule attached to a slot or block to generate future occurrences.")
model Recurrence {
  @doc("Base frequency of the recurrence.")
  frequency: RecurrenceFrequency;

  @doc("Repeat every N units of the chosen frequency.")
  @minValue(1)
  interval: int32;

  @doc("For weekly recurrence, the days of the week to include (e.g. ['MO', 'WE', 'FR']).")
  daysOfWeek?: string[];

  @doc("Hard stop date for the recurrence series. Mutually exclusive with count.")
  endDate?: plainDate;

  @doc("Maximum number of occurrences. Mutually exclusive with endDate.")
  @minValue(1)
  count?: int32;
}

// ---------------------------------------------------------------------------
// Request / response helpers
// ---------------------------------------------------------------------------

@doc("Request body to create a schedule.")
model ScheduleCreateRequest {
  @doc("Display name.")
  name: string;

  @doc("Owner person or organisation ID.")
  owner: string;

  @doc("Schedule type.")
  type: ScheduleType;

  @doc("IANA timezone.")
  timezone: string;
}

@doc("Partial update for a schedule.")
model ScheduleUpdateRequest {
  @doc("Display name.")
  name?: string;

  @doc("IANA timezone.")
  timezone?: string;
}

@doc("Request body to create a time slot.")
model SlotCreateRequest {
  @doc("Parent schedule ID.")
  scheduleId: string;

  @doc("UTC start time.")
  startTime: utcDateTime;

  @doc("UTC end time.")
  endTime: utcDateTime;

  @doc("Slot status.")
  status: SlotStatus;

  @doc("Optional label.")
  label?: string;

  @doc("Optional recurrence rule to generate a series from this slot.")
  recurrence?: Recurrence;
}

@doc("Partial update for a time slot.")
model SlotUpdateRequest {
  @doc("UTC start time.")
  startTime?: utcDateTime;

  @doc("UTC end time.")
  endTime?: utcDateTime;

  @doc("Slot status.")
  status?: SlotStatus;

  @doc("Label — pass null to clear.")
  label?: string | null;
}

@doc("Request body to create a schedule block.")
model ScheduleBlockCreateRequest {
  @doc("Parent schedule ID.")
  scheduleId: string;

  @doc("First date of the block.")
  startDate: plainDate;

  @doc("Last date of the block.")
  endDate: plainDate;

  @doc("Reason for blocking.")
  reason: string;

  @doc("All-day flag.")
  allDay: boolean;
}

@doc("Partial update for a schedule block.")
model ScheduleBlockUpdateRequest {
  @doc("Start date.")
  startDate?: plainDate;

  @doc("End date.")
  endDate?: plainDate;

  @doc("Reason.")
  reason?: string;

  @doc("All-day flag.")
  allDay?: boolean;
}

@doc("Query parameters for searching schedules.")
model ScheduleSearchParams {
  ...OffsetPaginationParams;
  ...SearchFilterParams;

  @doc("Filter by owner ID.")
  @query
  owner?: string;

  @doc("Filter by schedule type.")
  @query
  type?: ScheduleType;
}

@doc("Query parameters for searching slots.")
model SlotSearchParams {
  ...OffsetPaginationParams;

  @doc("Filter by schedule ID.")
  @query
  scheduleId?: string;

  @doc("Filter by slot status.")
  @query
  status?: SlotStatus;

  @doc("Slots starting on or after this timestamp.")
  @query
  startAfter?: utcDateTime;

  @doc("Slots starting on or before this timestamp.")
  @query
  startBefore?: utcDateTime;
}

@doc("Query parameters for searching schedule blocks.")
model ScheduleBlockSearchParams {
  ...OffsetPaginationParams;

  @doc("Filter by schedule ID.")
  @query
  scheduleId?: string;

  @doc("Blocks overlapping on or after this date.")
  @query
  fromDate?: plainDate;

  @doc("Blocks overlapping on or before this date.")
  @query
  toDate?: plainDate;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@route("/association/schedules")
@tag("Scheduling")
namespace ScheduleManagement {
  interface ScheduleManagement {
    @doc("Create a new schedule.")
    @operationId("createSchedule")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    createSchedule(
      @body body: ScheduleCreateRequest
    ): ApiCreatedResponse<Schedule>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a schedule by ID.")
    @operationId("getSchedule")
    @get
    @route("/{scheduleId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator", "support", "member"])
    getSchedule(
      @path scheduleId: string
    ): ApiOkResponse<Schedule>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a schedule.")
    @operationId("updateSchedule")
    @patch(#{implicitOptionality: true})
    @route("/{scheduleId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    updateSchedule(
      @path scheduleId: string,
      @body updates: ScheduleUpdateRequest
    ): ApiOkResponse<Schedule>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Delete a schedule.")
    @operationId("deleteSchedule")
    @delete
    @route("/{scheduleId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    deleteSchedule(
      @path scheduleId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search and list schedules.")
    @operationId("searchSchedules")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator", "support"])
    searchSchedules(
      ...ScheduleSearchParams
    ): ApiOkResponse<PaginatedResponse<Schedule>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}

@route("/association/slots")
@tag("Scheduling")
namespace SlotManagement {
  interface SlotManagement {
    @doc("Create a new time slot (optionally with recurrence).")
    @operationId("createSlot")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    createSlot(
      @body body: SlotCreateRequest
    ): ApiCreatedResponse<Slot>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a slot by ID.")
    @operationId("getSlot")
    @get
    @route("/{slotId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator", "member"])
    getSlot(
      @path slotId: string
    ): ApiOkResponse<Slot>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a slot.")
    @operationId("updateSlot")
    @patch(#{implicitOptionality: true})
    @route("/{slotId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    updateSlot(
      @path slotId: string,
      @body updates: SlotUpdateRequest
    ): ApiOkResponse<Slot>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Delete a slot.")
    @operationId("deleteSlot")
    @delete
    @route("/{slotId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    deleteSlot(
      @path slotId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search and list slots.")
    @operationId("searchSlots")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator", "member"])
    searchSlots(
      ...SlotSearchParams
    ): ApiOkResponse<PaginatedResponse<Slot>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}

@route("/association/schedule-blocks")
@tag("Scheduling")
namespace ScheduleBlockManagement {
  interface ScheduleBlockManagement {
    @doc("Create a schedule block.")
    @operationId("createScheduleBlock")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    createScheduleBlock(
      @body body: ScheduleBlockCreateRequest
    ): ApiCreatedResponse<ScheduleBlock>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a schedule block by ID.")
    @operationId("getScheduleBlock")
    @get
    @route("/{blockId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    getScheduleBlock(
      @path blockId: string
    ): ApiOkResponse<ScheduleBlock>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a schedule block.")
    @operationId("updateScheduleBlock")
    @patch(#{implicitOptionality: true})
    @route("/{blockId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    updateScheduleBlock(
      @path blockId: string,
      @body updates: ScheduleBlockUpdateRequest
    ): ApiOkResponse<ScheduleBlock>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Delete a schedule block.")
    @operationId("deleteScheduleBlock")
    @delete
    @route("/{blockId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    deleteScheduleBlock(
      @path blockId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search and list schedule blocks.")
    @operationId("searchScheduleBlocks")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    searchScheduleBlocks(
      ...ScheduleBlockSearchParams
    ): ApiOkResponse<PaginatedResponse<ScheduleBlock>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
