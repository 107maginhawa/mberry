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
 * Domains 54-55: Webhooks & External Connectors
 *
 * Covers outbound webhook subscription management with delivery tracking and
 * retry, an event topic registry, and external system connector configuration
 * with health monitoring and credential rotation.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Status of a webhook subscription")
enum WebhookStatus {
  @doc("Subscription is active and receiving deliveries")
  active: "active",

  @doc("Subscription is temporarily paused by the user")
  paused: "paused",

  @doc("Subscription has been disabled administratively")
  disabled: "disabled",

  @doc("Subscription is in an error state due to repeated delivery failures")
  error: "error",
}

@doc("Status of an individual webhook delivery attempt")
enum WebhookDeliveryStatus {
  @doc("Delivery was successful (2xx response from target)")
  delivered: "delivered",

  @doc("Delivery failed and will not be retried")
  failed: "failed",

  @doc("Delivery failed and a retry is scheduled")
  retrying: "retrying",
}

@doc("Type category of an external connector")
enum ConnectorType {
  @doc("Payment gateway (e.g., Stripe, Authorize.net)")
  paymentGateway: "payment_gateway",

  @doc("SMS messaging provider")
  sms: "sms",

  @doc("Transactional email provider")
  email: "email",

  @doc("File storage provider (S3, Azure Blob)")
  storage: "storage",

  @doc("CRM system")
  crm: "crm",

  @doc("Learning Management System")
  lms: "lms",

  @doc("Video conferencing platform")
  videoConference: "video_conference",

  @doc("Social media platform")
  socialMedia: "social_media",

  @doc("Custom or bespoke integration")
  custom: "custom",
}

@doc("Operational status of a connector")
enum ConnectorStatus {
  @doc("Connector is configured but not yet tested in production")
  configured: "configured",

  @doc("Connector is undergoing connectivity testing")
  testing: "testing",

  @doc("Connector is operational")
  active: "active",

  @doc("Connector is experiencing intermittent issues")
  degraded: "degraded",

  @doc("Connector has been disabled")
  disabled: "disabled",
}

@doc("Health status returned by the connector's health check")
enum ConnectorHealthStatus {
  @doc("Connector endpoint is responding normally")
  healthy: "healthy",

  @doc("Connector endpoint is responding with degraded performance")
  degraded: "degraded",

  @doc("Connector endpoint is not reachable")
  unreachable: "unreachable",
}

@doc("Authentication method used by a connector")
enum ConnectorAuthMethod {
  @doc("API key passed in a header or query string")
  apiKey: "api_key",

  @doc("OAuth 2.0 client credentials or authorization code")
  oauth2: "oauth2",

  @doc("HTTP Basic authentication")
  basic: "basic",

  @doc("Mutual TLS certificate authentication")
  certificate: "certificate",

  @doc("No authentication required")
  none: "none",
}

// ---------------------------------------------------------------------------
// Domain Models
// ---------------------------------------------------------------------------

@doc("An outbound webhook subscription that receives event notifications")
model WebhookSubscription extends BaseEntity {
  @doc("Tenant this subscription belongs to")
  organizationId: string;

  @doc("Human-readable subscription name")
  @minLength(1)
  @maxLength(255)
  name: string;

  @doc("HTTPS endpoint that receives webhook payloads")
  @format("uri")
  targetUrl: string;

  @doc("List of event topic names this subscription listens to")
  events: string[];

  @doc("""
    HMAC signing secret used to authenticate webhook payloads.
    Write-only — never returned in API responses.
    """)
  secret?: string;

  @doc("Current subscription status")
  status: WebhookStatus;

  @doc("Number of consecutive delivery failures")
  @minValue(0)
  failureCount: int32;

  @doc("UTC timestamp of the most recent delivery attempt")
  lastDeliveryAt?: utcDateTime;

  @doc("HTTP status code or error description from the last delivery")
  lastDeliveryStatus?: string;
}

@doc("A record of a single webhook payload delivery attempt")
model WebhookDelivery extends BaseEntity {
  @doc("Tenant this delivery belongs to")
  organizationId: string;

  @doc("Parent subscription")
  subscriptionId: string;

  @doc("Event topic name that triggered this delivery")
  eventType: string;

  @doc("Full event payload that was (or will be) sent")
  payload: Record<unknown>;

  @doc("UTC timestamp when the delivery was attempted")
  deliveredAt: utcDateTime;

  @doc("HTTP response status code received from the target")
  responseCode?: int32;

  @doc("Round-trip time in milliseconds")
  @minValue(0)
  responseTime?: int32;

  @doc("Current delivery status")
  status: WebhookDeliveryStatus;

  @doc("Number of delivery attempts so far")
  @minValue(0)
  retryCount: int32;

  @doc("UTC timestamp of the next scheduled retry attempt")
  nextRetryAt?: utcDateTime;
}

@doc("A registered event topic that subscriptions can listen to")
model EventTopic extends BaseEntity {
  @doc("Tenant this topic belongs to")
  organizationId: string;

  @doc("Unique topic name (e.g., 'member.created', 'event.published')")
  @minLength(1)
  @maxLength(200)
  name: string;

  @doc("Human-readable description of when this event fires")
  description?: string;

  @doc("Classification category (e.g., 'member', 'event', 'billing')")
  @minLength(1)
  @maxLength(100)
  category: string;

  @doc("JSON Schema definition of the payload structure")
  payloadSchema?: string;

  @doc("Whether this topic is currently available for new subscriptions")
  active: boolean;
}

@doc("An external system connector configuration")
model Connector extends BaseEntity {
  @doc("Tenant this connector belongs to")
  organizationId: string;

  @doc("Human-readable connector name")
  @minLength(1)
  @maxLength(255)
  name: string;

  @doc("Category of external system")
  type: ConnectorType;

  @doc("Current operational status")
  status: ConnectorStatus;

  @doc("Base endpoint URL for the external system")
  @format("uri")
  endpoint?: string;

  @doc("Authentication method used to communicate with the external system")
  authMethod: ConnectorAuthMethod;

  @doc("UTC timestamp of the most recent health check")
  lastHealthCheck?: utcDateTime;

  @doc("Result of the most recent health check")
  healthStatus?: ConnectorHealthStatus;
}

@doc("A credential record for a connector (secrets are never returned in responses)")
model ConnectorCredential extends BaseEntity {
  @doc("Tenant this credential belongs to")
  organizationId: string;

  @doc("Parent connector")
  connectorId: string;

  @doc("Credential type or purpose (e.g., 'clientSecret', 'apiKey', 'privateKey')")
  @minLength(1)
  @maxLength(100)
  credentialType: string;

  @doc("UTC timestamp when the credential expires")
  expiresAt?: utcDateTime;

  @doc("UTC timestamp when the credential was last rotated")
  rotatedAt?: utcDateTime;
}

// ---------------------------------------------------------------------------
// Request / Response Models
// ---------------------------------------------------------------------------

@doc("Request body for creating a webhook subscription")
model WebhookSubscriptionCreateRequest {
  @doc("Subscription name")
  @minLength(1)
  @maxLength(255)
  name: string;

  @doc("Target HTTPS endpoint URL")
  @format("uri")
  targetUrl: string;

  @doc("Event topic names to subscribe to")
  events: string[];

  @doc("Optional HMAC signing secret (server-generated if omitted)")
  secret?: string;
}

@doc("Request body for updating a webhook subscription")
model WebhookSubscriptionUpdateRequest {
  @doc("Subscription name")
  @minLength(1)
  @maxLength(255)
  name?: string;

  @doc("Target HTTPS endpoint URL")
  @format("uri")
  targetUrl?: string;

  @doc("Updated event topic list")
  events?: string[];

  @doc("Subscription status")
  status?: WebhookStatus;
}

@doc("Query parameters for webhook subscription search")
model WebhookSubscriptionSearchParams {
  ...PaginationQuery;

  @doc("Filter by subscription status")
  @query
  status?: WebhookStatus;

  @doc("Filter by subscribed event topic")
  @query
  eventType?: string;
}

@doc("Response returned after testing a webhook subscription")
model WebhookTestResult {
  @doc("Whether the test delivery was successful")
  success: boolean;

  @doc("HTTP status code returned by the target")
  responseCode?: int32;

  @doc("Round-trip time in milliseconds")
  @minValue(0)
  responseTime?: int32;

  @doc("Error message if the test failed")
  error?: string;
}

@doc("Response returned after rotating a webhook secret")
model WebhookSecretRotationResult {
  @doc("The newly generated signing secret — returned only once")
  newSecret: string;

  @doc("UTC timestamp when the rotation occurred")
  rotatedAt: utcDateTime;
}

@doc("Query parameters for webhook delivery search")
model WebhookDeliverySearchParams {
  ...PaginationQuery;

  @doc("Filter by subscription")
  @query
  subscriptionId?: string;

  @doc("Filter by event type")
  @query
  eventType?: string;

  @doc("Filter by delivery status")
  @query
  status?: WebhookDeliveryStatus;
}

@doc("Request body for creating a connector")
model ConnectorCreateRequest {
  @doc("Connector name")
  @minLength(1)
  @maxLength(255)
  name: string;

  @doc("System category")
  type: ConnectorType;

  @doc("Base endpoint URL")
  endpoint?: string;

  @doc("Authentication method")
  authMethod: ConnectorAuthMethod;
}

@doc("Query parameters for connector search")
model ConnectorSearchParams {
  ...PaginationQuery;

  @doc("Filter by connector type")
  @query
  type?: ConnectorType;

  @doc("Filter by operational status")
  @query
  status?: ConnectorStatus;
}

@doc("Response from a connector health check")
model ConnectorHealthResult {
  @doc("Connector identifier")
  connectorId: string;

  @doc("Health check result")
  healthStatus: ConnectorHealthStatus;

  @doc("UTC timestamp when the check was performed")
  checkedAt: utcDateTime;

  @doc("Round-trip latency in milliseconds")
  @minValue(0)
  latencyMs?: int32;

  @doc("Diagnostic message from the health check")
  message?: string;
}

@doc("Response from a connector connectivity test")
model ConnectorTestResult {
  @doc("Whether the connectivity test passed")
  success: boolean;

  @doc("Test result message")
  message: string;

  @doc("UTC timestamp when the test was performed")
  testedAt: utcDateTime;
}

@doc("Request body for creating a connector credential")
model ConnectorCredentialCreateRequest {
  @doc("Parent connector")
  connectorId: string;

  @doc("Credential type")
  @minLength(1)
  @maxLength(100)
  credentialType: string;

  @doc("Secret value — stored encrypted, never returned after creation")
  secretValue: string;

  @doc("UTC expiry timestamp")
  expiresAt?: utcDateTime;
}

@doc("Request body for rotating a connector credential")
model ConnectorCredentialRotateRequest {
  @doc("New secret value — stored encrypted, never returned after rotation")
  newSecretValue: string;

  @doc("Updated expiry timestamp")
  expiresAt?: utcDateTime;
}

@doc("Acknowledgement returned after creating or rotating a credential")
model ConnectorCredentialAck {
  @doc("Credential record identifier")
  credentialId: string;

  @doc("UTC timestamp of the creation or rotation")
  timestamp: utcDateTime;

  @doc("Credential type")
  credentialType: string;

  @doc("UTC expiry timestamp")
  expiresAt?: utcDateTime;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@route("/association/integration/webhooks")
@tag("Association:Integration")
namespace Association.Integration.Webhooks {

  /**
   * Webhook subscription management.
   */
  @useAuth(bearerAuth)
  interface WebhookSubscriptionManagement {
    @doc("Create a new webhook subscription.")
    @operationId("createWebhookSubscription")
    @post
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createWebhookSubscription(
      @body body: WebhookSubscriptionCreateRequest
    ): ApiCreatedResponse<WebhookSubscription>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("Get a webhook subscription by ID.")
    @operationId("getWebhookSubscription")
    @get
    @route("/{subscriptionId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    getWebhookSubscription(
      @path subscriptionId: string
    ): ApiOkResponse<WebhookSubscription>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a webhook subscription.")
    @operationId("updateWebhookSubscription")
    @patch(#{implicitOptionality: true})
    @route("/{subscriptionId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateWebhookSubscription(
      @path subscriptionId: string,
      @body updates: WebhookSubscriptionUpdateRequest
    ): ApiOkResponse<WebhookSubscription>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a webhook subscription.")
    @operationId("deleteWebhookSubscription")
    @delete
    @route("/{subscriptionId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteWebhookSubscription(
      @path subscriptionId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search webhook subscriptions with filtering and pagination.")
    @operationId("searchWebhookSubscriptions")
    @get
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    searchWebhookSubscriptions(
      ...WebhookSubscriptionSearchParams
    ): ApiOkResponse<PaginatedResponse<WebhookSubscription>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Send a test event payload to the subscription endpoint.")
    @operationId("testWebhookSubscription")
    @post
    @route("/{subscriptionId}/test")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    testWebhookSubscription(
      @path subscriptionId: string
    ): ApiOkResponse<WebhookTestResult>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Rotate the HMAC signing secret for a subscription. The new secret is returned only once.")
    @operationId("rotateWebhookSecret")
    @post
    @route("/{subscriptionId}/rotate-secret")
    @extension("x-security-required-roles", #["association:admin"])
    rotateWebhookSecret(
      @path subscriptionId: string
    ): ApiOkResponse<WebhookSecretRotationResult>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }

  /**
   * Webhook delivery history and retry management.
   */
  @useAuth(bearerAuth)
  interface WebhookDeliveryService {
    @doc("Search webhook delivery records with filtering and pagination.")
    @operationId("searchWebhookDeliveries")
    @get
    @route("/deliveries")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    searchWebhookDeliveries(
      ...WebhookDeliverySearchParams
    ): ApiOkResponse<PaginatedResponse<WebhookDelivery>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Manually retry a failed webhook delivery.")
    @operationId("retryWebhookDelivery")
    @post
    @route("/deliveries/{deliveryId}/retry")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    retryWebhookDelivery(
      @path deliveryId: string
    ): ApiOkResponse<WebhookDelivery>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;
  }

  /**
   * Event topic registry — read-only for most consumers.
   */
  @useAuth(bearerAuth)
  interface EventTopicManagement {
    @doc("List all registered event topics available for webhook subscriptions.")
    @operationId("listEventTopics")
    @get
    @route("/topics")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    listEventTopics(
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<EventTopic>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}

@route("/association/integration/connectors")
@tag("Association:Integration")
namespace Association.Integration.Connectors {

  /**
   * External system connector management.
   */
  @useAuth(bearerAuth)
  interface ConnectorManagement {
    @doc("Create a new connector.")
    @operationId("createConnector")
    @post
    @extension("x-security-required-roles", #["association:admin"])
    createConnector(
      @body body: ConnectorCreateRequest
    ): ApiCreatedResponse<Connector>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a connector by ID.")
    @operationId("getConnector")
    @get
    @route("/{connectorId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    getConnector(
      @path connectorId: string
    ): ApiOkResponse<Connector>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a connector configuration.")
    @operationId("updateConnector")
    @patch(#{implicitOptionality: true})
    @route("/{connectorId}")
    @extension("x-security-required-roles", #["association:admin"])
    updateConnector(
      @path connectorId: string,
      @body updates: Record<unknown>
    ): ApiOkResponse<Connector>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete a connector.")
    @operationId("deleteConnector")
    @delete
    @route("/{connectorId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteConnector(
      @path connectorId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search connectors with filtering and pagination.")
    @operationId("searchConnectors")
    @get
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    searchConnectors(
      ...ConnectorSearchParams
    ): ApiOkResponse<PaginatedResponse<Connector>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Run a connectivity test against the connector's endpoint.")
    @operationId("testConnector")
    @post
    @route("/{connectorId}/test")
    @extension("x-security-required-roles", #["association:admin"])
    testConnector(
      @path connectorId: string
    ): ApiOkResponse<ConnectorTestResult>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Retrieve the latest health status for a connector.")
    @operationId("getConnectorHealth")
    @get
    @route("/{connectorId}/health")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    getConnectorHealth(
      @path connectorId: string
    ): ApiOkResponse<ConnectorHealthResult>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }

  /**
   * Connector credential management.
   * Secrets are accepted on write but NEVER returned on read.
   */
  @useAuth(bearerAuth)
  interface ConnectorCredentialManagement {
    @doc("Store a new credential for a connector. The secret is encrypted at rest and never returned in subsequent reads.")
    @operationId("createConnectorCredential")
    @post
    @route("/{connectorId}/credentials")
    @extension("x-security-required-roles", #["association:admin"])
    createConnectorCredential(
      @path connectorId: string,
      @body body: ConnectorCredentialCreateRequest
    ): ApiCreatedResponse<ConnectorCredentialAck>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Rotate an existing connector credential. The new secret is stored encrypted and never returned in subsequent reads.")
    @operationId("rotateConnectorCredential")
    @post
    @route("/{connectorId}/credentials/{credentialId}/rotate")
    @extension("x-security-required-roles", #["association:admin"])
    rotateConnectorCredential(
      @path connectorId: string,
      @path credentialId: string,
      @body body: ConnectorCredentialRotateRequest
    ): ApiOkResponse<ConnectorCredentialAck>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }
}
