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
 * Domain 38: Events Management
 *
 * Covers the full lifecycle of association events including registration,
 * waitlist management, and on-site check-in operations.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Lifecycle status of an association event")
enum EventStatus {
  @doc("Event record exists but is not yet visible to members")
  draft: "draft",

  @doc("Event is visible to members but registration is not yet open")
  published: "published",

  @doc("Registration window is open")
  registrationOpen: "registration_open",

  @doc("Registration window has closed")
  registrationClosed: "registration_closed",

  @doc("Event is currently taking place")
  inProgress: "in_progress",

  @doc("Event has concluded")
  completed: "completed",

  @doc("Event has been cancelled")
  cancelled: "cancelled",
}

@doc("Type category of an association event")
enum EventType {
  @doc("General assembly or annual meeting")
  assembly: "assembly",

  @doc("Educational seminar")
  seminar: "seminar",

  @doc("Social or networking gathering")
  social: "social",

  @doc("Networking-focused event")
  networking: "networking",

  @doc("Fundraiser or charity event")
  fundraiser: "fundraiser",

  @doc("Governance or committee meeting")
  governance: "governance",

  @doc("Custom event type defined by the organization")
  custom: "custom",
}

@doc("Status of an individual event registration")
enum RegistrationStatus {
  @doc("Attendee has registered and holds a confirmed spot")
  registered: "registered",

  @doc("Attendee is on the waitlist pending a spot")
  waitlisted: "waitlisted",

  @doc("Registration has been explicitly confirmed (e.g., after payment)")
  confirmed: "confirmed",

  @doc("Attendee has checked in at the event")
  checkedIn: "checked_in",

  @doc("Registration was cancelled by the attendee or organizer")
  cancelled: "cancelled",

  @doc("Attendee did not show up")
  noShow: "no_show",

  @doc("Registration fee has been refunded")
  refunded: "refunded",
}

@doc("Status of a waitlist entry")
enum WaitlistEntryStatus {
  @doc("Entry is actively waiting for a spot")
  waiting: "waiting",

  @doc("Entry has been promoted to a full registration")
  promoted: "promoted",

  @doc("Attendee confirmed the promoted spot")
  confirmed: "confirmed",

  @doc("Promotion offer expired before the attendee responded")
  expired: "expired",

  @doc("Entry was cancelled")
  cancelled: "cancelled",
}

@doc("CPD continuing professional development activity type")
enum CpdActivityType {
  @doc("Formal presentation, most common for dental/medical CPD")
  seminar: "seminar",

  @doc("Hands-on, interactive session")
  workshop: "workshop",

  @doc("Multi-session, multi-day event")
  conference: "conference",

  @doc("Online live session")
  webinar: "webinar",

  @doc("Clinical skills training, lab work")
  handsOn: "hands_on",

  @doc("Outreach, dental missions, health camps")
  community: "community",

  @doc("Paper presentation, poster session")
  research: "research",

  @doc("Preceptorship, teaching, supervision")
  mentorship: "mentorship",

  @doc("Reading group, journal club (SDL, often capped at 30% of total)")
  selfDirected: "self_directed",

  @doc("Catch-all for org-specific types")
  other: "other",
}

@doc("Visibility scope of an event")
enum EventVisibility {
  @doc("Visible only to organization members")
  internal: "internal",

  @doc("Visible publicly across the network")
  network: "network",
}

@doc("Method used to check in an attendee")
enum CheckInMethod {
  @doc("QR code scan at the door")
  qrCode: "qr_code",

  @doc("Manual check-in by staff")
  manual: "manual",

  @doc("Badge reader or RFID scan")
  badge: "badge",
}

// ---------------------------------------------------------------------------
// Domain Models
// ---------------------------------------------------------------------------

@doc("Association event with scheduling and registration metadata")
model Event extends BaseEntity {

  @doc("Display title of the event")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Owning organization identifier")
  organizationId: string;

  @doc("Category of the event")
  eventType: EventType;

  @doc("UTC date and time the event starts")
  startDate: utcDateTime;

  @doc("UTC date and time the event ends")
  endDate: utcDateTime;

  @doc("Physical venue or address")
  @maxLength(500)
  location?: string;

  @doc("URL for virtual or hybrid attendance")
  virtualUrl?: string;

  @doc("Maximum number of attendees; null means unlimited")
  @minValue(1)
  capacity?: int32;

  @doc("Number of confirmed registrations")
  @minValue(0)
  registeredCount: int32;

  @doc("Number of entries on the waitlist")
  @minValue(0)
  waitlistCount: int32;

  @doc("Detailed description or agenda")
  description?: string;

  @doc("Standard registration fee in the stated currency")
  @minValue(0)
  registrationFee?: int64;

  @doc("ISO 4217 currency code for all monetary amounts on this event")
  @maxLength(3)
  currency?: string;

  @doc("Deadline to receive the early-bird fee discount")
  earlyBirdDeadline?: utcDateTime;

  @doc("Discounted fee available before the early-bird deadline")
  @minValue(0)
  earlyBirdFee?: int64;

  @doc("Current lifecycle status of the event")
  status: EventStatus;

  @doc("Whether attendance awards continuing education credits")
  creditBearing: boolean;

  @doc("Number of CE credits awarded for attendance")
  @minValue(0)
  creditAmount?: float64;

  @doc("CPD activity type categorization")
  cpdActivityType?: CpdActivityType;

  @doc("URL-safe slug for public event page, globally unique, immutable after first save")
  @maxLength(300)
  eventSlug?: string;

  @doc("URL of the cover image stored in S3/MinIO")
  @maxLength(2048)
  coverImageUrl?: string;

  @doc("Visibility scope of the event")
  visibility: EventVisibility;
}

@doc("An individual person's registration for a specific event")
model EventRegistration extends BaseEntity {

  @doc("Event being registered for")
  eventId: string;

  @doc("Registrant person identifier")
  personId: string;

  @doc("UTC timestamp when the registration was created")
  registeredAt: utcDateTime;

  @doc("Optional ticket tier or category")
  @maxLength(100)
  ticketType?: string;

  @doc("Amount paid at the time of registration")
  @minValue(0)
  amountPaid?: int64;

  @doc("Reference to the corresponding payment transaction")
  paymentId?: string;

  @doc("UTC timestamp when payment settled (online webhook or walk-up cash mark-paid). Null until paid — the paid/unpaid door signal.")
  paidAt?: utcDateTime;

  @doc("Current status of this registration")
  status: RegistrationStatus;
}

@doc("A position held on an event waitlist")
model WaitlistEntry extends BaseEntity {

  @doc("Event this entry is waiting for")
  eventId: string;

  @doc("Person waiting for a spot")
  personId: string;

  @doc("Ordinal position in the waitlist queue (1 = next in line)")
  @minValue(1)
  position: int32;

  @doc("UTC timestamp when the person was added to the waitlist")
  addedAt: utcDateTime;

  @doc("UTC timestamp when the person was promoted off the waitlist")
  promotedAt?: utcDateTime;

  @doc("Current status of this waitlist entry")
  status: WaitlistEntryStatus;
}

@doc("An attendance check-in record for an event registrant")
model CheckIn extends BaseEntity {

  @doc("Event at which the check-in occurred")
  eventId: string;

  @doc("Registration record being checked in")
  registrationId: string;

  @doc("Person who checked in")
  personId: string;

  @doc("UTC timestamp of the check-in action")
  checkedInAt: utcDateTime;

  @doc("Method used to perform the check-in")
  method: CheckInMethod;

  @doc("Staff member or system that performed the check-in")
  checkedInBy?: string;
}

// ---------------------------------------------------------------------------
// Request / Response Models
// ---------------------------------------------------------------------------

@doc("Request body for creating a new event")
model EventCreateRequest {
  @doc("Display title")
  @minLength(1)
  @maxLength(255)
  title: string;

  @doc("Owning organization")
  organizationId: string;

  @doc("Event category")
  eventType: EventType;

  @doc("Start date and time")
  startDate: utcDateTime;

  @doc("End date and time")
  endDate?: utcDateTime;

  @doc("Physical location")
  location?: string;

  @doc("Virtual attendance URL")
  virtualUrl?: string;

  @doc("Maximum capacity")
  @minValue(1)
  capacity?: int32;

  @doc("Detailed description")
  description?: string;

  @doc("Standard registration fee")
  @minValue(0)
  registrationFee?: int64;

  @doc("ISO 4217 currency code")
  @maxLength(3)
  currency?: string;

  @doc("Early-bird deadline")
  earlyBirdDeadline?: utcDateTime;

  @doc("Early-bird fee")
  @minValue(0)
  earlyBirdFee?: int64;

  @doc("Whether attendance awards CE credits")
  creditBearing: boolean;

  @doc("CE credit amount")
  @minValue(0)
  creditAmount?: float64;

  @doc("CPD activity type")
  cpdActivityType?: CpdActivityType;

  @doc("Cover image URL")
  @maxLength(2048)
  coverImageUrl?: string;

  @doc("Visibility scope")
  visibility?: EventVisibility;
}

@doc("Request body for updating an existing event")
model EventUpdateRequest {
  @doc("Display title")
  @minLength(1)
  @maxLength(255)
  title?: string;

  @doc("Event category")
  eventType?: EventType;

  @doc("Start date and time")
  startDate?: utcDateTime;

  @doc("End date and time")
  endDate?: utcDateTime;

  @doc("Physical location")
  location?: string | null;

  @doc("Virtual attendance URL")
  virtualUrl?: string | null;

  @doc("Maximum capacity")
  @minValue(1)
  capacity?: int32 | null;

  @doc("Detailed description")
  description?: string | null;

  @doc("Standard registration fee")
  @minValue(0)
  registrationFee?: int64 | null;

  @doc("ISO 4217 currency code")
  @maxLength(3)
  currency?: string | null;

  @doc("Early-bird deadline")
  earlyBirdDeadline?: utcDateTime | null;

  @doc("Early-bird fee")
  @minValue(0)
  earlyBirdFee?: int64 | null;

  @doc("Whether attendance awards CE credits")
  creditBearing?: boolean;

  @doc("CE credit amount")
  @minValue(0)
  creditAmount?: float64 | null;

  @doc("CPD activity type")
  cpdActivityType?: CpdActivityType | null;

  @doc("Cover image URL")
  @maxLength(2048)
  coverImageUrl?: string | null;

  @doc("Visibility scope")
  visibility?: EventVisibility;
}

@doc("Query parameters for filtering events")
model EventSearchParams {
  ...PaginationQuery;

  @doc("Filter by owning organization")
  @query
  organizationId?: string;

  @doc("Filter by event type")
  @query
  eventType?: EventType;

  @doc("Filter by lifecycle status")
  @query
  status?: EventStatus;

  @doc("Filter events starting on or after this date")
  @query
  startDateFrom?: utcDateTime;

  @doc("Filter events starting on or before this date")
  @query
  startDateTo?: utcDateTime;
}

@doc("Request body for creating an event registration")
model EventRegistrationCreateRequest {
  @doc("Event to register for")
  eventId: string;

  @doc("Person being registered")
  personId: string;

  @doc("Ticket tier or category")
  ticketType?: string;

  @doc("Amount paid")
  @minValue(0)
  amountPaid?: int64;

  @doc("Payment transaction reference")
  paymentId?: string;
}

@doc("Query parameters for filtering registrations")
model RegistrationSearchParams {
  ...PaginationQuery;

  @doc("Filter by event")
  @query
  eventId?: string;

  @doc("Filter by person")
  @query
  personId?: string;

  @doc("Filter by registration status")
  @query
  status?: RegistrationStatus;
}

@doc("Request body for creating a check-in record")
model CheckInCreateRequest {
  @doc("Event at which the check-in occurs")
  eventId: string;

  @doc("Registration record being checked in")
  registrationId: string;

  @doc("Person checking in")
  personId: string;

  @doc("Check-in method")
  method: CheckInMethod;

  @doc("Staff member performing the check-in")
  checkedInBy?: string;
}

@doc("""
Request body for a manual (staff) custom-event check-in. The event comes from
the path; a person may be checked in without a prior registration (walk-in), so
personId defaults to the caller and registrationId is optional.
""")
model CustomEventCheckInRequest {
  @doc("Person being checked in; defaults to the authenticated caller when omitted")
  personId?: string;

  @doc("Check-in method; defaults to manual")
  method?: CheckInMethod;

  @doc("Registration record being checked in, if the attendee was pre-registered")
  registrationId?: string;

  @doc("Staff member performing the check-in")
  checkedInBy?: string;
}

@doc("Query parameters for check-in search")
model CheckInSearchParams {
  ...PaginationQuery;

  @doc("Filter by event")
  @query
  eventId?: string;

  @doc("Filter by person")
  @query
  personId?: string;

  @doc("Filter by check-in method")
  @query
  method?: CheckInMethod;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

namespace Association.Operations.Events {

  /**
   * Event lifecycle management.
   */
  @useAuth(bearerAuth)
  interface EventManagement {
    @doc("Create a new event.")
    @operationId("createEvent")
    @post
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    @extension("x-require-position", #["Society Officer", "President"])
    @extension("x-audit", #{ action: "create", resourceType: "event" })
    createEvent(
      @body body: EventCreateRequest
    ): ApiCreatedResponse<Event>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get an event by ID.")
    @operationId("getEvent")
    @get
    @route("/{eventId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    getEvent(
      @path eventId: string
    ): ApiOkResponse<Event>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update an existing event.")
    @operationId("updateEvent")
    @patch(#{implicitOptionality: true})
    @route("/{eventId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    @extension("x-require-position", #["Society Officer", "President"])
    @extension("x-audit", #{ action: "update", resourceType: "event" })
    updateEvent(
      @path eventId: string,
      @body updates: EventUpdateRequest
    ): ApiOkResponse<Event>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete an event.")
    @operationId("deleteEvent")
    @delete
    @route("/{eventId}")
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-require-position", #["Society Officer", "President"])
    @extension("x-audit", #{ action: "delete", resourceType: "event" })
    deleteEvent(
      @path eventId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search and list events with filtering and pagination.")
    @operationId("searchEvents")
    @get
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member"])
    searchEvents(
      ...EventSearchParams
    ): ApiOkResponse<PaginatedResponse<Event>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Publish a draft event making it visible to members.")
    @operationId("publishEvent")
    @post
    @route("/{eventId}/publish")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    @extension("x-require-position", #["Society Officer", "President"])
    @extension("x-audit", #{ action: "update", resourceType: "event" })
    publishEvent(
      @path eventId: string
    ): ApiOkResponse<Event>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;

    @doc("Cancel an event and notify registered attendees.")
    @operationId("cancelEvent")
    @post
    @route("/{eventId}/cancel")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    @extension("x-require-position", #["Society Officer", "President"])
    @extension("x-audit", #{ action: "update", resourceType: "event" })
    cancelEvent(
      @path eventId: string
    ): ApiOkResponse<Event>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;
  }

  /**
   * Event registration management.
   */
  @useAuth(bearerAuth)
  interface EventRegistrationManagement {
    @doc("Register a person for an event.")
    @operationId("createEventRegistration")
    @post
    @route("/registrations")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member:owner"])
    @extension("x-audit", #{ action: "create", resourceType: "event-registration" })
    createEventRegistration(
      @body body: EventRegistrationCreateRequest
    ): ApiCreatedResponse<EventRegistration>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a registration by ID.")
    @operationId("getEventRegistration")
    @get
    @route("/registrations/{registrationId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member:owner"])
    getEventRegistration(
      @path registrationId: string
    ): ApiOkResponse<EventRegistration>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a registration.")
    @operationId("updateEventRegistration")
    @patch(#{implicitOptionality: true})
    @route("/registrations/{registrationId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    @extension("x-require-position", #["Society Officer", "President"])
    @extension("x-audit", #{ action: "update", resourceType: "event-registration" })
    updateEventRegistration(
      @path registrationId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<EventRegistration>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a registration record.")
    @operationId("deleteEventRegistration")
    @delete
    @route("/registrations/{registrationId}")
    @extension("x-security-required-roles", #["association:admin"])
    @extension("x-require-position", #["Society Officer", "President"])
    @extension("x-audit", #{ action: "delete", resourceType: "event-registration" })
    deleteEventRegistration(
      @path registrationId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search registrations with filtering and pagination.")
    @operationId("searchEventRegistrations")
    @get
    @route("/registrations")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    searchEventRegistrations(
      ...RegistrationSearchParams
    ): ApiOkResponse<PaginatedResponse<EventRegistration>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Cancel a registration optionally triggering a refund workflow.")
    @operationId("cancelEventRegistration")
    @post
    @route("/registrations/{registrationId}/cancel")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:member:owner"])
    @extension("x-audit", #{ action: "update", resourceType: "event-registration" })
    cancelEventRegistration(
      @path registrationId: string
    ): ApiOkResponse<EventRegistration>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;

    @doc("Initiate a refund for a cancelled registration.")
    @operationId("refundEventRegistration")
    @post
    @route("/registrations/{registrationId}/refund")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    @extension("x-require-position", #["Society Officer", "President"])
    @extension("x-audit", #{ action: "update", resourceType: "event-registration" })
    refundEventRegistration(
      @path registrationId: string
    ): ApiOkResponse<EventRegistration>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;

    @doc("Mark a paid-event registration as paid for walk-up cash collected at the door. Officer-only, idempotent (a second call returns the already-paid registration), and rejected for free events. The cash trail is the audit event.")
    @operationId("markEventRegistrationPaid")
    @post
    @route("/registrations/{registrationId}/mark-paid")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    @extension("x-require-position", #["Society Officer", "President"])
    @extension("x-audit", #{ action: "update", resourceType: "event-registration" })
    markEventRegistrationPaid(
      @path registrationId: string
    ): ApiOkResponse<EventRegistration>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;
  }

  /**
   * Waitlist management for capacity-limited events.
   */
  @useAuth(bearerAuth)
  interface WaitlistManagement {
    @doc("List waitlist entries for an event.")
    @operationId("listWaitlistEntries")
    @get
    @route("/{eventId}/waitlist")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    listWaitlistEntries(
      @path eventId: string,
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<WaitlistEntry>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Promote the next waitlist entry to a confirmed registration.")
    @operationId("promoteWaitlistEntry")
    @post
    @route("/{eventId}/waitlist/{entryId}/promote")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    @extension("x-require-position", #["Society Officer", "President"])
    @extension("x-audit", #{ action: "update", resourceType: "waitlist-entry" })
    promoteWaitlistEntry(
      @path eventId: string,
      @path entryId: string
    ): ApiOkResponse<WaitlistEntry>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;
  }

  /**
   * On-site and virtual check-in management.
   * Creating a check-in is idempotent on registrationId.
   */
  @useAuth(bearerAuth)
  interface CheckInManagement {
    @doc("Record an attendee check-in. Idempotent on registrationId — subsequent calls return the existing record.")
    @operationId("createCheckIn")
    @post
    @route("/checkins")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    @extension("x-require-position", #["Society Officer", "President"])
    @extension("x-audit", #{ action: "create", resourceType: "check-in" })
    createCheckIn(
      @body body: CheckInCreateRequest
    ): ApiCreatedResponse<CheckIn>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Search check-in records with filtering and pagination.")
    @operationId("searchCheckIns")
    @get
    @route("/checkins")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    searchCheckIns(
      ...CheckInSearchParams
    ): ApiOkResponse<PaginatedResponse<CheckIn>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }

  /**
   * Member-facing and officer lifecycle operations for hand-wired events routes.
   * Covers operations not addressed by EventManagement CRUD interfaces.
   */
  @useAuth(bearerAuth)
  interface EventLifecycleService {
    @doc("List events the authenticated member is registered for.")
    @operationId("listMyCustomEvents")
    @get
    @route("/my")
    @extension("x-security-required-roles", #["association:member"])
    listMyCustomEvents(
      @query organizationId?: string,
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<Event>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Self-register the authenticated member for an event.")
    @operationId("registerForCustomEvent")
    @post
    @route("/{eventId}/register")
    @extension("x-security-required-roles", #["association:member"])
    @extension("x-audit", #{ action: "create", resourceType: "event-registration" })
    registerForCustomEvent(
      @path eventId: string
    ): ApiCreatedResponse<EventRegistration>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;

    @doc("Register and pay for a paid event. Creates a Stripe Checkout session and returns the checkout URL.")
    @operationId("registerAndPayForEvent")
    @post
    @route("/{eventId}/register-and-pay")
    @extension("x-security-required-roles", #["association:member"])
    registerAndPayForEvent(
      @path eventId: string
    ): ApiCreatedResponse<{
      @doc("Stripe Checkout session URL")
      checkoutUrl: string;
      @doc("Registration ID (pending payment)")
      registrationId: string;
    }>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;

    @doc("Register and pay for a paid event via the org's PayMongo connected account. Creates a PayMongo checkout session and returns the checkout URL; the registration settles when the PayMongo webhook fires.")
    @operationId("registerAndPayForEventViaPaymongo")
    @post
    @route("/{eventId}/register-and-pay-paymongo")
    @extension("x-security-required-roles", #["association:member"])
    registerAndPayForEventViaPaymongo(
      @path eventId: string
    ): ApiCreatedResponse<{
      @doc("PayMongo Checkout session URL")
      checkoutUrl: string;
      @doc("Registration ID (pending payment)")
      registrationId: string;
    }>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;

    @doc("Check in an attendee at a specific event.")
    @operationId("checkInCustomEvent")
    @post
    @route("/{eventId}/check-in")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    @extension("x-require-position", #["Society Officer", "President"])
    @extension("x-audit", #{ action: "create", resourceType: "check-in" })
    checkInCustomEvent(
      @path eventId: string,
      @body body: CustomEventCheckInRequest
    ): ApiCreatedResponse<CheckIn>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;

    @doc("List all attendance check-in records for a specific event.")
    @operationId("listCustomEventAttendance")
    @get
    @route("/{eventId}/attendance")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    listCustomEventAttendance(
      @path eventId: string,
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<CheckIn>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("List all registrations for a specific event.")
    @operationId("listCustomEventRegistrations")
    @get
    @route("/{eventId}/registrations")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    listCustomEventRegistrations(
      @path eventId: string,
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<EventRegistration>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Transition a published event to completed status. Only Society Officers and Presidents may complete events.")
    @operationId("completeEvent")
    @post
    @route("/{eventId}/complete")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    @extension("x-require-position", #["Society Officer", "President"])
    @extension("x-audit", #{ action: "update", resourceType: "event" })
    completeEvent(
      @path eventId: string,
    ): ApiOkResponse<Event>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;
  }

  /**
   * Public event endpoints. No authentication required.
   * Used for shareable event pages and social media previews.
   */
  interface PublicEventEndpoints {
    @doc("Get a published event by its public slug. Returns 404 for draft/cancelled events.")
    @operationId("getPublicEvent")
    @get
    @route("/public/events/{slug}")
    getPublicEvent(
      @path slug: string
    ): ApiOkResponse<Event>
      | ApiNotFoundResponse;

    @doc("List public events across all organizations. Only shows network-visibility, non-draft events.")
    @operationId("listPublicEvents")
    @get
    @route("/public/events")
    listPublicEvents(
      ...PaginationQuery,

      @doc("Filter by country (from org region)")
      @query
      country?: string,

      @doc("Filter by event type")
      @query
      eventType?: EventType,

      @doc("Filter events starting on or after this date")
      @query
      dateFrom?: utcDateTime,

      @doc("Filter events starting on or before this date")
      @query
      dateTo?: utcDateTime,

      @doc("Filter by pricing: free, paid, or all")
      @query
      pricing?: string,
    ): ApiOkResponse<PaginatedResponse<Event>>;
  }
}
