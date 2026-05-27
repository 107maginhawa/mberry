/**
 * updatePricingTier
 *
 * Path: PUT /admin/pricing/:tierId
 * Updates an existing pricing tier.
 * Note: price changes (monthlyPrice, annualPrice) only affect NEW subscriptions — existing ones
 * keep their current price until they next upgrade (M3-R8).
 * Platform admin only.
 */

import { eq } from "drizzle-orm";
import type { Context } from "hono";
import type { DatabaseInstance } from "@/core/database";
import { ValidationError } from "@/core/errors";
import { pricingTiers } from "./repos/platform-admin.schema";

export async function updatePricingTier(ctx: Context): Promise<Response> {
	const session = ctx.get("session");
	if (!session) return ctx.json({ error: "Unauthorized" }, 401);

	const admin = ctx.get("platformAdmin");
	if (!admin) return ctx.json({ error: "Platform admin access required" }, 403);

	const db = ctx.get("database") as DatabaseInstance;
	const logger = ctx.get("logger");
	const tierId = ctx.req.param("tierId");

	if (!tierId) {
		throw new ValidationError("tierId is required");
	}

	const [existing] = await db
		.select()
		.from(pricingTiers)
		.where(eq(pricingTiers.id, tierId))
		.limit(1);

	if (!existing) {
		return ctx.json({ error: "Pricing tier not found" }, 404);
	}

	const body = await ctx.req.json();
	const {
		name,
		monthlyPrice,
		annualPrice,
		currency,
		maxMembers,
		trialDays,
		features,
		isActive,
		sortOrder,
	} = body;

	// Build partial update — only provided fields
	const updates: Partial<typeof existing> = {
		updatedAt: new Date(),
		updatedBy: admin.userId,
	};

	if (name !== undefined) updates.name = name;
	if (monthlyPrice !== undefined) updates.monthlyPrice = monthlyPrice;
	if (annualPrice !== undefined) updates.annualPrice = annualPrice;
	if (currency !== undefined) updates.currency = currency;
	if (maxMembers !== undefined) updates.maxMembers = maxMembers;
	if (trialDays !== undefined) updates.trialDays = trialDays;
	if (features !== undefined) updates.features = features;
	if (isActive !== undefined) updates.isActive = isActive;
	if (sortOrder !== undefined) updates.sortOrder = sortOrder;

	const [updated] = await db
		.update(pricingTiers)
		.set(updates)
		.where(eq(pricingTiers.id, tierId))
		.returning();

	logger.info(
		{
			tierId,
			priceChanged: monthlyPrice !== undefined || annualPrice !== undefined,
		},
		"Pricing tier updated — price changes affect new subscriptions only (M3-R8)",
	);

	return ctx.json(
		{
			data: updated,
			note:
				monthlyPrice !== undefined || annualPrice !== undefined
					? "Price changes apply to new subscriptions only. Existing subscriptions retain their current price until they upgrade."
					: undefined,
		},
		200,
	);
}
