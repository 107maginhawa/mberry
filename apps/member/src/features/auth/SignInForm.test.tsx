import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// ── module mocks (must precede imports of the module under test) ──────────────

const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
  Toaster: () => null,
}))

vi.mock('@/features/auth/sign-in', () => ({
  requestOtp: vi.fn(),
  verifyOtp: vi.fn(),
}))

// import AFTER mocks
import { requestOtp, verifyOtp } from '@/features/auth/sign-in'
import { toast } from 'sonner'
import { SignInForm } from './SignInForm'

// ── test harness ──────────────────────────────────────────────────────────────

let queryClient: QueryClient

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

beforeEach(() => {
  vi.clearAllMocks()
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
})

// ── email step ────────────────────────────────────────────────────────────────

describe('email step', () => {
  it('renders labeled email input and Send code button', () => {
    render(<SignInForm />, { wrapper })
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send code/i })).toBeInTheDocument()
  })

  it('button and input meet the ≥48px tap-target floor', () => {
    render(<SignInForm />, { wrapper })
    const btn = screen.getByRole('button', { name: /send code/i })
    expect(btn.className).toMatch(/min-h-tap/)
    // shared Input enforces the 48px floor via h-12 (DESIGN.md a11y baseline)
    const input = screen.getByLabelText(/email/i)
    expect(input.className).toMatch(/h-12/)
  })

  it('requestOtp ok → advances to code step + toast', async () => {
    vi.mocked(requestOtp).mockResolvedValue({ ok: true })
    render(<SignInForm />, { wrapper })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'dr@pda.ph' } })
    fireEvent.click(screen.getByRole('button', { name: /send code/i }))
    await waitFor(() => expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument())
    expect(toast.success).toHaveBeenCalledWith('Code sent to your email')
    expect(screen.queryByRole('button', { name: /^send code$/i })).not.toBeInTheDocument()
  })

  it('requestOtp error → role=alert shown, stays on email step', async () => {
    vi.mocked(requestOtp).mockResolvedValue({ ok: false, error: 'Email not found' })
    render(<SignInForm />, { wrapper })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'bad@bad.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send code/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent('Email not found')
    // still on email step
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/6-digit code/i)).not.toBeInTheDocument()
  })

  it('copy mentions the code is sent by email', () => {
    render(<SignInForm />, { wrapper })
    // The heading or description should reference email
    expect(screen.getByText(/email/i)).toBeInTheDocument()
  })

  it('shows "Step 1 of 2" on the email step (multi-step indicator, DESIGN.md)', () => {
    render(<SignInForm />, { wrapper })
    expect(screen.getByText(/step 1 of 2/i)).toBeInTheDocument()
  })
})

// ── code step ─────────────────────────────────────────────────────────────────

describe('code step', () => {
  async function advanceToCodeStep() {
    vi.mocked(requestOtp).mockResolvedValue({ ok: true })
    render(<SignInForm />, { wrapper })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'dr@pda.ph' } })
    fireEvent.click(screen.getByRole('button', { name: /send code/i }))
    await waitFor(() => expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument())
    vi.clearAllMocks()
  }

  it('renders labeled code input and Verify & sign in button', async () => {
    await advanceToCodeStep()
    expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /verify & sign in/i })).toBeInTheDocument()
  })

  it('Verify & sign in button has min-h-tap class', async () => {
    await advanceToCodeStep()
    const btn = screen.getByRole('button', { name: /verify & sign in/i })
    expect(btn.className).toMatch(/min-h-tap/)
  })

  it('copy mentions email', async () => {
    await advanceToCodeStep()
    expect(screen.getByText(/email/i)).toBeInTheDocument()
  })

  it('shows "Step 2 of 2" on the code step (multi-step indicator, DESIGN.md)', async () => {
    await advanceToCodeStep()
    expect(screen.getByText(/step 2 of 2/i)).toBeInTheDocument()
  })

  it('verifyOtp ok → invalidateQueries([session]) + navigate(/dashboard)', async () => {
    await advanceToCodeStep()
    vi.mocked(verifyOtp).mockResolvedValue({ ok: true })
    fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: /verify & sign in/i }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/dashboard' }))
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['session'] })
  })

  it('verifyOtp error → role=alert shown, stays on code step', async () => {
    await advanceToCodeStep()
    vi.mocked(verifyOtp).mockResolvedValue({ ok: false, error: 'Invalid OTP' })
    fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: /verify & sign in/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid OTP')
    // still on code step
    expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('Resend code calls requestOtp again', async () => {
    await advanceToCodeStep()
    vi.mocked(requestOtp).mockResolvedValue({ ok: true })
    fireEvent.click(screen.getByRole('button', { name: /resend code/i }))
    await waitFor(() => expect(requestOtp).toHaveBeenCalledTimes(1))
    expect(toast.success).toHaveBeenCalledWith('Code sent to your email')
  })
})
