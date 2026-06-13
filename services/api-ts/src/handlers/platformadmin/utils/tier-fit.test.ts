/**
 * tier-fit — pure helper tests (UJ-M03 platform subscription).
 *
 * Member-count -> tier rule:
 *   - maxMembers null = unlimited, always fits
 *   - else activeMembers <= maxMembers
 */
import { describe, test, expect } from "bun:test";
import { tierFitsMemberCount, pickCheapestCoveringTier } from "./tier-fit";

describe("tierFitsMemberCount", () => {
	test("unlimited tier (maxMembers null) always fits", () => {
		expect(tierFitsMemberCount({ maxMembers: null }, 0)).toBe(true);
		expect(tierFitsMemberCount({ maxMembers: null }, 1_000_000)).toBe(true);
	});

	test("bounded tier fits when count <= maxMembers", () => {
		expect(tierFitsMemberCount({ maxMembers: 500 }, 500)).toBe(true);
		expect(tierFitsMemberCount({ maxMembers: 500 }, 499)).toBe(true);
		expect(tierFitsMemberCount({ maxMembers: 500 }, 0)).toBe(true);
	});

	test("bounded tier does NOT fit when count > maxMembers", () => {
		expect(tierFitsMemberCount({ maxMembers: 500 }, 501)).toBe(false);
		expect(tierFitsMemberCount({ maxMembers: 0 }, 1)).toBe(false);
	});

	test("negative counts are floored to 0 (never unbounds the check)", () => {
		expect(tierFitsMemberCount({ maxMembers: 0 }, -5)).toBe(true);
	});
});

describe("pickCheapestCoveringTier", () => {
	const tiers = [
		{ id: "small", monthlyPrice: 1000, annualPrice: 10000, maxMembers: 100 },
		{ id: "medium", monthlyPrice: 5000, annualPrice: 50000, maxMembers: 500 },
		{ id: "unlimited", monthlyPrice: 20000, annualPrice: 200000, maxMembers: null },
	];

	test("picks the cheapest tier that covers the count", () => {
		expect(pickCheapestCoveringTier(tiers, 50)?.id).toBe("small");
		expect(pickCheapestCoveringTier(tiers, 300)?.id).toBe("medium");
		expect(pickCheapestCoveringTier(tiers, 100000)?.id).toBe("unlimited");
	});

	test("respects annual cycle pricing for ordering", () => {
		expect(pickCheapestCoveringTier(tiers, 50, "annual")?.id).toBe("small");
	});

	test("skips inactive tiers", () => {
		const withInactive = [
			{ id: "cheap-dead", monthlyPrice: 1, annualPrice: 1, maxMembers: 100, isActive: false },
			...tiers,
		];
		expect(pickCheapestCoveringTier(withInactive, 50)?.id).toBe("small");
	});

	test("returns null when no tier fits", () => {
		const bounded = [
			{ id: "small", monthlyPrice: 1000, annualPrice: 10000, maxMembers: 100 },
		];
		expect(pickCheapestCoveringTier(bounded, 200)).toBeNull();
	});
});
