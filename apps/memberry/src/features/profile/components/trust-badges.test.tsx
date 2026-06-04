import { describe, it, expect } from 'bun:test'
import { renderWithProviders, screen } from '@/test/utils'
import { TrustBadges, type TrustSignals } from './trust-badges'

describe('TrustBadges', () => {
  const fullSignals: TrustSignals = {
    duesStatus: 'current',
    credentialCount: 3,
    ceCreditsEarned: 12,
    hasVerifiedLicense: true,
  }

  it('renders "Current" badge when dues are current', () => {
    renderWithProviders(<TrustBadges signals={fullSignals} />)
    expect(screen.getByText('Current')).toBeDefined()
    expect(screen.getByLabelText('Dues current')).toBeDefined()
  })

  it('renders CE credit count', () => {
    renderWithProviders(<TrustBadges signals={fullSignals} />)
    expect(screen.getByText('12 CE')).toBeDefined()
    expect(screen.getByLabelText('12 continuing education credits')).toBeDefined()
  })

  it('renders verified license shield', () => {
    renderWithProviders(<TrustBadges signals={fullSignals} />)
    expect(screen.getByLabelText('Verified license')).toBeDefined()
  })

  it('renders credential count', () => {
    renderWithProviders(<TrustBadges signals={fullSignals} />)
    expect(screen.getByText('3 credentials')).toBeDefined()
  })

  it('renders singular credential label', () => {
    renderWithProviders(
      <TrustBadges signals={{ ...fullSignals, credentialCount: 1 }} />
    )
    expect(screen.getByText('1 credential')).toBeDefined()
  })

  it('renders nothing when all signals empty', () => {
    const emptySignals: TrustSignals = {
      duesStatus: null,
      credentialCount: 0,
      ceCreditsEarned: 0,
      hasVerifiedLicense: false,
    }
    const { container } = renderWithProviders(<TrustBadges signals={emptySignals} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when signals undefined', () => {
    const { container } = renderWithProviders(<TrustBadges signals={undefined} />)
    expect(container.innerHTML).toBe('')
  })
})
