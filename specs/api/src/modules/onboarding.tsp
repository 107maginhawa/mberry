import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Onboarding Module (m01 auth-onboarding)
 *
 * Resumable setup wizard for newly-provisioned organizations. An officer
 * walks through 5 steps (profile, import, dues, gateway, invite). Progress
 * is persisted org-scoped so the wizard can be resumed across sessions.
 *
 * Endpoints:
 *   GET /onboarding/state  — fetch current wizard progress for an org
 *   PUT /onboarding/step   — save progress for a step (advances the wizard)
 *
 * Auth: requires authentication + active officer term in the target org
 * (enforced in-handler via requireOfficerTerm, since org context middleware
 * assigns role='member' to all users).
 */

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

@doc("Resumable onboarding wizard state for an organization")
model OnboardingStateResponse {
  @doc("Onboarding state record ID")
  id: UUID;

  @doc("Organization this onboarding belongs to")
  organizationId: UUID;

  @doc("Current wizard step (1-5)")
  @minValue(1)
  @maxValue(5)
  currentStep: int32;

  @doc("Step numbers already completed")
  stepsCompleted: int32[];

  @doc("When the wizard was completed (null while in progress)")
  completedAt: utcDateTime | null;
}

@doc("Request body for saving onboarding step progress")
model UpdateOnboardingStepRequest {
  @doc("Organization ID the wizard belongs to")
  orgId: UUID;

  @doc("Step being saved (1-5). Must be the current step (no skipping ahead).")
  @minValue(1)
  @maxValue(5)
  step: int32;

  @doc("Arbitrary step payload persisted by the client")
  data: Record<unknown>;
}

@doc("Response after saving onboarding step progress")
model UpdateOnboardingStepResponse {
  @doc("Whether the step was saved")
  saved: boolean;

  @doc("Current wizard step after saving")
  currentStep: int32;

  @doc("Step numbers completed after saving")
  stepsCompleted: int32[];
}

// ---------------------------------------------------------------------------
// 422 Unprocessable response (step out of order — error code M01-004)
// ---------------------------------------------------------------------------

@doc("Unprocessable entity — request well-formed but semantically invalid (e.g. onboarding step out of order)")
model ApiUnprocessableResponse {
  @statusCode statusCode: 422;

  @doc("Business rule violation details")
  @body body: ValidationError;
}

// ---------------------------------------------------------------------------
// Namespace / Interface
// ---------------------------------------------------------------------------

namespace OnboardingModule {

  @doc("Officer-facing onboarding wizard endpoints (auth + officer org access)")
  interface OnboardingManagement {

    @doc("Fetch the current onboarding wizard state for an organization. Returns 404 if the wizard has not been started.")
    @operationId("getOnboardingState")
    @get
    @route("/onboarding/state")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    getOnboardingState(
      @doc("Organization to fetch onboarding state for")
      @query orgId: UUID,
    ): ApiOkResponse<OnboardingStateResponse>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Save progress for an onboarding step. Steps must be completed in order; saving the final step marks onboarding complete and emits OnboardingCompleted.")
    @operationId("updateOnboardingStep")
    @put
    @route("/onboarding/step")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    updateOnboardingStep(
      @body body: UpdateOnboardingStepRequest,
    ): ApiOkResponse<UpdateOnboardingStepResponse>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiUnprocessableResponse;
  }
}
