import { parseCentsInput } from '../lib/money'

/**
 * Determine whether to create (POST) or update (PATCH) based on
 * whether a config already exists for this org.
 */
export function chooseMutationAction(
  config: any
): 'create' | 'update' {
  if (!config) return 'create'
  const amount = config.annualAmount ?? config.defaultAmount
  if (amount == null) return 'create'
  return 'update'
}

/**
 * Build the body for POST /association/member/dues-configs
 * (DuesConfigCreateRequest).
 */
export function buildCreatePayload(
  orgId: string,
  formState: { defaultAmount: string; gracePeriodDays: string },
  extras?: { currency?: string; tierId?: string }
) {
  return {
    organizationId: orgId,
    tierId: extras?.tierId ?? orgId, // default tier = org
    // ISSUE-021: validator is z.number().int(); BigInt serializes to a string
    // the validator rejects. Send a plain integer (cents).
    annualAmount: parseCentsInput(formState.defaultAmount) as unknown as bigint,
    currency: extras?.currency ?? 'PHP',
    gracePeriodDays: parseInt(formState.gracePeriodDays),
    fundAllocations: [] as [],
    // ISSUE-021: validator wants date-only YYYY-MM-DD; a Date serializes to a
    // full ISO datetime that fails the regex. Send a date-only string.
    effectiveDate: new Date().toISOString().slice(0, 10) as unknown as Date,
    status: 'active' as const,
  }
}

/**
 * Build the body for PATCH /association/member/dues-configs/{id}
 * (DuesConfigUpdateRequest).
 *
 * `currency` and `billingFrequency` are editable in the form and are real
 * columns on the org-level dues_org_config table (the table getDuesConfig reads
 * from). Previously this payload omitted BOTH, so officer edits to currency or
 * billing frequency were silently dropped on update — the form showed the change,
 * the save returned 200, and a reload reverted it. They are now included and
 * accepted by the update validator (DuesConfigUpdateRequest gained `currency?` +
 * `billingFrequency?`) and persisted by the updateDuesConfig handler's
 * org-config upsert path.
 */
export function buildUpdatePayload(
  formState: {
    defaultAmount: string
    gracePeriodDays: string
  },
  extras?: {
    currency?: string
    billingFrequency?: 'annual' | 'semi-annual' | 'quarterly'
  }
) {
  return {
    // ISSUE-021: see buildCreatePayload — send a plain integer (cents).
    annualAmount: parseCentsInput(formState.defaultAmount) as unknown as bigint,
    currency: extras?.currency ?? 'PHP',
    billingFrequency: extras?.billingFrequency ?? 'annual',
    gracePeriodDays: parseInt(formState.gracePeriodDays),
  }
}
