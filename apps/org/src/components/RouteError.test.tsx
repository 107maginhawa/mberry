import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouteError } from './RouteError'

// Link mocked as a plain anchor — presentational test, navigation is E2E-covered.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
}))

beforeEach(() => {
  // RouteError console.errors the raw error for devs — silence it in tests.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

it('renders the friendly message, NOT the raw error string', () => {
  const error = new Error('SECRET_STACK: undefined is not an object (sdk drift)')
  render(<RouteError error={error} reset={() => {}} />)
  expect(screen.getByText('Something went wrong on this page.')).toBeInTheDocument()
  // Plain-language law: the raw error message must never reach the user.
  expect(screen.queryByText(/SECRET_STACK/)).not.toBeInTheDocument()
})

it('calls reset() when the retry control is activated', async () => {
  const reset = vi.fn()
  const user = userEvent.setup()
  render(<RouteError error={new Error('boom')} reset={reset} />)
  await user.click(screen.getByRole('button', { name: /try again/i }))
  expect(reset).toHaveBeenCalledTimes(1)
})
