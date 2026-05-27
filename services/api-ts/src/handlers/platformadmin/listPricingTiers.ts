/**
 * listPricingTiers
 *
 * Path: GET /admin/pricing
 * Returns all pricing tiers with subscriber count.
 * Platform admin only.
 */

import { eq, sql } from "drizzle-orm";
import type { Context } from "hono";
import type { DatabaseInstance } from "@/core/database";
import { pricingTiers, subscriptions } from "./repos/platform-admin.schema";

export async function listPricingTiers(ctx: Context): Promise<Response> {
	const session = ctx.get("session");
	if (!session) return ctx.json({ error: "Unauthorized" }, 401);

	const admin = ctx.get("platformAdmin");
	if (!admin) return ctx.json({ error: "Platform admin access required" }, 403);

	const db = ctx.get("database") as DatabaseInstance;
	const logger = ctx.get("logger");

	const tiers = await db
		.select({
			id: pricingTiers.id,
			name: pricingTiers.name,
			slug: pricingTiers.slug,
			monthlyPrice: pricingTiers.monthlyPrice,
			annualPrice: pricingTiers.annualPrice,
			currency: pricingTiers.currency,
			maxMembers: pricingTiers.maxMembers,
			trialDays: pricingTiers.trialDays,
			features: pricingTiers.features,
			isActive: pricingTiers.isActive,
			sortOrder: pricingTiers.sortOrder,
			createdAt: pricingTiers.createdAt,
			updatedAt: pricingTiers.updatedAt,
			subscriberCount: sql<number>`(
        select count(*)::int from subscription
        where pricing_tier_id = ${pricingTiers.id}
        and status not in ('cancelled', 'expired')
      )`,
		})
		.from(pricingTiers)
		.orderBy(pricingTiers.sortOrder, pricingTiers.name);

	logger.info({ count: tiers.length }, "Listed pricing tiers");

	return ctx.json({ data: tiers }, 200);
}
