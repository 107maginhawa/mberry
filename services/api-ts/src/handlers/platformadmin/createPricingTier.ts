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
import { requireAdminTier, SUPER_ONLY } from "@/core/auth/admin-tier";

export async function createPricingTier(ctx: Context): Promise<Response> {
	const session = ctx.get("session");
	if (!session) return ctx.json({ error: "Unauthorized" }, 401);

	const admin = ctx.get("platformAdmin");
	if (!admin) return ctx.json({ error: "Platform admin access required" }, 403);

	// FIX-008 (G1) / Q1: managing pricing is a super-only mutation.
	const denied = requireAdminTier(ctx, SUPER_ONLY);
	if (denied) return denied;

	const db = ctx.get("database") as DatabaseInstance;
	const baseLogger = ctx.get('logger');
	const traceId = ctx.get('requestId');
	const logger = baseLogger?.child?.({ traceId, module: 'platformadmin' }) ?? baseLogger;

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

	// name presence + type guaranteed by zValidator in app.ts
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

	logger.info({ action: 'createPricingTier.1', tierId: tier.id, slug: tier.slug }, "Pricing tier created");

	return ctx.json({ data: tier }, 201);
}
