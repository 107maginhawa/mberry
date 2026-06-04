/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from 'bun:test'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { Route } from '@/routes/members/index'

const Page = Route.options.component as any

describe('Members Page', () => {
  test('renders Members heading', () => {
    renderWithProviders(<Page />)
    expect(screen.getByText('Members')).toBeInTheDocument()
  })

  test('renders page description', () => {
    renderWithProviders(<Page />)
    expect(
      screen.getByText('Search and manage platform members across all organizations'),
    ).toBeInTheDocument()
  })

  test('renders search input', () => {
    renderWithProviders(<Page />)
    expect(screen.getByPlaceholderText('Search by name, email...')).toBeInTheDocument()
  })

  test('renders table headers', () => {
    renderWithProviders(<Page />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Organization')).toBeInTheDocument()
    expect(screen.getByText('Role')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  test('shows empty state when no members', async () => {
    renderWithProviders(<Page />)
    await waitFor(() => {
      expect(screen.getByText('No members found.')).toBeInTheDocument()
    })
  })
})
