import "@typespec/http";
import "@typespec/openapi";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Health check status values
 */
@doc("Health check status")
enum HealthStatus {
  @doc("Service is healthy")
  pass: "pass",

  @doc("Service is unhealthy")
  fail: "fail",
}

/**
 * Verbose health check response (RFC Health Check Response Format)
 */
@doc("Verbose health check response")
model HealthCheckResponse {
  @doc("Overall health status")
  status: HealthStatus;

  @doc("ISO 8601 timestamp")
  timestamp: string;

  @doc("Individual component check results")
  checks: Record<string>;
}

/**
 * Health check endpoints for Kubernetes liveness and readiness probes.
 * Follows RFC Health Check Response Format for verbose mode.
 */
namespace HealthModule {
  interface HealthManagement {
    @doc("Liveness probe — lightweight process-alive check")
    @operationId("liveness")
    @get
    @route("/livez")
    liveness(@query verbose?: string): {
      @statusCode statusCode: 200;
      @body body: HealthCheckResponse;
    };

    @doc("Readiness probe — checks database, storage, and job queue health")
    @operationId("readiness")
    @get
    @route("/readyz")
    readiness(@query verbose?: string): {
      @statusCode statusCode: 200;
      @body body: HealthCheckResponse;
    } | {
      @statusCode statusCode: 503;
      @body body: HealthCheckResponse;
    };
  }
}
