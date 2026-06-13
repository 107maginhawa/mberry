/**
 * createSubscription
 *
 * Path: POST /admin/subscriptions
 * Creates a platform subscription for an organisation (admin-initiated).
 * Platform admin, super-only (mirrors createPricingTier / cancelSubscription).
 *
 * Platform fee model (founder-decided, UJ-M03): the org pays the platform a
 * flat band price for a tier that covers up to `maxMembers` members. There is
 * NO Stripe application_fee / Connect skim on member dues.
 *
 * Behaviour:
 *   - One subscription per org (unique index). If one already exists -> 409.
 *   - Member-count -> tier validation: the chosen tier's maxMembers must cover
 *     the org's current active member count (null = unlimited). Else 422.
 *   - If no tierId supplied, picks the cheapest active tier that fits; if none
 *     fits, requires an explicit tierId (422).
 *   - Wires a Stripe subscriptions.create call (behind the billing client) to
 *     populate stripeSubscriptionId. The Stripe boundary is injectable so unit
 *     tests can stub it. When Stripe is not configured the row is still
 *     persisted with stripeSubscriptionId null.
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Context } from "hono";
import Stripe from "stripe";
import type { DatabaseInstance } from "@/core/database";
import { domainEvents } from "@/core/domain-events";
import { ValidationError } from "@/core/errors";
import { memberships } from "@/handlers/association:member/repos/membership.schema";
import {
	organizations,
	pricingTiers,
	subscriptions,
} from "./repos/platform-admin.schema";
import { requireAdminTier, SUPER_ONLY } from "@/core/auth/admin-tier";
import { pickCheapestCoveringTier, tierFitsMemberCount } from "./utils/tier-fit";

const VALID_CYCLES = ["monthly", "annual"] as const;
type BillingCycle = (typeof VALID_CYCLES)[number];

/** Member statuses that count toward an org's billable headroom. */
const BILLABLE_STATUSES = ["active", "gracePeriod"] as const;

/**
 * Result of provisioning the subscription at Stripe. `stripeSubscriptionId` is
 * null when Stripe is not configured (the row is still created locally).
 */
export interface StripeProvisionResult {
	stripeSubscriptionId: string | null;
	stripeCustomerId: string | null;
}

/**
 * Provision a Stripe customer + subscription for the org's chosen tier.
 * Extracted + exported so unit tests can stub the Stripe boundary
 * (Mock-Classification: APPROPRIATE — external payment gateway).
 *
 * Returns nulls when Stripe is not configured — the local row is the source of
 * truth and the webhook path will reconcile if Stripe is wired later.
 */
export async function provisionStripeSubscription(args: {
	billing: unknown;
	org: { id: string; name: string; contactEmail: string | null };
	tier: { id: string; slug: string; name: string; currency: string; monthlyPrice: number; annualPrice: number };
	cycle: BillingCycle;
	existingStripeCustomerId?: string | null;
	logger?: { info?: (...a: unknown[]) => void };
}): Promise<StripeProvisionResult> {
	const { org, tier, cycle } = args;

	const billingInternal = args.billing as {
		config?: { secretKey?: string; url?: string };
	} | null;
	const billingConfig = billingInternal?.config;
	if (!billingConfig?.secretKey) {
		// Stripe not configured (e.g. local/test). Persist row without Stripe id.
		return { stripeSubscriptionId: null, stripeCustomerId: args.existingStripeCustomerId ?? null };
	}

	const stripeOptions: Stripe.StripeConfig = {
		apiVersion: "2025-10-29.clover" as Stripe.LatestApiVersion,
		typescript: true,
		timeout: 10000,
	};
	if (billingConfig.url) {
		const url = new URL(billingConfig.url);
		stripeOptions.host = url.hostname;
		stripeOptions.port = url.port || (url.protocol === "https:" ? "443" : "80");
		stripeOptions.protocol = url.protocol.replace(":", "") as "http" | "https";
	}

	const stripeClient = new Stripe(billingConfig.secretKey, stripeOptions);

	let stripeCustomerId = args.existingStripeCustomerId ?? null;
	if (!stripeCustomerId) {
		const customer = await stripeClient.customers.create({
			name: org.name,
			email: org.contactEmail ?? undefined,
			metadata: { organizationId: org.id, platform: "memberry" },
		});
		stripeCustomerId = customer.id;
	}

	const priceAmount = cycle === "annual" ? tier.annualPrice : tier.monthlyPrice;
	const interval = cycle === "annual" ? "year" : "month";

	const stripeSub = await stripeClient.subscriptions.create({
		customer: stripeCustomerId,
		items: [
			{
				price_data: {
					currency: tier.currency.toLowerCase(),
					recurring: { interval },
					unit_amount: priceAmount,
					product_data: { name: tier.name },
				} as unknown as Stripe.SubscriptionCreateParams.Item["price_data"],
			},
		],
		metadata: { organizationId: org.id, tierId: tier.id, tierSlug: tier.slug, billingCycle: cycle },
	});

	args.logger?.info?.(
		{ action: "createSubscription.stripe", stripeSubscriptionId: stripeSub.id, orgId: org.id },
		"Stripe subscription created",
	);

	return { stripeSubscriptionId: stripeSub.id, stripeCustomerId };
}

/**
 * Indirection object so the Stripe boundary is swappable in unit tests via
 * `spyOn(stripeBoundary, 'provision')`. The handler always calls through this
 * reference (Mock-Classification: APPROPRIATE — external gateway).
 */
export const stripeBoundary = {
	provision: provisionStripeSubscription,
};

export async function createSubscription(ctx: Context): Promise<Response> {
	const session = ctx.get("session");
	if (!session) return ctx.json({ error: "Unauthorized" }, 401);

	const admin = ctx.get("platformAdmin");
	if (!admin) return ctx.json({ error: "Platform admin access required" }, 403);

	// Creating a subscription is a super-only mutation (mirrors createPricingTier).
	const denied = requireAdminTier(ctx, SUPER_ONLY);
	if (denied) return denied;

	const db = ctx.get("database") as DatabaseInstance;
	const baseLogger = ctx.get("logger");
	const traceId = ctx.get("requestId");
	const logger = baseLogger?.child?.({ traceId, module: "platformadmin" }) ?? baseLogger;

	const body = await ctx.req.json();
	const { organizationId, tierId: requestedTierId, billingCycle } = body ?? {};

	if (!organizationId || typeof organizationId !== "string") {
		throw new ValidationError("organizationId is required");
	}
	const cycle: BillingCycle = VALID_CYCLES.includes(billingCycle)
		? billingCycle
		: "monthly";

	// Org must exist.
	const [org] = await db
		.select()
		.from(organizations)
		.where(eq(organizations.id, organizationId))
		.limit(1);
	if (!org) {
		return ctx.json({ error: "Organization not found" }, 404);
	}

	// Unique-per-org constraint: one subscription per org.
	const [existing] = await db
		.select()
		.from(subscriptions)
		.where(eq(subscriptions.organizationId, organizationId))
		.limit(1);
	if (existing) {
		return ctx.json(
			{ error: "Organization already has a subscription" },
			409,
		);
	}

	// Current active member count for the org.
	const [countRow] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(memberships)
		.where(
			and(
				eq(memberships.organizationId, organizationId),
				inArray(memberships.status, [...BILLABLE_STATUSES]),
			),
		);
	const activeMembers = Number(countRow?.count ?? 0);

	// Resolve the target tier.
	let tier: typeof pricingTiers.$inferSelect | undefined;
	if (requestedTierId && typeof requestedTierId === "string") {
		const [row] = await db
			.select()
			.from(pricingTiers)
			.where(eq(pricingTiers.id, requestedTierId))
			.limit(1);
		if (!row) {
			return ctx.json({ error: "Pricing tier not found" }, 404);
		}
		if (!row.isActive) {
			return ctx.json({ error: "This pricing tier is no longer available" }, 422);
		}
		// Member-count -> tier validation.
		if (!tierFitsMemberCount(row, activeMembers)) {
			return ctx.json(
				{
					error: `Pricing tier "${row.name}" covers up to ${row.maxMembers} members but the organization has ${activeMembers} active members`,
				},
				422,
			);
		}
		tier = row;
	} else {
		// No explicit tier: pick the cheapest active tier that fits.
		const activeTiers = await db
			.select()
			.from(pricingTiers)
			.where(eq(pricingTiers.isActive, true));
		const picked = pickCheapestCoveringTier(activeTiers, activeMembers, cycle);
		if (!picked) {
			return ctx.json(
				{
					error: `No active pricing tier covers ${activeMembers} active members — supply an explicit tierId`,
				},
				422,
			);
		}
		tier = activeTiers.find((t) => t.id === picked.id);
	}

	if (!tier) {
		return ctx.json({ error: "Could not resolve a pricing tier" }, 422);
	}

	// Provision at Stripe (stub-able boundary). Non-fatal if Stripe unconfigured.
	let stripeResult: StripeProvisionResult = { stripeSubscriptionId: null, stripeCustomerId: null };
	try {
		stripeResult = await stripeBoundary.provision({
			billing: ctx.get("billing"),
			org: { id: org.id, name: org.name, contactEmail: org.contactEmail ?? null },
			tier,
			cycle,
			logger,
		});
	} catch (err) {
		logger?.error?.(
			{ action: "createSubscription.stripeError", orgId: organizationId, err: err instanceof Error ? err.message : String(err) },
			"Stripe subscription provisioning failed — persisting local row without stripeSubscriptionId",
		);
	}

	const now = new Date();
	const trialEndsAt = new Date(now.getTime() + (tier.trialDays ?? 30) * 24 * 60 * 60 * 1000);

	const [created] = await db
		.insert(subscriptions)
		.values({
			organizationId,
			pricingTierId: tier.id,
			status: "trial",
			billingCycle: cycle,
			trialEndsAt,
			stripeSubscriptionId: stripeResult.stripeSubscriptionId,
			stripeCustomerId: stripeResult.stripeCustomerId,
			createdBy: admin.userId,
			updatedBy: admin.userId,
		})
		.returning();

	await domainEvents.emit("subscription.created", {
		subscriptionId: created?.id ?? "",
		organizationId,
		tierId: tier.id,
		status: created?.status ?? "trial",
	});

	logger?.info?.(
		{
			action: "createSubscription.1",
			subscriptionId: created?.id,
			organizationId,
			pricingTierId: tier.id,
			activeMembers,
			billingCycle: cycle,
			stripeSubscriptionId: stripeResult.stripeSubscriptionId,
		},
		"Subscription created by admin",
	);

	return ctx.json({ data: created }, 201);
}
