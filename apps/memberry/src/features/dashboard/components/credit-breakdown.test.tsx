import { describe, test, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { CreditBreakdown } from './credit-breakdown'

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={String(to)}>{children}</a>
  ),
}))

// Mock framer-motion (used by CountUp)
vi.mock('framer-motion', () => ({
  useReducedMotion: () => true, // skip animation in tests
}))

describe('CreditBreakdown', () => {
  test('renders Credit Progress heading', () => {
    renderWithProviders(
      <CreditBreakdown totalCredits={0} requiredCredits={0} />
    )

    expect(screen.getByText('Credit Progress')).toBeInTheDocument()
  })

  test('renders View transcript link', () => {
    renderWithProviders(
      <CreditBreakdown totalCredits={0} requiredCredits={0} />
    )

    const link = screen.getByText('View transcript')
    expect(link.closest('a')).toHaveAttribute('href', '/my/credits')
  })

  test('shows empty state when totalCredits is 0', () => {
    renderWithProviders(
      <CreditBreakdown totalCredits={0} requiredCredits={20} />
    )

    expect(screen.getByText('No credits yet')).toBeInTheDocument()
    expect(screen.getByText('Complete trainings and events to earn CPD credits')).toBeInTheDocument()
  })

  test('shows error message when isError is true', () => {
    renderWithProviders(
      <CreditBreakdown totalCredits={0} requiredCredits={0} isError />
    )

    expect(screen.getByText('Unable to load credit data')).toBeInTheDocument()
  })

  test('renders credit count and CreditRing when credits exist', () => {
    renderWithProviders(
      <CreditBreakdown totalCredits={15} requiredCredits={20} />
    )

    // CreditRing should render with aria-label
    expect(screen.getByRole('img', { name: '15 of 20 credits earned' })).toBeInTheDocument()
    // Deficit message
    expect(screen.getByText('5 more credits needed')).toBeInTheDocument()
  })

  test('shows "Requirement met" when credits meet requirement', () => {
    renderWithProviders(
      <CreditBreakdown totalCredits={20} requiredCredits={20} />
    )

    expect(screen.getByText('Requirement met')).toBeInTheDocument()
  })

  test('shows "total CPD credits" when no requirement set', () => {
    renderWithProviders(
      <CreditBreakdown totalCredits={10} requiredCredits={0} />
    )

    expect(screen.getByText('total CPD credits')).toBeInTheDocument()
  })

  test('shows singular "credit" for deficit of 1', () => {
    renderWithProviders(
      <CreditBreakdown totalCredits={19} requiredCredits={20} />
    )

    expect(screen.getByText('1 more credit needed')).toBeInTheDocument()
  })

  test('renders Earn more credits link when credits exist', () => {
    renderWithProviders(
      <CreditBreakdown totalCredits={5} requiredCredits={20} />
    )

    const link = screen.getByText('Earn more credits')
    expect(link.closest('a')).toHaveAttribute('href', '/my/training')
  })
})
