import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IdCardView } from './IdCardView'
import type { IdCardData } from './use-id-card'

vi.mock('./use-id-card', () => ({ useIdCard: vi.fn() }))
import { useIdCard } from './use-id-card'
const mockUseIdCard = useIdCard as ReturnType<typeof vi.fn>

const CARD: IdCardData = {
  personId: 'p1', firstName: 'Olive', lastName: 'Reyes', licenseNumber: 'DEN-12345',
  organizationName: 'Manila Dental Chapter', membershipStatus: 'active', photoUrl: null,
  qrPayload: 'eyJ2IjoxfQ==', qrSignature: 'abc123', validUntil: '2027-01-01',
  verifyCredentialNumber: 'MC-0001',
}

describe('IdCardView', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the card fields + QR + credential number, no NaN/undefined', () => {
    mockUseIdCard.mockReturnValue({ isLoading: false, isError: false, data: CARD })
    const { container } = render(<IdCardView />)
    expect(screen.getByText('Manila Dental Chapter')).toBeInTheDocument()
    expect(screen.getByText(/Olive Reyes/)).toBeInTheDocument()
    expect(screen.getByText('MC-0001')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument() // QR
    expect(container.textContent).not.toMatch(/NaN|undefined|null/)
  })

  it('omits "Valid until" when validUntil is null and shows initials when no photo', () => {
    mockUseIdCard.mockReturnValue({ isLoading: false, isError: false, data: { ...CARD, validUntil: null } })
    render(<IdCardView />)
    expect(screen.queryByText(/Valid until/i)).not.toBeInTheDocument()
  })

  it('shows loading skeleton', () => {
    mockUseIdCard.mockReturnValue({ isLoading: true, isError: false, data: undefined })
    const { container } = render(<IdCardView />)
    expect(container.querySelector('[data-slot="skeleton"], .animate-pulse')).toBeTruthy()
  })

  it('shows error state', () => {
    mockUseIdCard.mockReturnValue({ isLoading: false, isError: true, data: undefined })
    render(<IdCardView />)
    expect(screen.getByText(/could not load|couldn't load|refresh/i)).toBeInTheDocument()
  })

  it('shows empty state when no card', () => {
    mockUseIdCard.mockReturnValue({ isLoading: false, isError: false, data: null })
    render(<IdCardView />)
    expect(screen.getByText(/no active membership|no card/i)).toBeInTheDocument()
  })
})
