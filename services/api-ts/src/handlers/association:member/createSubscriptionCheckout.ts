/**
 * createSubscriptionCheckout
 *
 * Path: POST /association/member/org/:organizationId/subscription/checkout
 * Creates a Stripe Checkout Session for subscription payment.
 * Returns { checkoutUrl } for redirect.
 * Officer access required.
 */

import { eq } from "drizzle-orm";
import type { Context } from "hono";
import Stripe from "stripe";
import type { DatabaseInstance } from "@/core/database";
import { UnauthorizedError, ValidationError } from "@/core/errors";
import {
	organizations,
	pricingTiers,
	subscriptions,
} from "@/handlers/platformadmin/repos/platform-admin.schema";
import type { Variables } from "@/types/app";
import { requireOfficerTerm } from "@/utils/officer-check";

export async function createSubscriptionCheckout(
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
	const logger = ctx.get("logger");
	const billing = ctx.get("billing");

	const body = await ctx.req.json();
	const { tierId, billingCycle } = body;

	if (!tierId || typeof tierId !== "string") {
		throw new ValidationError("tierId is required");
	}

	const validCycles = ["monthly", "annual"];
	const cycle: "monthly" | "annual" = validCycles.includes(billingCycle)
		? billingCycle
		: "monthly";

	// Validate tier
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

	// Get org details
	const [org] = await db
		.select()
		.from(organizations)
		.where(eq(organizations.id, orgId))
		.limit(1);

	if (!org) {
		return ctx.json({ error: "Organization not found" }, 404);
	}

	// Get or create Stripe customer
	const [sub] = await db
		.select()
		.from(subscriptions)
		.where(eq(subscriptions.organizationId, orgId))
		.limit(1);

	const stripe = (billing as any)["ensureStripeInitialized"]
		? (billing as any)["ensureStripeInitialized"]()
		: null;

	// Access raw Stripe SDK via the billing service's private method
	// We need to create checkout sessions directly as billing.ts doesn't expose subscription checkout
	const billingConfig = (billing as any)["config"] as
		| { secretKey?: string; url?: string }
		| undefined;
	if (!billingConfig?.secretKey) {
		return ctx.json({ error: "Stripe is not configured" }, 503);
	}

	const stripeOptions: Stripe.StripeConfig = {
		apiVersion: "2025-10-29.clover" as any,
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

	let stripeCustomerId = sub?.stripeCustomerId;

	if (!stripeCustomerId) {
		// Create new Stripe customer for the org
		const customer = await stripeClient.customers.create({
			name: org.name,
			email: org.contactEmail ?? undefined,
			metadata: {
				organizationId: orgId,
				platform: "memberry",
			},
		});
		stripeCustomerId = customer.id;
		logger.info({ stripeCustomerId, orgId }, "Stripe customer created for org");
	}

	// Determine price amount in cents
	const priceAmount = cycle === "annual" ? tier.annualPrice : tier.monthlyPrice;
	const interval = cycle === "annual" ? "year" : "month";

	// Create a price on-the-fly for this tier
	// In production, you'd want to pre-create Stripe Price objects per tier
	const stripePrice = await stripeClient.prices.create({
		unit_amount: priceAmount,
		currency: tier.currency.toLowerCase(),
		recurring: { interval },
		product_data: {
			name: tier.name,
			metadata: {
				tierId: tier.id,
				tierSlug: tier.slug,
			},
		},
	});

	const origin = ctx.req.header("origin") ?? "https://app.memberry.com";
	const checkoutSession = await stripeClient.checkout.sessions.create({
		mode: "subscription",
		customer: stripeCustomerId,
		line_items: [{ price: stripePrice.id, quantity: 1 }],
		success_url: `${origin}/officer/subscription?success=1`,
		cancel_url: `${origin}/officer/subscription?cancelled=1`,
		metadata: {
			organizationId: orgId,
			tierId,
			billingCycle: cycle,
		},
	});

	// Persist the stripe customer ID to the subscription record
	if (sub) {
		await db
			.update(subscriptions)
			.set({ stripeCustomerId, updatedAt: new Date() })
			.where(eq(subscriptions.id, sub.id));
	} else {
		// Create a trial subscription record so we track the customer
		const user = ctx.get("user")!;
		const trialEndsAt = new Date(
			Date.now() + tier.trialDays * 24 * 60 * 60 * 1000,
		);
		await db.insert(subscriptions).values({
			organizationId: orgId,
			pricingTierId: tierId,
			status: "trial",
			billingCycle: cycle,
			trialEndsAt,
			stripeCustomerId,
			createdBy: user.id,
			updatedBy: user.id,
		});
	}

	logger.info(
		{ orgId, tierId, cycle, checkoutUrl: checkoutSession.url },
		"Subscription checkout session created",
	);

	return ctx.json({ checkoutUrl: checkoutSession.url }, 200);
}
