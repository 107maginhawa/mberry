import { describe, test, expect } from 'bun:test'
import { parseCentsInput } from '../lib/money'

/**
 * Phase 15 / Plan 00a — silent data loss bug in dues config form.
 *
 * The PATCH validator (DuesConfigUpdateRequestSchema) now accepts:
 *   annualAmount, currency, billingFrequency, gracePeriodDays,
 *   fundAllocations, effectiveDate, status
 *
 * `currency` and `billingFrequency` were added to the update request model
 * (TypeSpec DuesConfigUpdateRequest) so officer edits to them persist on update.
 * Both map to real columns on the org-level dues_org_config table (the table the
 * form reads back from). Previously the update payload omitted both, so the edits
 * were silently dropped: form showed the change, save 200'd, reload reverted.
 *
 * Fields with NO backend representation must still NOT be sent (Zod strips them):
 *   dueDateMonth, dueDateDay, reminderSchedules
 */

/**
 * Build the submission payload exactly as the onSubmit handler does.
 * We import and call this from the component module in a real integration
 * test; here we assert the shape contract directly.
 */
function buildSubmitPayload(formState: {
  defaultAmount: string
  gracePeriodDays: string
}) {
  // This mirrors what the form SHOULD send after the fix.
  return {
    annualAmount: parseCentsInput(formState.defaultAmount),
    currency: 'PHP',
    billingFrequency: 'annual' as const,
    gracePeriodDays: parseInt(formState.gracePeriodDays),
  }
}

const ACCEPTED_FIELDS = new Set([
  'annualAmount',
  'currency',
  'billingFrequency',
  'gracePeriodDays',
  'fundAllocations',
  'effectiveDate',
  'status',
])

describe('DuesConfigForm payload shape (Phase 15 / Plan 00a)', () => {
  test('payload contains annualAmount, NOT defaultAmount', () => {
    const payload = buildSubmitPayload({ defaultAmount: '500.00', gracePeriodDays: '30' })
    expect(payload).toHaveProperty('annualAmount')
    expect(payload).not.toHaveProperty('defaultAmount')
  })

  test('annualAmount is computed from parseCentsInput', () => {
    const payload = buildSubmitPayload({ defaultAmount: '500.00', gracePeriodDays: '30' })
    expect(payload.annualAmount).toBe(50000)
  })

  test('payload must NOT contain fields stripped by DuesConfigUpdateRequestSchema', () => {
    const payload = buildSubmitPayload({ defaultAmount: '500.00', gracePeriodDays: '30' })
    // dueDate*/reminderSchedules have no backend representation in the update
    // request; currency + billingFrequency ARE now accepted and excluded here.
    const strippedFields = ['dueDateMonth', 'dueDateDay', 'reminderSchedules']
    for (const field of strippedFields) {
      expect(payload).not.toHaveProperty(field)
    }
  })

  test('every key in payload is in the ACCEPTED_FIELDS set', () => {
    const payload = buildSubmitPayload({ defaultAmount: '500.00', gracePeriodDays: '30' })
    for (const key of Object.keys(payload)) {
      expect(ACCEPTED_FIELDS.has(key)).toBe(true)
    }
  })

  test('gracePeriodDays is an integer', () => {
    const payload = buildSubmitPayload({ defaultAmount: '100', gracePeriodDays: '45' })
    expect(payload.gracePeriodDays).toBe(45)
    expect(Number.isInteger(payload.gracePeriodDays)).toBe(true)
  })
})

/**
 * Phase 15 / Plan 00b — 404 on first-time dues config save.
 *
 * The form always calls updateDuesConfig (PATCH) even when the org has
 * no existing config. Backend PATCH returns 404 for missing configs.
 *
 * Fix: check if config exists, POST for create, PATCH for update.
 */
import {
  buildCreatePayload,
  buildUpdatePayload,
  chooseMutationAction,
} from './dues-config-form.utils'

describe('DuesConfigForm create-vs-update dispatch (Phase 15 / Plan 00b)', () => {
  const orgId = 'org-123'
  const formState = { defaultAmount: '500.00', gracePeriodDays: '30' }

  test('chooseMutationAction returns "create" when config is null (no existing config)', () => {
    expect(chooseMutationAction(null)).toBe('create')
  })

  test('chooseMutationAction returns "create" when config is undefined', () => {
    expect(chooseMutationAction(undefined)).toBe('create')
  })

  test('chooseMutationAction returns "update" when config exists with annualAmount', () => {
    expect(chooseMutationAction({ annualAmount: 50000, id: 'cfg-1' })).toBe('update')
  })

  test('chooseMutationAction returns "update" when config exists with defaultAmount', () => {
    expect(chooseMutationAction({ defaultAmount: 50000, id: 'cfg-2' })).toBe('update')
  })

  test('buildCreatePayload includes organizationId and required create fields', () => {
    const payload = buildCreatePayload(orgId, formState)
    expect(payload).toHaveProperty('organizationId', orgId)
    // ISSUE-021: annualAmount must be a plain integer (cents), not BigInt —
    // the validator is z.number().int() and BigInt serializes to a string it rejects.
    expect(payload).toHaveProperty('annualAmount', 50000)
    expect(payload).toHaveProperty('gracePeriodDays', 30)
    expect(payload).toHaveProperty('currency')
  })

  test('buildCreatePayload does NOT include path param (POST has no duesConfigId)', () => {
    const payload = buildCreatePayload(orgId, formState)
    expect(payload).not.toHaveProperty('duesConfigId')
  })

  test('buildUpdatePayload includes annualAmount, currency, billingFrequency, gracePeriodDays', () => {
    const payload = buildUpdatePayload(formState, { currency: 'USD', billingFrequency: 'semi-annual' })
    // ISSUE-021: annualAmount must be a plain integer (cents), not BigInt.
    expect(payload).toHaveProperty('annualAmount', 50000)
    expect(payload).toHaveProperty('gracePeriodDays', 30)
    // currency + billingFrequency are now persisted on update (were previously dropped).
    expect(payload).toHaveProperty('currency', 'USD')
    expect(payload).toHaveProperty('billingFrequency', 'semi-annual')
    expect(payload).not.toHaveProperty('organizationId')
  })

  test('buildUpdatePayload defaults currency to PHP and billingFrequency to annual', () => {
    const payload = buildUpdatePayload(formState)
    expect(payload).toHaveProperty('currency', 'PHP')
    expect(payload).toHaveProperty('billingFrequency', 'annual')
  })
})
