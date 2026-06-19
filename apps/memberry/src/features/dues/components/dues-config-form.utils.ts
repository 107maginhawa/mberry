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
 * (DuesConfigUpdateRequest — only accepted fields).
 */
export function buildUpdatePayload(formState: {
  defaultAmount: string
  gracePeriodDays: string
}) {
  return {
    // ISSUE-021: see buildCreatePayload — send a plain integer (cents).
    annualAmount: parseCentsInput(formState.defaultAmount) as unknown as bigint,
    gracePeriodDays: parseInt(formState.gracePeriodDays),
  }
}
