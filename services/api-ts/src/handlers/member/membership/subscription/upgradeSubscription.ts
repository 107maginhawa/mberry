/**
 * upgradeSubscription
 *
 * Path: POST /association/member/org/:organizationId/subscription/upgrade
 * Upgrades or changes the subscription tier/billing cycle for an org.
 * Officer access required.
 */

import { eq } from "drizzle-orm";
import type { Context } from "hono";
import type { DatabaseInstance } from "@/core/database";
import { domainEvents } from "@/core/domain-events";
import { UnauthorizedError, ValidationError } from "@/core/errors";
import {
	pricingTiers,
	subscriptions,
} from "@/handlers/platformadmin/repos/platform-admin.schema";
import type { Variables } from "@/types/app";
import { requireOfficerTerm } from "@/core/auth/officer-checks";

export async function upgradeSubscription(
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
	const baseLogger = ctx.get('logger');
	const traceId = ctx.get('requestId');
	const logger = baseLogger?.child?.({ traceId, module: 'association:member' }) ?? baseLogger;
	const user = ctx.get("user")!;

	const body = await ctx.req.json();
	const { tierId, billingCycle } = body;

	if (!tierId || typeof tierId !== "string") {
		throw new ValidationError("tierId is required");
	}

	const validCycles = ["monthly", "annual"];
	if (billingCycle && !validCycles.includes(billingCycle)) {
		throw new ValidationError(
			`billingCycle must be one of: ${validCycles.join(", ")}`,
		);
	}

	// Validate new tier exists and is active
	const [tier] = await db
		.select()
		.from(pricingTiers)
		.where(eq(pricingTiers.id, tierId))
		.limit(1);

	if (!tier) {
		return ctx.json({ error: "Pricing tier not found" }, 404);
	}
	if (!tier.isActive) {
		return ctx.json({ error: "This pricing tier is no longer available" }, 422);
	}

	// Get current subscription
	const [current] = await db
		.select()
		.from(subscriptions)
		.where(eq(subscriptions.organizationId, orgId))
		.limit(1);

	if (!current) {
		return ctx.json(
			{ error: "No active subscription found for this organization" },
			404,
		);
	}

	if (
		current.pricingTierId === tierId &&
		(!billingCycle || current.billingCycle === billingCycle)
	) {
		return ctx.json(
			{ error: "Subscription is already on this tier and billing cycle" },
			409,
		);
	}

	const fromTierId = current.pricingTierId;
	const now = new Date();

	const [updated] = await db
		.update(subscriptions)
		.set({
			pricingTierId: tierId,
			billingCycle: billingCycle ?? current.billingCycle,
			updatedAt: now,
			updatedBy: user.id,
		})
		.where(eq(subscriptions.id, current.id))
		.returning();

	await domainEvents.emit("subscription.upgraded", {
		subscriptionId: current.id,
		organizationId: orgId,
		fromTierId,
		toTierId: tierId,
	});

	logger.info(
		{ action: 'upgradeSubscription.1',
			subscriptionId: current.id,
			orgId,
			fromTierId,
			toTierId: tierId,
			billingCycle,
		},
		"Subscription upgraded",
	);

	return ctx.json({ data: updated }, 200);
}
