import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusDistributionChart } from './status-distribution-chart'

const sampleData = { active: 40, dueSoon: 8, overdue: 12, lapsed: 4 }

describe('StatusDistributionChart', () => {
  // AC-T5-004: renders segments
  test('[AC-T5-004] renders chart with status segments', () => {
    render(<StatusDistributionChart data={sampleData} />)
    expect(screen.getByText('Member Status')).toBeDefined()
  })

  // AC-T5-007: zero members shows empty state
  test('[AC-T5-007] shows "No members yet" with all-zero data', () => {
    render(<StatusDistributionChart data={{ active: 0, dueSoon: 0, overdue: 0, lapsed: 0 }} />)
    expect(screen.getByText('No members yet')).toBeDefined()
  })

  // BR-T5-001: no crash on zero
  test('[BR-T5-001] does not crash with all-zero data', () => {
    expect(() =>
      render(<StatusDistributionChart data={{ active: 0, dueSoon: 0, overdue: 0, lapsed: 0 }} />)
    ).not.toThrow()
  })

  // AC-T5-008: ARIA label with total count
  test('[AC-T5-008] ARIA label includes total member count', () => {
    render(<StatusDistributionChart data={sampleData} />)
    expect(screen.getByLabelText(/64 total members/)).toBeDefined()
  })
})
