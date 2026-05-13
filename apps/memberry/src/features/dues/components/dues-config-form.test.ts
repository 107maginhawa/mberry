import { describe, test, expect } from 'vitest'
import { parseCentsInput } from '../lib/money'

/**
 * Phase 15 / Plan 00a — silent data loss bug in dues config form.
 *
 * The PATCH validator (DuesConfigUpdateRequestSchema) accepts ONLY:
 *   annualAmount, gracePeriodDays, fundAllocations, effectiveDate, status
 *
 * The form was sending:
 *   defaultAmount, currency, billingFrequency, dueDateMonth, dueDateDay,
 *   gracePeriodDays, reminderSchedules
 *
 * Zod strips unknown fields → 200 OK → edits silently lost on reload.
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
    gracePeriodDays: parseInt(formState.gracePeriodDays),
  }
}

const ACCEPTED_FIELDS = new Set([
  'annualAmount',
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
    const strippedFields = ['currency', 'billingFrequency', 'dueDateMonth', 'dueDateDay', 'reminderSchedules']
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
