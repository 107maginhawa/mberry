import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

const mockInvalidate = vi.fn().mockResolvedValue(undefined)
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}))

vi.mock('./sign-in', () => ({
  signOut: vi.fn().mockResolvedValue({ ok: true }),
}))

import { signOut } from './sign-in'
import { SignOutButton } from './SignOutButton'

beforeEach(() => vi.clearAllMocks())

describe('SignOutButton', () => {
  it('renders a labeled Sign out control (≥48px default Button)', () => {
    render(<SignOutButton />)
    expect(screen.getByRole('button', { name: /sign out/i })).toBeTruthy()
  })

  it('click signs out, invalidates the session, and redirects to /sign-in', async () => {
    render(<SignOutButton />)
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/sign-in' }))
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['session'] })
  })
})
