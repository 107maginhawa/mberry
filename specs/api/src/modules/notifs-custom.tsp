import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Notifications Custom Module
 *
 * Extends the core notifs module with convenience endpoints not generated
 * from the standard CRUD scaffolding.
 */

@doc("Response body returned when all notifications are marked read")
model MarkAllReadResponse {
  @doc("Confirmation that the bulk-read operation succeeded")
  success: boolean;
}

@route("/notifs")
@tag("Notifs")
namespace NotifsCustomModule {
  interface NotifsCustomManagement {
    @doc("Mark all unread notifications for the authenticated user as read in a single bulk operation.")
    @operationId("markAllNotificationsRead")
    @post
    @route("/read-all")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    markAllNotificationsRead(): ApiOkResponse<MarkAllReadResponse>
      | ApiUnauthorizedResponse;
  }
}
