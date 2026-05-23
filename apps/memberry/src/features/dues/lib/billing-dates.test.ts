import { describe, test, expect, vi, afterEach } from 'vitest'
import { computeBillingDates, formatBillingSchedule } from './billing-dates'

describe('computeBillingDates', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test('annual returns 1 date per year', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1)) // Jan 1 2026

    const dates = computeBillingDates('annual', 3, 15, 4)
    expect(dates).toHaveLength(4)

    // Each date should be ~12 months apart
    for (let i = 1; i < dates.length; i++) {
      const diff = dates[i]!.getFullYear() - dates[i - 1]!.getFullYear()
      expect(diff).toBe(1)
    }
  })

  test('quarterly returns 4 dates per year', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1))

    const dates = computeBillingDates('quarterly', 1, 10, 8)
    expect(dates).toHaveLength(8)

    // First 4 should be in the same year
    const firstYear = dates[0]!.getFullYear()
    const sameYearDates = dates.filter(d => d.getFullYear() === firstYear)
    expect(sameYearDates).toHaveLength(4)
  })

  test('semi-annual returns 2 dates per year', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1))

    const dates = computeBillingDates('semi-annual', 1, 15, 4)
    expect(dates).toHaveLength(4)

    // First 2 should be in the same year
    const firstYear = dates[0]!.getFullYear()
    const sameYearDates = dates.filter(d => d.getFullYear() === firstYear)
    expect(sameYearDates).toHaveLength(2)
  })

  test('dates have correct month and day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1))

    const dates = computeBillingDates('annual', 6, 20, 3)

    for (const date of dates) {
      expect(date.getMonth()).toBe(5) // June = 5 (0-indexed)
      expect(date.getDate()).toBe(20)
    }
  })

  test('quarterly dates have correct months', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1))

    const dates = computeBillingDates('quarterly', 1, 10, 4)
    const months = dates.map(d => d.getMonth())

    // Starting from January (0), every 3 months: Jan, Apr, Jul, Oct
    expect(months).toEqual([0, 3, 6, 9])
  })

  test('edge: cycleStartMonth=11 quarterly wraps to next year correctly', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1))

    const dates = computeBillingDates('quarterly', 11, 5, 4)
    const monthYears = dates.map(d => ({
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    }))

    // Nov -> Feb -> May -> Aug (wrapping around)
    expect(monthYears[0]).toEqual({ month: 2, year: 2026 })
    expect(monthYears[1]).toEqual({ month: 5, year: 2026 })
    expect(monthYears[2]).toEqual({ month: 8, year: 2026 })
    expect(monthYears[3]).toEqual({ month: 11, year: 2026 })
  })

  test('clamps cycleStartMonth to 1-12 range', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1))

    const dates = computeBillingDates('annual', 15, 10, 1)
    // Should clamp to 12 (December)
    expect(dates[0]!.getMonth()).toBe(11)
  })

  test('clamps dueDateDay to 1-28 range', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1))

    const dates = computeBillingDates('annual', 1, 31, 1)
    // Should clamp to 28
    expect(dates[0]!.getDate()).toBe(28)
  })

  test('default count is 8', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1))

    const dates = computeBillingDates('quarterly', 1, 10)
    expect(dates).toHaveLength(8)
  })
})

describe('formatBillingSchedule', () => {
  test('annual format', () => {
    const result = formatBillingSchedule('annual', 6, 15)
    expect(result).toBe('Annual billing — due June 15')
  })

  test('quarterly format', () => {
    const result = formatBillingSchedule('quarterly', 1, 10)
    expect(result).toBe('Quarterly billing (4x/year) — starting January 10')
  })

  test('semi-annual format', () => {
    const result = formatBillingSchedule('semi-annual', 3, 1)
    expect(result).toBe('Semi-annual billing (2x/year) — starting March 1')
  })

  test('clamps out-of-range month', () => {
    const result = formatBillingSchedule('annual', 13, 1)
    expect(result).toBe('Annual billing — due December 1')
  })
})
