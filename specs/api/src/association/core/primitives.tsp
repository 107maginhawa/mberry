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
 * Association Core — Primitive / shared types
 *
 * All top-level association entities extend AssociationBaseEntity which
 * adds a mandatory organizationId to the common BaseEntity audit fields.
 */
namespace Association.Core;

// ---------------------------------------------------------------------------
// Base entity
// ---------------------------------------------------------------------------

/** Base entity for every association-domain model.  Adds multi-organization isolation on top of the common audit fields. */
@doc("Base entity for association domain models; extends BaseEntity with multi-organization isolation.")
model AssociationBaseEntity extends BaseEntity {
  @doc("Organization (association) this record belongs to.")
  organizationId: string;
}

// ---------------------------------------------------------------------------
// Field-visibility enum (used by PersonPrivacySettings)
// ---------------------------------------------------------------------------

@doc("Visibility level for a profile field.")
enum FieldVisibility {
  @doc("Visible to anyone, including the public.")
  public: "public",

  @doc("Visible to members of the association.")
  memberOnly: "memberOnly",

  @doc("Visible to members of the same chapter.")
  chapterOnly: "chapterOnly",

  @doc("Visible to officers and staff.")
  officerOnly: "officerOnly",

  @doc("Hidden from all parties except the record owner.")
  hidden: "hidden",
}

// ---------------------------------------------------------------------------
// PersonPrivacySettings
// ---------------------------------------------------------------------------

@doc("Per-field visibility settings for a person's profile.")
model PersonPrivacySettings {
  @doc("Visibility of the email address field.")
  email?: FieldVisibility;

  @doc("Visibility of the phone number field.")
  phone?: FieldVisibility;

  @doc("Visibility of the physical address field.")
  address?: FieldVisibility;

  @doc("Visibility of the date-of-birth field.")
  dateOfBirth?: FieldVisibility;

  @doc("Visibility of the employer / company field.")
  employer?: FieldVisibility;

  @doc("Visibility of the job-title field.")
  jobTitle?: FieldVisibility;

  @doc("Visibility of the biography / bio field.")
  bio?: FieldVisibility;

  @doc("Visibility of the social-media links field.")
  socialLinks?: FieldVisibility;

  @doc("Arbitrary additional field-level overrides keyed by field name.")
  additionalFields?: Record<FieldVisibility>;
}

// ---------------------------------------------------------------------------
// Communication channel enum (reused by several domains)
// ---------------------------------------------------------------------------

@doc("Supported communication channels.")
enum CommunicationChannel {
  @doc("Electronic mail.")
  email: "email",

  @doc("Short Message Service (SMS / text).")
  sms: "sms",

  @doc("Mobile push notification.")
  push: "push",

  @doc("Physical postal mail.")
  mail: "mail",
}

// ---------------------------------------------------------------------------
// PersonPreference
// ---------------------------------------------------------------------------

@doc("Personal preferences for communication and locale.")
model PersonPreference {
  @doc("Preferred channel for receiving communications.")
  communicationChannel?: CommunicationChannel;

  @doc("Preferred BCP 47 locale tag (e.g. 'en-US', 'fr-CA').")
  locale?: string;

  @doc("Preferred IANA timezone identifier (e.g. 'America/New_York').")
  timezone?: string;
}

// ---------------------------------------------------------------------------
// MoneyAmount
// ---------------------------------------------------------------------------

@doc("A monetary amount with an explicit ISO 4217 currency code.")
model MoneyAmount {
  @doc("Amount in minor currency units (cents/centavos). PHP 100.50 = 10050.")
  value: int64;

  @doc("ISO 4217 three-letter currency code (e.g. 'USD', 'EUR', 'PHP').")
  @minLength(3)
  @maxLength(3)
  currency: string;
}

// ---------------------------------------------------------------------------
// DateRange
// ---------------------------------------------------------------------------

@doc("An inclusive date range with an optional end date.")
model DateRange {
  @doc("Start date of the range (inclusive).")
  start: plainDate;

  @doc("End date of the range (inclusive). Omit for open-ended ranges.")
  end?: plainDate;
}
