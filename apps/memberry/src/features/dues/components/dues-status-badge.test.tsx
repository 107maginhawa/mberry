import { describe, test, expect } from 'bun:test'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { DuesStatusBadge } from './dues-status-badge'

describe('DuesStatusBadge', () => {
  describe('invoice statuses', () => {
    test.each([
      ['generated', 'Generated'],
      ['sent', 'Sent'],
      ['overdue', 'Overdue'],
      ['paid', 'Paid'],
      ['cancelled', 'Cancelled'],
      ['writtenOff', 'Written Off'],
    ])('renders invoice status "%s" as "%s"', (status, label) => {
      renderWithProviders(
        <DuesStatusBadge type="invoice" status={status} />
      )

      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  describe('payment statuses', () => {
    test.each([
      ['pending', 'Pending'],
      ['completed', 'Completed'],
      ['failed', 'Failed'],
      ['refunded', 'Refunded'],
      ['submitted', 'Submitted'],
      ['confirmed', 'Confirmed'],
      ['rejected', 'Rejected'],
    ])('renders payment status "%s" as "%s"', (status, label) => {
      renderWithProviders(
        <DuesStatusBadge type="payment" status={status} />
      )

      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  test('renders fallback for unknown status', () => {
    renderWithProviders(
      <DuesStatusBadge type="invoice" status="nonexistent" />
    )

    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  test('icons are aria-hidden', () => {
    const { container } = renderWithProviders(
      <DuesStatusBadge type="invoice" status="paid" />
    )

    const svgs = container.querySelectorAll('svg')
    svgs.forEach((svg) => {
      expect(svg.getAttribute('aria-hidden')).toBe('true')
    })
  })
})
