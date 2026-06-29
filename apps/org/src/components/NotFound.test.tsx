import { it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotFound } from './NotFound'

// Link mocked as a plain anchor — presentational test, navigation is E2E-covered.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
}))

it('renders the not-found message', () => {
  render(<NotFound />)
  expect(screen.getByText('Page not found')).toBeInTheDocument()
})

it('offers a link home (to the roster)', () => {
  render(<NotFound />)
  const link = screen.getByRole('link', { name: /go to roster/i })
  expect(link).toBeInTheDocument()
  expect(link).toHaveAttribute('href', '/')
})
