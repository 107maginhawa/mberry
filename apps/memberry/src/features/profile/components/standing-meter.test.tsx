import { describe, it, expect } from 'vitest'
import { act } from '@testing-library/react'
import { renderWithProviders, screen } from '@/test/utils'
import { StandingMeter, type StandingMeterProps } from './standing-meter'

describe('StandingMeter', () => {
  const minimalPerson: StandingMeterProps['person'] = {
    firstName: 'Jane',
    lastName: 'Doe',
  }

  const completePerson: StandingMeterProps['person'] = {
    firstName: 'Jane',
    lastName: 'Doe',
    avatar: { url: 'https://example.com/photo.jpg' },
    licenseNumber: 'PRC-12345',
    specialization: 'Orthodontics',
    contactInfo: { phone: '+63 917 123 4567' },
    bio: 'Practicing for 10 years',
  }

  it('shows Beginner tier for minimal profile', () => {
    renderWithProviders(<StandingMeter person={minimalPerson} />)
    expect(screen.getByText('Beginner')).toBeDefined()
  })

  it('shows correct completion percentage for minimal profile', () => {
    // Only name complete (1 criterion) = 1/7
    renderWithProviders(<StandingMeter person={minimalPerson} />)
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar.getAttribute('aria-valuenow')).toBe('1')
    expect(progressBar.getAttribute('aria-valuemax')).toBe('7')
  })

  it('shows Verified tier when most criteria met', () => {
    renderWithProviders(<StandingMeter person={completePerson} />)
    expect(screen.getByText('Verified')).toBeDefined()
  })

  it('shows Exemplary tier when all criteria met including dues', () => {
    renderWithProviders(<StandingMeter person={completePerson} duesStatus="current" />)
    expect(screen.getByText('Exemplary')).toBeDefined()
  })

  it('lists pending items', () => {
    renderWithProviders(<StandingMeter person={minimalPerson} />)
    expect(screen.getByText('Upload profile photo')).toBeDefined()
    expect(screen.getByText('Add license number')).toBeDefined()
  })

  it('does not show completed items as pending', () => {
    renderWithProviders(<StandingMeter person={completePerson} />)
    expect(screen.queryByText('Upload profile photo')).toBeNull()
    expect(screen.queryByText('Add license number')).toBeNull()
  })

  it('can be dismissed', () => {
    const { container } = renderWithProviders(<StandingMeter person={minimalPerson} />)
    const dismissBtn = screen.getByLabelText('Dismiss standing meter')
    act(() => { dismissBtn.click() })
    expect(container.innerHTML).toBe('')
  })

  it('shows benefit nudge for non-verified members', () => {
    renderWithProviders(<StandingMeter person={minimalPerson} />)
    expect(screen.getByText(/Verified members appear in the public directory/)).toBeDefined()
  })
})
