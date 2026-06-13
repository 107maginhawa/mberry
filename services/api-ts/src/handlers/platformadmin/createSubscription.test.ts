/**
 * createSubscription — TDD tests (platform subscription billing, UJ-M03).
 *
 * Path: POST /admin/subscriptions
 * Auth: session + platformAdmin (super-only).
 *
 * Platform fee model: org pays a flat band price for a tier covering up to
 * `maxMembers` members. Member-count -> tier validation enforced here.
 *
 * Stripe boundary is STUBBED (Mock-Classification: APPROPRIATE — external
 * payment gateway). Live Stripe call = [BLOCKED BY ENVIRONMENT].
 */
import { describe, test, expect, spyOn, afterEach } from "bun:test";
import { makeCtx } from "@/test-utils/make-ctx";
import { createSubscription, stripeBoundary } from "./createSubscription";
import { ValidationError } from "@/core/errors";
import { domainEvents } from "@/core/domain-events";
import {
	organizations,
	pricingTiers,
	subscriptions,
} from "./repos/platform-admin.schema";
import { memberships } from "@/handlers/association:member/repos/membership.schema";

const FAKE_LOGGER = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, child: () => FAKE_LOGGER };
const ADMIN = { id: "pa-1", userId: "admin-1", role: "super" };

const ORG = { id: "org-1", name: "Manila Chapter", contactEmail: "admin@manila.org" };

function tier(over: Partial<Record<string, unknown>> = {}) {
	return {
		id: "tier-medium",
		name: "Medium",
		slug: "medium",
		monthlyPrice: 5000,
		annualPrice: 50000,
		currency: "PHP",
		maxMembers: 500,
		trialDays: 30,
		isActive: true,
		...over,
	};
}

/**
 * Table-aware mock DB. Resolves selects by which table is passed to .from(),
 * and captures inserted rows on `_inserted`.
 *
 * results: { org, existingSub, memberCount, tierRow, activeTiers }
 */
function makeDb(results: {
	org?: unknown;
	existingSub?: unknown;
	memberCount?: number;
	tierRow?: unknown;
	activeTiers?: unknown[];
}) {
	const inserted: unknown[] = [];
	return {
		_inserted: inserted,
		select: (_proj?: unknown) => ({
			from: (table: unknown) => {
				let rows: unknown[] = [];
				if (table === organizations) rows = results.org ? [results.org] : [];
				else if (table === subscriptions) rows = results.existingSub ? [results.existingSub] : [];
				else if (table === memberships) rows = [{ count: results.memberCount ?? 0 }];
				else if (table === pricingTiers) {
					// distinguish single-tier lookup (.limit) vs activeTiers list
					rows = results.tierRow ? [results.tierRow] : (results.activeTiers ?? []);
				}
				const chain: Record<string, unknown> = {
					where: () => chain,
					limit: async () => rows,
					then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
						Promise.resolve(rows).then(resolve, reject),
				};
				return chain;
			},
		}),
		insert: (_table: unknown) => ({
			values: (vals: Record<string, unknown>) => {
				inserted.push(vals);
				return {
					returning: async () => [{ id: "sub-new", ...vals }],
				};
			},
		}),
	} as unknown as Parameters<typeof makeCtx>[0]["database"];
}

function ctxFor(results: Parameters<typeof makeDb>[0], body: Record<string, unknown>, over: Record<string, unknown> = {}) {
	return makeCtx({
		user: { id: "admin-1", role: "platform_admin" },
		platformAdmin: ADMIN,
		_body: body,
		database: makeDb(results),
		logger: FAKE_LOGGER,
		...over,
	});
}

describe("createSubscription (TDD)", () => {
	let provisionSpy: ReturnType<typeof spyOn>;
	let emitSpy: ReturnType<typeof spyOn>;

	afterEach(() => {
		provisionSpy?.mockRestore();
		emitSpy?.mockRestore();
	});

	function stubStripe(id: string | null = "sub_fake_123") {
		provisionSpy = spyOn(stripeBoundary, "provision").mockResolvedValue({
			stripeSubscriptionId: id,
			stripeCustomerId: id ? "cus_fake_1" : null,
		});
	}

	test("returns 401 without session", async () => {
		const ctx = makeCtx({ session: null, user: null, _body: { organizationId: "org-1" } });
		const res = await createSubscription(ctx);
		expect(res.status).toBe(401);
	});

	test("returns 403 without platformAdmin", async () => {
		const ctx = makeCtx({ user: { id: "u", role: "member" }, _body: { organizationId: "org-1" } });
		const res = await createSubscription(ctx);
		expect(res.status).toBe(403);
	});

	test("throws ValidationError when organizationId missing", async () => {
		const ctx = ctxFor({}, {});
		await expect(createSubscription(ctx)).rejects.toBeInstanceOf(ValidationError);
	});

	test("returns 404 when org not found", async () => {
		const ctx = ctxFor({ org: null }, { organizationId: "org-1", tierId: "tier-medium" });
		const res = await createSubscription(ctx);
		expect(res.status).toBe(404);
	});

	test("members fit tier -> 201, row persisted, stripeSubscriptionId set via stub", async () => {
		stubStripe("sub_fake_123");
		emitSpy = spyOn(domainEvents, "emit").mockResolvedValue(undefined as never);
		const db = makeDb({ org: ORG, memberCount: 300, tierRow: tier({ maxMembers: 500 }) });
		const ctx = ctxFor({}, { organizationId: "org-1", tierId: "tier-medium" }, { database: db });
		const res = await createSubscription(ctx);
		expect(res.status).toBe(201);
		const body = (res as { body?: { data?: Record<string, unknown> } }).body;
		expect(body?.data?.stripeSubscriptionId).toBe("sub_fake_123");
		expect(body?.data?.pricingTierId).toBe("tier-medium");
		const inserted = (db as unknown as { _inserted: Record<string, unknown>[] })._inserted;
		expect(inserted.length).toBe(1);
		expect(inserted[0]?.organizationId).toBe("org-1");
		expect(inserted[0]?.stripeSubscriptionId).toBe("sub_fake_123");
		expect(inserted[0]?.status).toBe("trial");
		expect(provisionSpy).toHaveBeenCalledTimes(1);
	});

	test("members EXCEED tier.maxMembers -> 422, no insert", async () => {
		stubStripe();
		const db = makeDb({ org: ORG, memberCount: 600, tierRow: tier({ maxMembers: 500 }) });
		const ctx = ctxFor({}, { organizationId: "org-1", tierId: "tier-medium" }, { database: db });
		const res = await createSubscription(ctx);
		expect(res.status).toBe(422);
		expect((db as unknown as { _inserted: unknown[] })._inserted.length).toBe(0);
		expect(provisionSpy).not.toHaveBeenCalled();
	});

	test("unlimited tier (maxMembers null) -> 201 regardless of count", async () => {
		stubStripe("sub_unlimited");
		emitSpy = spyOn(domainEvents, "emit").mockResolvedValue(undefined as never);
		const ctx = ctxFor(
			{ org: ORG, memberCount: 50000, tierRow: tier({ id: "tier-unl", maxMembers: null }) },
			{ organizationId: "org-1", tierId: "tier-unl" },
		);
		const res = await createSubscription(ctx);
		expect(res.status).toBe(201);
	});

	test("duplicate active subscription -> 409 conflict", async () => {
		stubStripe();
		const ctx = ctxFor(
			{ org: ORG, existingSub: { id: "sub-existing", organizationId: "org-1" } },
			{ organizationId: "org-1", tierId: "tier-medium" },
		);
		const res = await createSubscription(ctx);
		expect(res.status).toBe(409);
		expect(provisionSpy).not.toHaveBeenCalled();
	});

	test("no tierId -> auto-picks cheapest covering active tier (201)", async () => {
		stubStripe("sub_auto");
		emitSpy = spyOn(domainEvents, "emit").mockResolvedValue(undefined as never);
		const db = makeDb({
			org: ORG,
			memberCount: 80,
			activeTiers: [
				tier({ id: "small", monthlyPrice: 1000, maxMembers: 100 }),
				tier({ id: "big", monthlyPrice: 9000, maxMembers: 1000 }),
			],
		});
		const ctx = ctxFor({}, { organizationId: "org-1" }, { database: db });
		const res = await createSubscription(ctx);
		expect(res.status).toBe(201);
		const inserted = (db as unknown as { _inserted: Record<string, unknown>[] })._inserted;
		expect(inserted[0]?.pricingTierId).toBe("small");
	});

	test("no tierId and no tier fits -> 422 (requires explicit tierId)", async () => {
		stubStripe();
		const ctx = ctxFor(
			{ org: ORG, memberCount: 5000, activeTiers: [tier({ id: "small", maxMembers: 100 })] },
			{ organizationId: "org-1" },
		);
		const res = await createSubscription(ctx);
		expect(res.status).toBe(422);
	});

	test("Stripe unconfigured -> 201 with stripeSubscriptionId null [BLOCKED BY ENVIRONMENT]", async () => {
		// No stub: real provision runs, ctx.billing undefined -> config missing -> null.
		emitSpy = spyOn(domainEvents, "emit").mockResolvedValue(undefined as never);
		const db = makeDb({ org: ORG, memberCount: 10, tierRow: tier({ maxMembers: 500 }) });
		const ctx = ctxFor({}, { organizationId: "org-1", tierId: "tier-medium" }, { database: db, billing: null });
		const res = await createSubscription(ctx);
		expect(res.status).toBe(201);
		const inserted = (db as unknown as { _inserted: Record<string, unknown>[] })._inserted;
		expect(inserted[0]?.stripeSubscriptionId).toBeNull();
	});
});
