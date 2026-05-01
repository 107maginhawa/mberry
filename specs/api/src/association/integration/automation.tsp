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
 * Domains 56-57: Workflow Automation & AI Agent Tasks
 *
 * Covers rule-based automation (trigger → condition → action), execution
 * history, AI agent task dispatch with configurable human review gates,
 * and a structured human-in-the-loop review workflow for AI outputs.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Built-in action types available to automation rules")
enum AutoActionType {
  @doc("Create a task in the task management system")
  createTask: "create_task",

  @doc("Send an in-app or push notification")
  sendNotification: "send_notification",

  @doc("Send a transactional email")
  sendEmail: "send_email",

  @doc("Update a field value on a record")
  updateField: "update_field",

  @doc("Call an outbound webhook")
  callWebhook: "call_webhook",

  @doc("Add a person or record to a processing queue")
  addToQueue: "add_to_queue",

  @doc("Award CE credit to a member")
  awardCredit: "award_credit",
}

@doc("Execution status of an automation rule run")
enum AutomationExecutionStatus {
  @doc("Execution is queued and waiting to be picked up")
  pending: "pending",

  @doc("Execution is currently running")
  running: "running",

  @doc("All actions completed successfully")
  completed: "completed",

  @doc("Execution terminated due to an error")
  failed: "failed",

  @doc("Execution was skipped because a condition was not met")
  skipped: "skipped",
}

@doc("Type of operation an AI agent performs")
enum AIAgentType {
  @doc("Summarise text or structured data")
  summarize: "summarize",

  @doc("Classify records or content into categories")
  classify: "classify",

  @doc("Generate recommendations for a person or context")
  recommend: "recommend",

  @doc("Extract structured data from unstructured input")
  extract: "extract",

  @doc("Translate content to a target language")
  translate: "translate",

  @doc("Generate content based on a prompt or template")
  generate: "generate",
}

@doc("Status of an AI agent task")
enum AIAgentTaskStatus {
  @doc("Task is queued and waiting for an available model worker")
  queued: "queued",

  @doc("Model is currently processing the task")
  running: "running",

  @doc("Task completed and output is available")
  completed: "completed",

  @doc("Task failed due to a model or infrastructure error")
  failed: "failed",

  @doc("Task output requires human review before it can be used")
  humanReviewRequired: "human_review_required",
}

@doc("Decision outcome of a human review gate")
enum ReviewDecision {
  @doc("Reviewer approved the AI output as-is")
  approve: "approve",

  @doc("Reviewer approved a modified version of the AI output")
  modify: "modify",

  @doc("Reviewer rejected the AI output entirely")
  reject: "reject",
}

// ---------------------------------------------------------------------------
// Value Objects
// ---------------------------------------------------------------------------

@doc("A single condition evaluated before an automation action fires")
model AutoCondition {
  @doc("Data field path to evaluate (e.g., 'membership.status', 'person.state')")
  @minLength(1)
  @maxLength(200)
  field: string;

  @doc("Comparison operator (e.g., 'eq', 'neq', 'gt', 'lt', 'contains', 'in', 'isNull')")
  @minLength(1)
  @maxLength(50)
  operator: string;

  @doc("Comparison value serialised as a string")
  @maxLength(500)
  value: string;
}

@doc("A single action executed when a rule's conditions are met")
model AutoAction {
  @doc("Built-in action type to execute")
  type: AutoActionType;

  @doc("Action-specific configuration parameters")
  configuration: Record<unknown>;

  @doc("Number of minutes to wait before executing this action (0 = immediate)")
  @minValue(0)
  delayMinutes?: int32;
}

// ---------------------------------------------------------------------------
// Domain Models
// ---------------------------------------------------------------------------

@doc("An event-driven automation rule that evaluates conditions and executes actions")
model AutomationRule extends BaseEntity {
  @doc("Tenant this rule belongs to")
  tenantId: string;

  @doc("Human-readable rule name")
  @minLength(1)
  @maxLength(255)
  name: string;

  @doc("Event topic name that triggers this rule (e.g., 'member.created')")
  @minLength(1)
  @maxLength(200)
  triggerEvent: string;

  @doc("Conditions that must all be true for actions to fire")
  conditions: AutoCondition[];

  @doc("Ordered list of actions to execute when conditions pass")
  actions: AutoAction[];

  @doc("Whether this rule is active and will fire on matching events")
  enabled: boolean;

  @doc("Execution priority — lower number = higher priority (1 = highest)")
  @minValue(1)
  priority: int32;

  @doc("Maximum number of chained rule executions allowed before breaking the cycle (default 3)")
  @minValue(1)
  @maxValue(10)
  maxChainDepth: int32;

  @doc("Person or system identifier that created this rule")
  ruleCreatedBy: string;
}

@doc("A record of a single automation rule execution")
model AutomationExecution extends BaseEntity {
  @doc("Tenant this execution belongs to")
  tenantId: string;

  @doc("Automation rule that was executed")
  ruleId: string;

  @doc("Identifier of the event that triggered this execution")
  triggerEventId: string;

  @doc("Execution outcome status")
  status: AutomationExecutionStatus;

  @doc("UTC timestamp when execution started")
  startedAt: utcDateTime;

  @doc("UTC timestamp when execution finished")
  completedAt?: utcDateTime;

  @doc("Number of actions that were executed")
  @minValue(0)
  actionsExecuted: int32;

  @doc("Depth within a chain of triggered executions (0 = directly triggered)")
  @minValue(0)
  chainDepth: int32;

  @doc("Error message if the execution failed")
  error?: string;
}

@doc("An AI agent task dispatched for asynchronous model processing")
model AIAgentTask extends BaseEntity {
  @doc("Tenant this task belongs to")
  tenantId: string;

  @doc("Type of AI operation to perform")
  agentType: AIAgentType;

  @doc("Input payload for the model (structure depends on agentType)")
  input: Record<unknown>;

  @doc("Model output (available when status is completed or humanReviewRequired)")
  output?: Record<unknown>;

  @doc("Current task status")
  status: AIAgentTaskStatus;

  @doc("Model confidence score (0.0 to 1.0) — populated after completion")
  @minValue(0)
  @maxValue(1)
  confidence?: float64;

  @doc("Name of the AI model used (e.g., 'claude-3-opus')")
  @maxLength(100)
  modelName?: string;

  @doc("Version of the AI model used")
  @maxLength(50)
  modelVersion?: string;

  @doc("UTC timestamp when model processing started")
  startedAt?: utcDateTime;

  @doc("UTC timestamp when model processing completed")
  completedAt?: utcDateTime;

  @doc("Identifier of the reviewer who actioned this task")
  reviewedBy?: string;

  @doc("Outcome of human review (null until reviewed)")
  reviewOutcome?: ReviewDecision;
}

@doc("A human review gate created when an AI task requires manual approval")
model HumanReviewGate extends BaseEntity {
  @doc("Tenant this gate belongs to")
  tenantId: string;

  @doc("AI agent task requiring review")
  agentTaskId: string;

  @doc("Reason why human review was flagged for this task")
  @minLength(1)
  reason: string;

  @doc("Person who reviewed this gate")
  reviewedBy?: string;

  @doc("UTC timestamp when the review was completed")
  reviewedAt?: utcDateTime;

  @doc("Review decision")
  decision?: ReviewDecision;

  @doc("Modifications made by the reviewer to the AI output (populated when decision is 'modify')")
  modifications?: Record<unknown>;
}

// ---------------------------------------------------------------------------
// Request / Response Models
// ---------------------------------------------------------------------------

@doc("Request body for creating an automation rule")
model AutomationRuleCreateRequest {
  @doc("Rule name")
  @minLength(1)
  @maxLength(255)
  name: string;

  @doc("Trigger event topic name")
  @minLength(1)
  @maxLength(200)
  triggerEvent: string;

  @doc("Evaluation conditions")
  conditions: AutoCondition[];

  @doc("Actions to execute")
  actions: AutoAction[];

  @doc("Whether the rule is enabled on creation")
  enabled: boolean;

  @doc("Execution priority")
  @minValue(1)
  priority: int32;

  @doc("Maximum chain depth (default 3)")
  @minValue(1)
  @maxValue(10)
  maxChainDepth: int32;
}

@doc("Request body for updating an automation rule")
model AutomationRuleUpdateRequest {
  @doc("Rule name")
  @minLength(1)
  @maxLength(255)
  name?: string;

  @doc("Evaluation conditions")
  conditions?: AutoCondition[];

  @doc("Actions to execute")
  actions?: AutoAction[];

  @doc("Execution priority")
  @minValue(1)
  priority?: int32;

  @doc("Maximum chain depth")
  @minValue(1)
  @maxValue(10)
  maxChainDepth?: int32;
}

@doc("Query parameters for automation rule search")
model AutomationRuleSearchParams {
  ...PaginationQuery;

  @doc("Filter by trigger event topic")
  @query
  triggerEvent?: string;

  @doc("Filter by enabled state")
  @query
  enabled?: boolean;
}

@doc("Result of a dry-run automation rule test")
model AutomationRuleTestResult {
  @doc("Whether all conditions would have passed with the provided sample event")
  conditionsPassed: boolean;

  @doc("List of condition evaluation details")
  conditionResults: AutoConditionResult[];

  @doc("List of actions that would have been executed")
  actionsToExecute: AutoAction[];

  @doc("Simulated execution timestamp")
  simulatedAt: utcDateTime;
}

@doc("Detailed result of a single condition evaluation")
model AutoConditionResult {
  @doc("The condition that was evaluated")
  condition: AutoCondition;

  @doc("Whether this specific condition passed")
  passed: boolean;

  @doc("The actual field value found during evaluation")
  actualValue?: string;
}

@doc("Query parameters for automation execution search")
model AutomationExecutionSearchParams {
  ...PaginationQuery;

  @doc("Filter by rule")
  @query
  ruleId?: string;

  @doc("Filter by execution status")
  @query
  status?: AutomationExecutionStatus;

  @doc("Filter by trigger event ID")
  @query
  triggerEventId?: string;
}

@doc("Request body for creating an AI agent task")
model AIAgentTaskCreateRequest {
  @doc("Type of AI operation")
  agentType: AIAgentType;

  @doc("Input payload for the model")
  input: Record<unknown>;
}

@doc("Query parameters for AI agent task search")
model AIAgentTaskSearchParams {
  ...PaginationQuery;

  @doc("Filter by agent type")
  @query
  agentType?: AIAgentType;

  @doc("Filter by task status")
  @query
  status?: AIAgentTaskStatus;
}

@doc("Query parameters for human review gate search")
model HumanReviewGateSearchParams {
  ...PaginationQuery;

  @doc("Filter by AI task")
  @query
  agentTaskId?: string;

  @doc("Filter to only unreviewed gates")
  @query
  unreviewed?: boolean;
}

@doc("Request body for submitting a human review decision")
model HumanReviewRequest {
  @doc("Review decision")
  decision: ReviewDecision;

  @doc("Identifier of the reviewer")
  reviewedBy: string;

  @doc("Modifications to the AI output (required when decision is 'modify')")
  modifications?: Record<unknown>;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@route("/association/integration/automation")
@tag("Association:Integration")
namespace Association.Integration.Automation {

  /**
   * Automation rule management.
   */
  @useAuth(bearerAuth)
  interface AutomationRuleManagement {
    @doc("Create a new automation rule.")
    @operationId("createAutomationRule")
    @post
    @route("/rules")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createAutomationRule(
      @body body: AutomationRuleCreateRequest
    ): ApiCreatedResponse<AutomationRule>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get an automation rule by ID.")
    @operationId("getAutomationRule")
    @get
    @route("/rules/{ruleId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    getAutomationRule(
      @path ruleId: string
    ): ApiOkResponse<AutomationRule>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update an automation rule.")
    @operationId("updateAutomationRule")
    @patch(#{implicitOptionality: true})
    @route("/rules/{ruleId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    updateAutomationRule(
      @path ruleId: string,
      @body updates: AutomationRuleUpdateRequest
    ): ApiOkResponse<AutomationRule>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Delete an automation rule.")
    @operationId("deleteAutomationRule")
    @delete
    @route("/rules/{ruleId}")
    @extension("x-security-required-roles", #["association:admin"])
    deleteAutomationRule(
      @path ruleId: string
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Search automation rules with filtering and pagination.")
    @operationId("searchAutomationRules")
    @get
    @route("/rules")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    searchAutomationRules(
      ...AutomationRuleSearchParams
    ): ApiOkResponse<PaginatedResponse<AutomationRule>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Enable an automation rule so it fires on matching events.")
    @operationId("enableAutomationRule")
    @post
    @route("/rules/{ruleId}/enable")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    enableAutomationRule(
      @path ruleId: string
    ): ApiOkResponse<AutomationRule>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;

    @doc("Disable an automation rule so it no longer fires.")
    @operationId("disableAutomationRule")
    @post
    @route("/rules/{ruleId}/disable")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    disableAutomationRule(
      @path ruleId: string
    ): ApiOkResponse<AutomationRule>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;

    @doc("Perform a dry-run test of the rule against a sample event payload.")
    @operationId("testAutomationRule")
    @post
    @route("/rules/{ruleId}/test")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    testAutomationRule(
      @path ruleId: string,
      @body sampleEvent: Record<unknown>
    ): ApiOkResponse<AutomationRuleTestResult>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }

  /**
   * Automation execution history — read-only.
   */
  @useAuth(bearerAuth)
  interface AutomationExecutionService {
    @doc("Search automation execution records with filtering and pagination.")
    @operationId("searchAutomationExecutions")
    @get
    @route("/executions")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    searchAutomationExecutions(
      ...AutomationExecutionSearchParams
    ): ApiOkResponse<PaginatedResponse<AutomationExecution>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a single automation execution record by ID.")
    @operationId("getAutomationExecution")
    @get
    @route("/executions/{executionId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    getAutomationExecution(
      @path executionId: string
    ): ApiOkResponse<AutomationExecution>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }

  /**
   * AI agent task dispatch and status tracking.
   */
  @useAuth(bearerAuth)
  interface AIAgentTaskManagement {
    @doc("Dispatch a new AI agent task for asynchronous processing.")
    @operationId("createAIAgentTask")
    @post
    @route("/ai-tasks")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    createAIAgentTask(
      @body body: AIAgentTaskCreateRequest
    ): ApiCreatedResponse<AIAgentTask>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Search AI agent tasks with filtering and pagination.")
    @operationId("searchAIAgentTasks")
    @get
    @route("/ai-tasks")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    searchAIAgentTasks(
      ...AIAgentTaskSearchParams
    ): ApiOkResponse<PaginatedResponse<AIAgentTask>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get the current status and result of an AI agent task.")
    @operationId("getAIAgentTaskStatus")
    @get
    @route("/ai-tasks/{taskId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff"])
    getAIAgentTaskStatus(
      @path taskId: string
    ): ApiOkResponse<AIAgentTask>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }

  /**
   * Human-in-the-loop review gate management.
   */
  @useAuth(bearerAuth)
  interface HumanReviewGateManagement {
    @doc("Search human review gates with filtering and pagination.")
    @operationId("searchHumanReviewGates")
    @get
    @route("/review-gates")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:reviewer"])
    searchHumanReviewGates(
      ...HumanReviewGateSearchParams
    ): ApiOkResponse<PaginatedResponse<HumanReviewGate>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get a human review gate by ID.")
    @operationId("getHumanReviewGate")
    @get
    @route("/review-gates/{gateId}")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:reviewer"])
    getHumanReviewGate(
      @path gateId: string
    ): ApiOkResponse<HumanReviewGate>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Submit a review decision for an AI task that is pending human review.")
    @operationId("reviewHumanReviewGate")
    @post
    @route("/review-gates/{gateId}/review")
    @extension("x-security-required-roles", #["association:admin", "association:staff", "association:reviewer"])
    reviewHumanReviewGate(
      @path gateId: string,
      @body body: HumanReviewRequest
    ): ApiOkResponse<HumanReviewGate>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;
  }
}
