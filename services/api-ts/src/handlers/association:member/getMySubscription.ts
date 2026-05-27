/**
 * getMySubscription
 *
 * Path: GET /association/member/org/:organizationId/subscription
 * Returns the org's current subscription with tier details and daysRemaining.
 * Officer access required.
 */

import { eq } from "drizzle-orm";
import type { Context } from "hono";
import type { DatabaseInstance } from "@/core/database";
import { UnauthorizedError } from "@/core/errors";
import {
	pricingTiers,
	subscriptions,
} from "@/handlers/platformadmin/repos/platform-admin.schema";
import type { Variables } from "@/types/app";
import { requireOfficerTerm } from "@/utils/officer-check";

export async function getMySubscription(
	ctx: Context<{ Variables: Variables }>,
): Promise<Response> {
	const session = ctx.get("session");
	if (!session) throw new UnauthorizedError();

	const orgId = ctx.req.param("organizationId");
	if (!orgId) return ctx.json({ error: "organizationId is required" }, 400);

	ctx.set("organizationId", orgId);
	const denied = await requireOfficerTerm(ctx);
	if (denied) return denied;

	const db = ctx.get("database") as DatabaseInstance;

	const [row] = await db
		.select({
			id: subscriptions.id,
			organizationId: subscriptions.organizationId,
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
			createdAt: subscriptions.createdAt,
		})
		.from(subscriptions)
		.leftJoin(pricingTiers, eq(subscriptions.pricingTierId, pricingTiers.id))
		.where(eq(subscriptions.organizationId, orgId))
		.limit(1);

	if (!row) {
		return ctx.json({ data: null }, 200);
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
