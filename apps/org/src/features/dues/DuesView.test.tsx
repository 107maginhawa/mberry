import { it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DuesView } from './DuesView'

it('renders dashboard tiles with formatted money + rate', () => {
  render(
    <DuesView
      stats={{ totalCollected: 250000, totalOutstanding: 500000, paidCount: 1, unpaidCount: 2, overdueCount: 0, collectionRate: 33, memberCount: 3 }}
      payments={[{ id: 'pay1', amount: 250000, status: 'completed' }]}
      invoices={[{ id: 'inv1', amount: 500000, status: 'sent', memberName: 'Olive Cruz' }]}
    />,
  )
  // totalCollected tile + payment row both show ₱2,500.00
  expect(screen.getAllByText('₱2,500.00').length).toBeGreaterThanOrEqual(1)
  expect(screen.getByText(/33%/)).toBeInTheDocument()
  expect(screen.getByText('Olive Cruz')).toBeInTheDocument()
})

it('shows EmptyState when no payments', () => {
  render(
    <DuesView
      stats={{ totalCollected: 0, totalOutstanding: 0, paidCount: 0, unpaidCount: 0, overdueCount: 0, collectionRate: 0, memberCount: 0 }}
      payments={[]}
      invoices={[]}
    />,
  )
  expect(screen.getByText('No payments yet')).toBeInTheDocument()
})

it('renders payment status badge', () => {
  render(
    <DuesView
      stats={{ totalCollected: 0, totalOutstanding: 0, paidCount: 0, unpaidCount: 0, overdueCount: 0, collectionRate: 0, memberCount: 0 }}
      payments={[{ id: 'p1', amount: 50000, status: 'pending' }]}
      invoices={[]}
    />,
  )
  expect(screen.getByText('pending')).toBeInTheDocument()
})
