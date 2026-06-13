/**
 * tier-fit — pure helpers for platform subscription tier selection (UJ-M03).
 *
 * Platform fee model (founder-decided): a pricing tier covers up to
 * `maxMembers` members for a flat band price. The org pays the platform that
 * flat price. There is NO Stripe application_fee / Connect skim on member dues.
 *
 * A tier "fits" an org when its member headroom covers the org's current
 * active member count:
 *   - maxMembers === null  -> unlimited, always fits.
 *   - else                 -> activeMembers <= maxMembers.
 */

export interface TierLike {
	id: string;
	monthlyPrice: number;
	annualPrice: number;
	maxMembers: number | null;
	isActive?: boolean;
}

/**
 * True when `tier` can cover `activeMembers`.
 * `maxMembers === null` means unlimited (always fits). Negative counts are
 * treated as 0 so a bad caller can never accidentally pass an unbounded check.
 */
export function tierFitsMemberCount(
	tier: Pick<TierLike, "maxMembers">,
	activeMembers: number,
): boolean {
	if (tier.maxMembers === null || tier.maxMembers === undefined) return true;
	const count = Math.max(0, activeMembers);
	return count <= tier.maxMembers;
}

/**
 * Pick the cheapest ACTIVE tier (by `cycle` price) that covers `activeMembers`.
 * Unlimited tiers (maxMembers === null) are eligible and sorted after bounded
 * tiers of equal price (they are usually the most expensive anyway). Returns
 * `null` when no active tier fits.
 */
export function pickCheapestCoveringTier(
	tiers: TierLike[],
	activeMembers: number,
	cycle: "monthly" | "annual" = "monthly",
): TierLike | null {
	const priceOf = (t: TierLike) =>
		cycle === "annual" ? t.annualPrice : t.monthlyPrice;

	const eligible = tiers
		.filter((t) => t.isActive !== false)
		.filter((t) => tierFitsMemberCount(t, activeMembers));

	if (eligible.length === 0) return null;

	eligible.sort((a, b) => priceOf(a) - priceOf(b));
	return eligible[0] ?? null;
}
