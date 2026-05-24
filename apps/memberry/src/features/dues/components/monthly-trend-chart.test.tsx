import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MonthlyTrendChart } from './monthly-trend-chart'

const sampleData = [
  { month: '2026-01', collected: 50000, outstanding: 10000 },
  { month: '2026-02', collected: 45000, outstanding: 12000 },
  { month: '2026-03', collected: 60000, outstanding: 5000 },
]

describe('MonthlyTrendChart', () => {
  // AC-T5-003: renders with data
  test('[AC-T5-003] renders chart with monthly data', () => {
    render(<MonthlyTrendChart data={sampleData} />)
    expect(screen.getByText('Monthly Collections')).toBeDefined()
    expect(screen.getByLabelText('Monthly collections trend chart')).toBeDefined()
  })

  // AC-T5-007: empty data shows "No data yet"
  test('[AC-T5-007] shows "No data yet" with empty data array', () => {
    render(<MonthlyTrendChart data={[]} />)
    expect(screen.getByText('No data yet')).toBeDefined()
  })

  // BR-T5-001: no crash on empty
  test('[BR-T5-001] does not crash on empty data', () => {
    expect(() => render(<MonthlyTrendChart data={[]} />)).not.toThrow()
  })

  // AC-T5-008: ARIA label
  test('[AC-T5-008] has ARIA label for accessibility', () => {
    render(<MonthlyTrendChart data={sampleData} />)
    expect(screen.getByRole('img', { name: /monthly collections/i })).toBeDefined()
  })
})
