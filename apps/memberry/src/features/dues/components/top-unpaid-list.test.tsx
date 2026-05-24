import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TopUnpaidList } from './top-unpaid-list'

const sampleMembers = [
  { personId: 'p1', name: 'Juan Santos', outstanding: 120000, invoiceCount: 2 },
  { personId: 'p2', name: 'Maria Cruz', outstanding: 60000, invoiceCount: 1 },
]

describe('TopUnpaidList', () => {
  // AC-T5-005: renders sorted table
  test('[AC-T5-005] renders table of unpaid members', () => {
    render(<TopUnpaidList members={sampleMembers} />)
    expect(screen.getByText('Juan Santos')).toBeDefined()
    expect(screen.getByText('Maria Cruz')).toBeDefined()
  })

  // AC-T5-005: send reminder button
  test('[AC-T5-005] fires onSendReminder callback', () => {
    const onReminder = vi.fn()
    render(<TopUnpaidList members={sampleMembers} onSendReminder={onReminder} />)
    const btn = screen.getByLabelText('Send reminder to Juan Santos')
    fireEvent.click(btn)
    expect(onReminder).toHaveBeenCalledWith('p1')
  })

  // AC-T5-007: empty shows "All members are current"
  test('[AC-T5-007] shows empty state when no unpaid members', () => {
    render(<TopUnpaidList members={[]} />)
    expect(screen.getByText('All members are current')).toBeDefined()
  })

  // AC-T5-008: ARIA label on table
  test('[AC-T5-008] table has ARIA label', () => {
    render(<TopUnpaidList members={sampleMembers} />)
    expect(screen.getByLabelText('Top unpaid members')).toBeDefined()
  })
})
