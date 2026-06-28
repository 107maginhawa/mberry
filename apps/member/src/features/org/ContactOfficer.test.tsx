import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('./use-member-org-profile', () => ({
  useMemberOrgProfile: vi.fn(),
}))

import { useMemberOrgProfile } from './use-member-org-profile'
import { ContactOfficer } from './ContactOfficer'

function mockProfile(data: unknown) {
  vi.mocked(useMemberOrgProfile).mockReturnValue({ data } as any)
}

beforeEach(() => vi.clearAllMocks())

describe('ContactOfficer', () => {
  it('renders nothing when there is no contact info', () => {
    mockProfile({ name: 'Olive', contactEmail: null, phone: null, website: null })
    const { container } = render(<ContactOfficer />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing while the profile is still loading (no data)', () => {
    mockProfile(undefined)
    const { container } = render(<ContactOfficer />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders an actionable tel: link with spaces stripped from the number', () => {
    mockProfile({ name: 'Olive Dental Chapter', contactEmail: null, phone: '0917 123 4567', website: null })
    render(<ContactOfficer />)
    const tel = screen.getByRole('link', { name: /call/i })
    expect(tel.getAttribute('href')).toBe('tel:09171234567')
  })

  it('renders an actionable mailto: link', () => {
    mockProfile({ name: 'Olive', contactEmail: 'officer@olive.ph', phone: null, website: null })
    render(<ContactOfficer />)
    const mail = screen.getByRole('link', { name: /email/i })
    expect(mail.getAttribute('href')).toBe('mailto:officer@olive.ph')
  })

  it('shows only the channels that exist (email only → no call link)', () => {
    mockProfile({ name: 'Olive', contactEmail: 'officer@olive.ph', phone: null, website: null })
    render(<ContactOfficer />)
    expect(screen.queryByRole('link', { name: /call/i })).toBeNull()
    expect(screen.getByRole('link', { name: /email/i })).toBeTruthy()
  })

  it('names the chapter so the member knows who they are contacting', () => {
    mockProfile({ name: 'Olive Dental Chapter', contactEmail: 'officer@olive.ph', phone: null, website: null })
    render(<ContactOfficer />)
    expect(screen.getByText(/Olive Dental Chapter/)).toBeTruthy()
  })
})
