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
 * Domains 11–12 — Communication & Notifications
 *
 * Covers the full outbound messaging pipeline: reusable message templates
 * with merge-field substitution, composed messages sent through one or more
 * channels, per-person subscription preferences, and the topic catalogue
 * that drives opt-in/opt-out controls.
 */
namespace Association.Core.Communication;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Supported outbound communication channels.")
enum Channel {
  @doc("Email via SMTP / transactional email provider.")
  email: "email",

  @doc("SMS text message.")
  sms: "sms",

  @doc("Mobile push notification.")
  push: "push",

  @doc("In-app notification displayed inside the member portal.")
  inApp: "inApp",
}

@doc("Lifecycle status of a message template.")
enum TemplateStatus {
  @doc("Being drafted; not yet available for sending.")
  draft: "draft",

  @doc("Approved and available for use in messages.")
  active: "active",

  @doc("Retired; retained for historical reference only.")
  archived: "archived",
}

@doc("Lifecycle status of a composed message.")
enum MessageStatus {
  @doc("Saved but not yet submitted for sending.")
  draft: "draft",

  @doc("Queued to be sent at a future time.")
  scheduled: "scheduled",

  @doc("Currently being dispatched to recipients.")
  sending: "sending",

  @doc("Successfully dispatched to all recipients.")
  sent: "sent",

  @doc("Dispatch failed for one or more recipients.")
  failed: "failed",

  @doc("Cancelled before sending began.")
  cancelled: "cancelled",
}

@doc("Delivery status of a message for a single recipient.")
enum DeliveryStatus {
  @doc("Queued for delivery.")
  pending: "pending",

  @doc("Successfully delivered to the recipient's inbox / device.")
  delivered: "delivered",

  @doc("Delivery failed due to an invalid or unreachable address.")
  bounced: "bounced",

  @doc("Recipient opened the message (email / in-app only).")
  opened: "opened",

  @doc("Recipient clicked a link within the message.")
  clicked: "clicked",

  @doc("Recipient opted out of future messages on this channel.")
  unsubscribed: "unsubscribed",

  @doc("Delivery failed for a reason other than bounce.")
  failed: "failed",
}

// ---------------------------------------------------------------------------
// Core entity models
// ---------------------------------------------------------------------------

@doc("A reusable message template with merge-field placeholders.")
model MessageTemplate extends AssociationBaseEntity {
  @doc("Internal name used to identify the template.")
  name: string;

  @doc("Channel this template is designed for.")
  channel: Channel;

  @doc("Subject line (required for email; optional for other channels).")
  subject?: string;

  @doc("Template body; may contain Handlebars-style merge fields (e.g. {{firstName}}).")
  body: string;

  @doc("List of merge field names expected to be provided at send time.")
  mergeFields: string[];

  @doc("Category grouping (e.g. 'membership', 'events', 'billing').")
  category: string;

  @doc("Whether this is a system-triggered transactional message (vs. a marketing broadcast).")
  isTransactional: boolean;

  @doc("Lifecycle status.")
  status: TemplateStatus;
}

@doc("Delivery tracking for a single recipient of a message.")
model MessageRecipient {
  @doc("Person this recipient record refers to.")
  personId: string;

  @doc("Current delivery status for this recipient.")
  deliveryStatus: DeliveryStatus;

  @doc("Timestamp at which the message was delivered to this recipient.")
  deliveredAt?: utcDateTime;
}

@doc("A composed message ready to be dispatched to one or more recipients.")
model Message extends AssociationBaseEntity {
  @doc("Template this message was composed from (optional; may be ad-hoc).")
  templateId?: string;

  @doc("Channel through which the message will be sent.")
  channel: Channel;

  @doc("Person or system identity that is sending the message.")
  senderId: string;

  @doc("List of intended recipients with per-person delivery tracking.")
  recipients: MessageRecipient[];

  @doc("Subject line (required for email channel).")
  subject?: string;

  @doc("Rendered message body (merge fields already substituted).")
  body: string;

  @doc("Future timestamp at which the message should be sent.")
  scheduledAt?: utcDateTime;

  @doc("Timestamp at which dispatch began.")
  sentAt?: utcDateTime;

  @doc("Current lifecycle status.")
  status: MessageStatus;
}

@doc("A topic that persons can subscribe or unsubscribe from.")
model SubscriptionTopic extends AssociationBaseEntity {
  @doc("Display name of the topic.")
  name: string;

  @doc("Optional description shown to members on the preferences page.")
  description?: string;

  @doc("Channel this topic applies to.")
  channel: Channel;

  @doc("Grouping category (e.g. 'chapter-news', 'events', 'billing-alerts').")
  category: string;

  @doc("Whether new members are subscribed to this topic by default.")
  defaultEnabled: boolean;
}

@doc("A person's subscription preference for a specific topic.")
model PersonSubscription extends AssociationBaseEntity {
  @doc("Person this preference belongs to.")
  personId: string;

  @doc("Topic this preference refers to.")
  topicId: string;

  @doc("Whether the person wants to receive messages on this topic.")
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Request / response helpers
// ---------------------------------------------------------------------------

@doc("Request body to create a message template.")
model MessageTemplateCreateRequest {
  @doc("Internal name.")
  name: string;

  @doc("Target channel.")
  channel: Channel;

  @doc("Subject line (optional).")
  subject?: string;

  @doc("Template body.")
  body: string;

  @doc("Expected merge fields.")
  mergeFields: string[];

  @doc("Category.")
  category: string;

  @doc("Is transactional flag.")
  isTransactional: boolean;
}

@doc("Partial update for a message template.")
model MessageTemplateUpdateRequest {
  @doc("Internal name.")
  name?: string;

  @doc("Subject line — pass null to clear.")
  subject?: string | null;

  @doc("Template body.")
  body?: string;

  @doc("Merge field list — replaces existing list.")
  mergeFields?: string[];

  @doc("Category.")
  category?: string;

  @doc("Status.")
  status?: TemplateStatus;
}

@doc("Request body to preview a template with sample merge data.")
model MessageTemplatePreviewRequest {
  @doc("Sample merge-field values keyed by field name.")
  mergeData: Record<string>;
}

@doc("Response containing the rendered preview.")
model MessageTemplatePreviewResponse {
  @doc("Rendered subject line (after merge substitution).")
  subject?: string;

  @doc("Rendered message body (after merge substitution).")
  body: string;
}

@doc("Request body to compose a message.")
model MessageCreateRequest {
  @doc("Template to base the message on (optional).")
  templateId?: string;

  @doc("Channel.")
  channel: Channel;

  @doc("Sender identity.")
  senderId: string;

  @doc("Recipient person IDs.")
  recipientPersonIds: string[];

  @doc("Subject line (required for email).")
  subject?: string;

  @doc("Message body.")
  body: string;

  @doc("Schedule the message to send at this future time (omit to send immediately).")
  scheduledAt?: utcDateTime;
}

@doc("Request body to create a subscription topic.")
model SubscriptionTopicCreateRequest {
  @doc("Display name.")
  name: string;

  @doc("Description (optional).")
  description?: string;

  @doc("Channel.")
  channel: Channel;

  @doc("Category.")
  category: string;

  @doc("Default enabled flag.")
  defaultEnabled: boolean;
}

@doc("A single subscription update for a bulk-update operation.")
model PersonSubscriptionUpdate {
  @doc("Topic ID to update.")
  topicId: string;

  @doc("New enabled state.")
  enabled: boolean;
}

@doc("Request body to bulk-update a person's subscriptions.")
model PersonSubscriptionBulkUpdateRequest {
  @doc("List of subscription changes to apply.")
  updates: PersonSubscriptionUpdate[];
}

@doc("Query parameters for searching message templates.")
model MessageTemplateSearchParams {
  ...OffsetPaginationParams;
  ...SearchFilterParams;

  @doc("Filter by channel.")
  @query
  channel?: Channel;

  @doc("Filter by category.")
  @query
  category?: string;

  @doc("Filter by status.")
  @query
  status?: TemplateStatus;

  @doc("Only return transactional (or non-transactional) templates.")
  @query
  isTransactional?: boolean;
}

@doc("Query parameters for searching messages.")
model MessageSearchParams {
  ...OffsetPaginationParams;

  @doc("Filter by channel.")
  @query
  channel?: Channel;

  @doc("Filter by sender ID.")
  @query
  senderId?: string;

  @doc("Filter by status.")
  @query
  status?: MessageStatus;

  @doc("Messages scheduled on or after this timestamp.")
  @query
  scheduledAfter?: utcDateTime;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@route("/association/message-templates")
@tag("Communication")
namespace MessageTemplateManagement {
  interface MessageTemplateManagement {
    @doc("Create a message template.")
    @operationId("createMessageTemplate")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    createMessageTemplate(
      @body body: MessageTemplateCreateRequest
    ): ApiCreatedResponse<MessageTemplate>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a message template by ID.")
    @operationId("getMessageTemplate")
    @get
    @route("/{templateId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    getMessageTemplate(
      @path templateId: string
    ): ApiOkResponse<MessageTemplate>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a message template.")
    @operationId("updateMessageTemplate")
    @patch(#{implicitOptionality: true})
    @route("/{templateId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    updateMessageTemplate(
      @path templateId: string,
      @body updates: MessageTemplateUpdateRequest
    ): ApiOkResponse<MessageTemplate>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Delete a message template.")
    @operationId("deleteMessageTemplate")
    @delete
    @route("/{templateId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    deleteMessageTemplate(
      @path templateId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search and list message templates.")
    @operationId("searchMessageTemplates")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    searchMessageTemplates(
      ...MessageTemplateSearchParams
    ): ApiOkResponse<PaginatedResponse<MessageTemplate>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Preview a rendered template with sample merge data.")
    @operationId("previewMessageTemplate")
    @post
    @route("/{templateId}/preview")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    previewMessageTemplate(
      @path templateId: string,
      @body body: MessageTemplatePreviewRequest
    ): ApiOkResponse<MessageTemplatePreviewResponse>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}

@route("/association/messages")
@tag("Communication")
namespace MessageManagement {
  interface MessageManagement {
    @doc("Compose a new message.")
    @operationId("createMessage")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    createMessage(
      @body body: MessageCreateRequest
    ): ApiCreatedResponse<Message>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a message by ID.")
    @operationId("getMessage")
    @get
    @route("/{messageId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    getMessage(
      @path messageId: string
    ): ApiOkResponse<Message>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a draft message.")
    @operationId("updateMessage")
    @patch(#{implicitOptionality: true})
    @route("/{messageId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    updateMessage(
      @path messageId: string,
      @body updates: MessageCreateRequest
    ): ApiOkResponse<Message>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Delete a draft message.")
    @operationId("deleteMessage")
    @delete
    @route("/{messageId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    deleteMessage(
      @path messageId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search and list messages.")
    @operationId("searchMessages")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    searchMessages(
      ...MessageSearchParams
    ): ApiOkResponse<PaginatedResponse<Message>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Send a draft message immediately.")
    @operationId("sendMessage")
    @post
    @route("/{messageId}/send")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    sendMessage(
      @path messageId: string
    ): ApiOkResponse<Message>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Schedule a message to be sent at a future time.")
    @operationId("scheduleMessage")
    @post
    @route("/{messageId}/schedule")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    scheduleMessage(
      @path messageId: string,
      @body body: { scheduledAt: utcDateTime }
    ): ApiOkResponse<Message>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Cancel a scheduled message.")
    @operationId("cancelMessage")
    @post
    @route("/{messageId}/cancel")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator"])
    cancelMessage(
      @path messageId: string
    ): ApiOkResponse<Message>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}

@route("/association/subscription-topics")
@tag("Communication")
namespace SubscriptionTopicManagement {
  interface SubscriptionTopicManagement {
    @doc("Create a subscription topic.")
    @operationId("createSubscriptionTopic")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    createSubscriptionTopic(
      @body body: SubscriptionTopicCreateRequest
    ): ApiCreatedResponse<SubscriptionTopic>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a subscription topic by ID.")
    @operationId("getSubscriptionTopic")
    @get
    @route("/{topicId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator", "member"])
    getSubscriptionTopic(
      @path topicId: string
    ): ApiOkResponse<SubscriptionTopic>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a subscription topic.")
    @operationId("updateSubscriptionTopic")
    @patch(#{implicitOptionality: true})
    @route("/{topicId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    updateSubscriptionTopic(
      @path topicId: string,
      @body updates: SubscriptionTopicCreateRequest
    ): ApiOkResponse<SubscriptionTopic>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Delete a subscription topic.")
    @operationId("deleteSubscriptionTopic")
    @delete
    @route("/{topicId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    deleteSubscriptionTopic(
      @path topicId: string
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}

@route("/association/person-subscriptions")
@tag("Communication")
namespace PersonSubscriptionManagement {
  interface PersonSubscriptionManagement {
    @doc("List a person's subscription preferences.")
    @operationId("listPersonSubscriptions")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "coordinator", "member:owner"])
    listPersonSubscriptions(
      @query personId: string,
      ...OffsetPaginationParams
    ): ApiOkResponse<PaginatedResponse<PersonSubscription>>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Update a single subscription preference.")
    @operationId("updatePersonSubscription")
    @patch(#{implicitOptionality: true})
    @route("/{subscriptionId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "member:owner"])
    updatePersonSubscription(
      @path subscriptionId: string,
      @body updates: { enabled: boolean }
    ): ApiOkResponse<PersonSubscription>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Bulk-update multiple subscription preferences for a person.")
    @operationId("bulkUpdatePersonSubscriptions")
    @post
    @route("/bulk-update")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "member:owner"])
    bulkUpdatePersonSubscriptions(
      @body body: PersonSubscriptionBulkUpdateRequest
    ): ApiOkResponse<PersonSubscription[]>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
