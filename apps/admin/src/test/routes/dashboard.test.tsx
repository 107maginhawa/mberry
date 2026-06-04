/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from 'bun:test'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { Route } from '@/routes/index'

const Page = Route.options.component as any

describe('Dashboard Page', () => {
  test('renders Platform Dashboard heading', () => {
    renderWithProviders(<Page />)
    expect(screen.getByText('Platform Dashboard')).toBeInTheDocument()
  })

  test('renders Platform Health section with stat cards', () => {
    renderWithProviders(<Page />)
    expect(screen.getByText('Platform Health')).toBeInTheDocument()
    expect(screen.getByText('Associations')).toBeInTheDocument()
    expect(screen.getByText('Organizations')).toBeInTheDocument()
    expect(screen.getByText('Active Events')).toBeInTheDocument()
    expect(screen.getByText('Operators')).toBeInTheDocument()
  })

  test('renders Refresh button', () => {
    renderWithProviders(<Page />)
    expect(screen.getByText('Refresh')).toBeInTheDocument()
  })
})
