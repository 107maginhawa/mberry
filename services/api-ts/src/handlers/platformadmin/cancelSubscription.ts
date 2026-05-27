/**
 * cancelSubscription
 *
 * Path: PUT /admin/subscriptions/:id/cancel
 * Cancels a subscription (admin-initiated).
 * Platform admin only.
 */

import { eq } from "drizzle-orm";
import type { Context } from "hono";
import type { DatabaseInstance } from "@/core/database";
import { domainEvents } from "@/core/domain-events";
import { ValidationError } from "@/core/errors";
import { subscriptions } from "./repos/platform-admin.schema";

export async function cancelSubscription(ctx: Context): Promise<Response> {
	const session = ctx.get("session");
	if (!session) return ctx.json({ error: "Unauthorized" }, 401);

	const admin = ctx.get("platformAdmin");
	if (!admin) return ctx.json({ error: "Platform admin access required" }, 403);

	const db = ctx.get("database") as DatabaseInstance;
	const logger = ctx.get("logger");
	const id = ctx.req.param("id");

	const [existing] = await db
		.select()
		.from(subscriptions)
		.where(eq(subscriptions.id, id!))
		.limit(1);

	if (!existing) {
		return ctx.json({ error: "Subscription not found" }, 404);
	}

	if (existing.status === "cancelled") {
		return ctx.json({ error: "Subscription is already cancelled" }, 409);
	}

	const body = await ctx.req.json();
	const { reason } = body;

	if (!reason || typeof reason !== "string") {
		throw new ValidationError("reason is required");
	}

	const now = new Date();

	const [updated] = await db
		.update(subscriptions)
		.set({
			status: "cancelled",
			cancelledAt: now,
			cancelReason: reason.trim(),
			updatedAt: now,
			updatedBy: admin.userId,
		})
		.where(eq(subscriptions.id, id!))
		.returning();

	await domainEvents.emit("subscription.cancelled", {
		subscriptionId: id!,
		organizationId: existing.organizationId,
		reason: reason.trim(),
	});

	logger.info(
		{ subscriptionId: id, organizationId: existing.organizationId, reason },
		"Subscription cancelled by admin",
	);

	return ctx.json({ data: updated }, 200);
}
