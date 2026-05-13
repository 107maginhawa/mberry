import "@typespec/http";
import "@typespec/openapi";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Feature flags endpoint.
 * Returns deployment-level feature flags parsed from FF_* environment variables.
 * No secrets exposed — flags are boolean deployment toggles, not user-level.
 */
namespace FeatureFlagsModule {
  interface FeatureFlagManagement {
    @doc("List all active feature flags")
    @operationId("listFeatureFlags")
    @get
    @route("/feature-flags")
    listFeatureFlags(): {
      @statusCode statusCode: 200;
      @body body: Record<boolean>;
    };
  }
}
