import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'

vi.mock('@/features/auth/sign-in')
vi.mock('@/features/auth/use-session')
vi.mock('@/lib/api', () => ({ API_BASE: 'http://localhost/api' }))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (_path: string) => (opts: { component: React.ComponentType }) => opts,
  useNavigate: vi.fn(),
}))
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn(),
}))
vi.mock('@monobase/ui', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

import { signIn } from '@/features/auth/sign-in'
import { useSession } from '@/features/auth/use-session'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { SignInPage } from './sign-in'

describe('SignInPage', () => {
  const navigateMock = vi.fn()
  const invalidateQueriesMock = vi.fn()

  beforeEach(() => {
    vi.mocked(useNavigate).mockReturnValue(navigateMock)
    vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries: invalidateQueriesMock } as any)
    vi.mocked(useSession).mockReturnValue({ status: 'unauthed' })
    navigateMock.mockReset()
    invalidateQueriesMock.mockReset()
  })

  it('renders Operator sign in heading', () => {
    render(<SignInPage />)
    expect(screen.getByRole('heading', { name: /operator sign in/i })).toBeTruthy()
  })

  it('renders email and password inputs', () => {
    render(<SignInPage />)
    expect(screen.getByLabelText('Email')).toBeTruthy()
    expect(screen.getByLabelText('Password')).toBeTruthy()
  })

  it('on successful sign-in: calls signIn, invalidates session, navigates /', async () => {
    vi.mocked(signIn).mockResolvedValue({ ok: true })
    invalidateQueriesMock.mockResolvedValue(undefined)
    render(<SignInPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'op@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
    await act(async () => {
      fireEvent.submit(screen.getByText('Sign in').closest('form')!)
    })

    expect(signIn).toHaveBeenCalledWith('op@example.com', 'secret', 'http://localhost/api')
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['session'] })
    expect(navigateMock).toHaveBeenCalledWith({ to: '/' })
  })

  it('on failed sign-in: shows role=alert with error message', async () => {
    vi.mocked(signIn).mockResolvedValue({ ok: false, error: 'Invalid credentials' })
    render(<SignInPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'op@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } })
    await act(async () => {
      fireEvent.submit(screen.getByText('Sign in').closest('form')!)
    })

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('Invalid credentials')
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('authed user → navigate to /', async () => {
    vi.mocked(useSession).mockReturnValue({ status: 'authed' })
    await act(async () => {
      render(<SignInPage />)
    })
    expect(navigateMock).toHaveBeenCalledWith({ to: '/' })
  })
})
