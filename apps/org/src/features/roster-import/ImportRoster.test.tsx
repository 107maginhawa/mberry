// apps/org/src/features/roster-import/ImportRoster.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImportRosterView, type ImportRosterViewProps } from './ImportRoster'

// Mock Link as a plain anchor — unit tests for presentational components
// don't need a full router; navigation is tested at E2E layer.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
}))

const base: ImportRosterViewProps = {
  tiers: [{ id: 't1', name: 'Regular', code: 'REGULAR' }],
  tiersLoading: false,
  tierId: '',
  onTierChange: () => {},
  onFile: () => {},
  fileError: null,
  parsed: null,
  onImport: () => {},
  importing: false,
  result: null,
  importError: null,
}

describe('ImportRosterView', () => {
  it('disables Import until a tier and a parsed file with rows exist', () => {
    render(<ImportRosterView {...base} />)
    expect(screen.getByRole('button', { name: /import/i })).toBeDisabled()
  })

  it('enables Import and shows preview counts when tier + rows are present', () => {
    render(
      <ImportRosterView
        {...base}
        tierId="t1"
        parsed={{ rows: [{ email: 'a@x.ph', firstName: 'A' }], stats: { total: 1, missingIdentifier: 0, missingName: 0 } }}
      />,
    )
    expect(screen.getByText(/1 member.*found/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /import 1 member/i })).toBeEnabled()
  })

  it('blocks import and warns when over the 500-row cap', () => {
    const rows = Array.from({ length: 501 }, (_, i) => ({ email: `m${i}@x.ph` }))
    render(
      <ImportRosterView
        {...base}
        tierId="t1"
        parsed={{ rows, stats: { total: 501, missingIdentifier: 0, missingName: 0 } }}
      />,
    )
    expect(screen.getByRole('button', { name: /import/i })).toBeDisabled()
    expect(screen.getByText(/500/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('renders a file error with role=alert', () => {
    render(<ImportRosterView {...base} fileError="CSV must include an email or licenseNumber column." />)
    expect(screen.getByRole('alert')).toHaveTextContent(/email or licenseNumber/i)
  })

  it('shows advisories for rows missing an identifier', () => {
    render(
      <ImportRosterView
        {...base}
        tierId="t1"
        parsed={{ rows: [{ firstName: 'NoId' }], stats: { total: 1, missingIdentifier: 1, missingName: 0 } }}
      />,
    )
    expect(screen.getByText(/1.*no email or license/i)).toBeInTheDocument()
  })

  it('renders the result summary with imported/skipped/failed and row errors', () => {
    render(
      <ImportRosterView
        {...base}
        tierId="t1"
        result={{ imported: 3, skipped: 1, failed: 1, errors: [{ index: 4, error: 'firstName is required to create a new member' }] }}
      />,
    )
    expect(screen.getByText(/3 new members added/i)).toBeInTheDocument()
    expect(screen.getByText(/1 already a member/i)).toBeInTheDocument()
    expect(screen.getByText(/1 row failed/i)).toBeInTheDocument()
    expect(screen.getByText(/row 5/i)).toBeInTheDocument() // index 4 → "Row 5"
  })

  it('surfaces a server import error with role=alert', () => {
    render(<ImportRosterView {...base} tierId="t1" importError="Importing the roster needs a Secretary or President position." />)
    expect(screen.getByRole('alert')).toHaveTextContent(/Secretary or President/i)
  })

  it('calls onImport when the enabled button is clicked', async () => {
    const onImport = vi.fn()
    render(
      <ImportRosterView
        {...base}
        tierId="t1"
        onImport={onImport}
        parsed={{ rows: [{ email: 'a@x.ph' }], stats: { total: 1, missingIdentifier: 0, missingName: 0 } }}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /import/i }))
    expect(onImport).toHaveBeenCalledOnce()
  })
})
