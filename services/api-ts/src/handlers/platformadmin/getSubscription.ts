/**
 * getSubscription
 *
 * Path: GET /admin/subscriptions/:id
 * Returns full subscription details with tier and org info.
 * Platform admin only.
 */

import { eq } from "drizzle-orm";
import type { Context } from "hono";
import type { DatabaseInstance } from "@/core/database";
import {
	organizations,
	pricingTiers,
	subscriptions,
} from "./repos/platform-admin.schema";

export async function getSubscription(ctx: Context): Promise<Response> {
	const session = ctx.get("session");
	if (!session) return ctx.json({ error: "Unauthorized" }, 401);

	const admin = ctx.get("platformAdmin");
	if (!admin) return ctx.json({ error: "Platform admin access required" }, 403);

	const db = ctx.get("database") as DatabaseInstance;
	const id = ctx.req.param("id");

	const [row] = await db
		.select({
			id: subscriptions.id,
			organizationId: subscriptions.organizationId,
			organizationName: organizations.name,
			organizationSlug: organizations.slug,
			organizationContactEmail: organizations.contactEmail,
			pricingTierId: subscriptions.pricingTierId,
			tierName: pricingTiers.name,
			tierSlug: pricingTiers.slug,
			tierMonthlyPrice: pricingTiers.monthlyPrice,
			tierAnnualPrice: pricingTiers.annualPrice,
			tierCurrency: pricingTiers.currency,
			tierMaxMembers: pricingTiers.maxMembers,
			tierFeatures: pricingTiers.features,
			status: subscriptions.status,
			billingCycle: subscriptions.billingCycle,
			currentPeriodStart: subscriptions.currentPeriodStart,
			currentPeriodEnd: subscriptions.currentPeriodEnd,
			trialEndsAt: subscriptions.trialEndsAt,
			cancelledAt: subscriptions.cancelledAt,
			cancelReason: subscriptions.cancelReason,
			stripeSubscriptionId: subscriptions.stripeSubscriptionId,
			stripeCustomerId: subscriptions.stripeCustomerId,
			lastStripeEventId: subscriptions.lastStripeEventId,
			createdAt: subscriptions.createdAt,
			updatedAt: subscriptions.updatedAt,
		})
		.from(subscriptions)
		.leftJoin(pricingTiers, eq(subscriptions.pricingTierId, pricingTiers.id))
		.leftJoin(organizations, eq(subscriptions.organizationId, organizations.id))
		.where(eq(subscriptions.id, id!))
		.limit(1);

	if (!row) {
		return ctx.json({ error: "Subscription not found" }, 404);
	}

	const now = new Date();
	let daysRemaining: number | null = null;
	if (row.currentPeriodEnd) {
		daysRemaining = Math.max(
			0,
			Math.ceil(
				(row.currentPeriodEnd.getTime() - now.getTime()) /
					(1000 * 60 * 60 * 24),
			),
		);
	} else if (row.trialEndsAt) {
		daysRemaining = Math.max(
			0,
			Math.ceil(
				(row.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
			),
		);
	}

	return ctx.json({ data: { ...row, daysRemaining } }, 200);
}
