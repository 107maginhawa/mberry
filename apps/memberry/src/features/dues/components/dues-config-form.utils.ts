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
    annualAmount: parseCentsInput(formState.defaultAmount),
    currency: extras?.currency ?? 'PHP',
    gracePeriodDays: parseInt(formState.gracePeriodDays),
    fundAllocations: [],
    effectiveDate: new Date().toISOString(),
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
    annualAmount: parseCentsInput(formState.defaultAmount),
    gracePeriodDays: parseInt(formState.gracePeriodDays),
  }
}
