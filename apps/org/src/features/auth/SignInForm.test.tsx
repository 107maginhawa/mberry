import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mockNavigate }))
vi.mock('sonner', () => ({ toast: { success: vi.fn() }, Toaster: () => null }))
vi.mock('@/features/auth/sign-in', () => ({ requestOtp: vi.fn(), verifyOtp: vi.fn() }))

import { requestOtp, verifyOtp } from '@/features/auth/sign-in'
import { SignInForm } from './SignInForm'

let queryClient: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

beforeEach(() => {
  vi.clearAllMocks()
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
})

describe('officer SignInForm (email-OTP)', () => {
  it('email step: labeled input, Send code, Step 1 of 2', () => {
    render(<SignInForm />, { wrapper })
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send code/i }).className).toMatch(/min-h-tap/)
    expect(screen.getByText(/step 1 of 2/i)).toBeInTheDocument()
  })

  it('requestOtp ok → advances to code step (Step 2 of 2)', async () => {
    vi.mocked(requestOtp).mockResolvedValue({ ok: true })
    render(<SignInForm />, { wrapper })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'olive@pda.ph' } })
    fireEvent.click(screen.getByRole('button', { name: /send code/i }))
    await waitFor(() => expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument())
    expect(screen.getByText(/step 2 of 2/i)).toBeInTheDocument()
  })

  it('requestOtp error → role=alert, stays on email step', async () => {
    vi.mocked(requestOtp).mockResolvedValue({ ok: false, error: 'Email not found' })
    render(<SignInForm />, { wrapper })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'bad@bad.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send code/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Email not found'))
    expect(screen.queryByLabelText(/6-digit code/i)).not.toBeInTheDocument()
  })

  it('verifyOtp ok → invalidate([session]) + navigate to roster (/)', async () => {
    vi.mocked(requestOtp).mockResolvedValue({ ok: true })
    render(<SignInForm />, { wrapper })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'olive@pda.ph' } })
    fireEvent.click(screen.getByRole('button', { name: /send code/i }))
    await waitFor(() => expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument())

    vi.mocked(verifyOtp).mockResolvedValue({ ok: true })
    fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: /verify & sign in/i }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/' }))
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['session'] })
  })
})
