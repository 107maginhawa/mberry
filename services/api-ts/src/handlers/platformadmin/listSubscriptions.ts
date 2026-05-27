/**
 * listSubscriptions
 *
 * Path: GET /admin/subscriptions
 * Lists all subscriptions with filtering by status and tierId.
 * Includes org name via join and slaStatus computed from currentPeriodEnd.
 * Platform admin only.
 */

import { and, eq, inArray } from "drizzle-orm";
import type { Context } from "hono";
import type { DatabaseInstance } from "@/core/database";
import {
	organizations,
	pricingTiers,
	subscriptions,
} from "./repos/platform-admin.schema";

export async function listSubscriptions(ctx: Context): Promise<Response> {
	const session = ctx.get("session");
	if (!session) return ctx.json({ error: "Unauthorized" }, 401);

	const admin = ctx.get("platformAdmin");
	if (!admin) return ctx.json({ error: "Platform admin access required" }, 403);

	const db = ctx.get("database") as DatabaseInstance;
	const logger = ctx.get("logger");

	const statusFilter = ctx.req.query("status");
	const tierIdFilter = ctx.req.query("tierId");

	const conditions = [];
	if (statusFilter) {
		const validStatuses = [
			"trial",
			"active",
			"past_due",
			"cancelled",
			"expired",
		];
		if (!validStatuses.includes(statusFilter)) {
			return ctx.json(
				{
					error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
				},
				400,
			);
		}
		conditions.push(eq(subscriptions.status, statusFilter as any));
	}
	if (tierIdFilter) {
		conditions.push(eq(subscriptions.pricingTierId, tierIdFilter));
	}

	const rows = await db
		.select({
			id: subscriptions.id,
			organizationId: subscriptions.organizationId,
			organizationName: organizations.name,
			pricingTierId: subscriptions.pricingTierId,
			tierName: pricingTiers.name,
			tierSlug: pricingTiers.slug,
			status: subscriptions.status,
			billingCycle: subscriptions.billingCycle,
			currentPeriodStart: subscriptions.currentPeriodStart,
			currentPeriodEnd: subscriptions.currentPeriodEnd,
			trialEndsAt: subscriptions.trialEndsAt,
			cancelledAt: subscriptions.cancelledAt,
			cancelReason: subscriptions.cancelReason,
			stripeSubscriptionId: subscriptions.stripeSubscriptionId,
			createdAt: subscriptions.createdAt,
			updatedAt: subscriptions.updatedAt,
		})
		.from(subscriptions)
		.leftJoin(pricingTiers, eq(subscriptions.pricingTierId, pricingTiers.id))
		.leftJoin(organizations, eq(subscriptions.organizationId, organizations.id))
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(subscriptions.createdAt);

	const now = new Date();

	const data = rows.map((row) => {
		let slaStatus: "ok" | "expiring_soon" | "expired" = "ok";
		if (row.currentPeriodEnd) {
			const daysUntilExpiry =
				(row.currentPeriodEnd.getTime() - now.getTime()) /
				(1000 * 60 * 60 * 24);
			if (daysUntilExpiry < 0) {
				slaStatus = "expired";
			} else if (daysUntilExpiry <= 7) {
				slaStatus = "expiring_soon";
			}
		}
		return { ...row, slaStatus };
	});

	logger.info(
		{ count: data.length, statusFilter, tierIdFilter },
		"Listed subscriptions",
	);

	return ctx.json({ data }, 200);
}
