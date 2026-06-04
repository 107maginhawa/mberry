/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from 'bun:test'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { Route } from '@/routes/associations/index'

const Page = Route.options.component as any

describe('Associations Page', () => {
  test('renders Associations heading', () => {
    renderWithProviders(<Page />)
    expect(screen.getByText('Associations')).toBeInTheDocument()
  })

  test('renders Create Association button', () => {
    renderWithProviders(<Page />)
    expect(screen.getByText('Create Association')).toBeInTheDocument()
  })

  test('renders table headers', () => {
    renderWithProviders(<Page />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Country')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  test('renders stat cards', () => {
    renderWithProviders(<Page />)
    expect(screen.getByText('Total Associations')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })
})
