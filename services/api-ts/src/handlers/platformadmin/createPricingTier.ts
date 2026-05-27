/**
 * createPricingTier
 *
 * Path: POST /admin/pricing
 * Creates a new pricing tier.
 * Platform admin only.
 */

import type { Context } from "hono";
import type { DatabaseInstance } from "@/core/database";
import { ValidationError } from "@/core/errors";
import { pricingTiers } from "./repos/platform-admin.schema";

export async function createPricingTier(ctx: Context): Promise<Response> {
	const session = ctx.get("session");
	if (!session) return ctx.json({ error: "Unauthorized" }, 401);

	const admin = ctx.get("platformAdmin");
	if (!admin) return ctx.json({ error: "Platform admin access required" }, 403);

	const db = ctx.get("database") as DatabaseInstance;
	const logger = ctx.get("logger");

	const body = await ctx.req.json();
	const {
		name,
		slug,
		monthlyPrice,
		annualPrice,
		currency,
		maxMembers,
		trialDays,
		features,
		isActive,
		sortOrder,
	} = body;

	if (!name || typeof name !== "string") {
		throw new ValidationError("name is required");
	}
	if (!slug || typeof slug !== "string") {
		throw new ValidationError("slug is required");
	}
	if (typeof monthlyPrice !== "number" || monthlyPrice < 0) {
		throw new ValidationError(
			"monthlyPrice must be a non-negative number (in cents)",
		);
	}
	if (typeof annualPrice !== "number" || annualPrice < 0) {
		throw new ValidationError(
			"annualPrice must be a non-negative number (in cents)",
		);
	}

	const [tier] = await db
		.insert(pricingTiers)
		.values({
			name: name.trim(),
			slug: slug.trim().toLowerCase(),
			monthlyPrice,
			annualPrice,
			currency: currency ?? "PHP",
			maxMembers: maxMembers ?? null,
			trialDays: trialDays ?? 30,
			features: features ?? [],
			isActive: isActive ?? true,
			sortOrder: sortOrder ?? 0,
			createdBy: admin.userId,
			updatedBy: admin.userId,
		})
		.returning();

	if (!tier) {
		logger.error("Failed to insert pricing tier");
		return ctx.json({ error: "Failed to create pricing tier" }, 500);
	}

	logger.info({ tierId: tier.id, slug: tier.slug }, "Pricing tier created");

	return ctx.json({ data: tier }, 201);
}
