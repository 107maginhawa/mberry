import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

/**
 * Mock @monobase/ui with simplified HTML elements so tests run in JSDOM
 * without Radix UI portal/animation issues.
 * Select → native <select> (receives aria-label passed through),
 * SelectItem → <option>, SelectTrigger/SelectValue/SelectContent → pass-through / null.
 */
vi.mock('@monobase/ui', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
    className,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    type?: string
    className?: string
  }) => (
    <button onClick={onClick} disabled={disabled} type={type as 'button' | 'submit' | 'reset' | undefined} className={className}>
      {children}
    </button>
  ),
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Input: ({ id, value, onChange, required, className, placeholder, type }: {
    id?: string; value?: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    required?: boolean; className?: string; placeholder?: string; type?: string
  }) => (
    <input id={id} value={value} onChange={onChange} required={required} className={className} placeholder={placeholder} type={type} />
  ),
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
  // Select mocked as native <select>; passes aria-label for accessible queries in tests.
  Select: ({ children, onValueChange, value, 'aria-label': ariaLabel }: {
    children: React.ReactNode
    onValueChange?: (v: string) => void
    value?: string
    'aria-label'?: string
  }) => (
    <select aria-label={ariaLabel} value={value ?? ''} onChange={(e) => onValueChange?.(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
}))

import CreateOrgView from './CreateOrgView'
import type { AssocRow } from './use-associations'

const sampleAssociations: AssocRow[] = [
  { id: 'a1', name: 'Philippine Dental Association' },
  { id: 'a2', name: 'PMA National' },
]

describe('CreateOrgView', () => {
  it('renders association options from associations prop', () => {
    render(
      <CreateOrgView associations={sampleAssociations} onSubmit={vi.fn()} pending={false} error="" />,
    )
    expect(screen.getByRole('option', { name: 'Philippine Dental Association' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'PMA National' })).toBeTruthy()
  })

  it('renders all 4 orgType options', () => {
    render(
      <CreateOrgView associations={sampleAssociations} onSubmit={vi.fn()} pending={false} error="" />,
    )
    expect(screen.getByRole('option', { name: /^chapter$/i })).toBeTruthy()
    expect(screen.getByRole('option', { name: /^society$/i })).toBeTruthy()
    expect(screen.getByRole('option', { name: /^national$/i })).toBeTruthy()
    expect(screen.getByRole('option', { name: /^clinic$/i })).toBeTruthy()
  })

  it('submitting calls onSubmit with field values', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <CreateOrgView associations={sampleAssociations} onSubmit={onSubmit} pending={false} error="" />,
    )

    // Name input
    fireEvent.change(screen.getByLabelText(/name \*/i), { target: { value: 'Test Chapter' } })

    // Association select (aria-label="Association")
    fireEvent.change(screen.getByRole('combobox', { name: /association/i }), {
      target: { value: 'a1' },
    })

    // OrgType select (aria-label="Type")
    fireEvent.change(screen.getByRole('combobox', { name: /type/i }), {
      target: { value: 'society' },
    })

    // Submit button click triggers form submit
    fireEvent.click(screen.getByRole('button', { name: /create organization/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Chapter',
          associationId: 'a1',
          orgType: 'society',
        }),
      )
    })
  })

  it('shows error prop via role=alert', () => {
    render(
      <CreateOrgView
        associations={sampleAssociations}
        onSubmit={vi.fn()}
        pending={false}
        error="Org name taken"
      />,
    )
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Org name taken')
  })

  it('submit button disabled and shows "Creating…" while pending', () => {
    render(
      <CreateOrgView associations={sampleAssociations} onSubmit={vi.fn()} pending={true} error="" />,
    )
    const btn = screen.getByRole('button', { name: /creating/i })
    expect(btn).toBeDisabled()
  })

  it('empty associations: shows role=alert notice + submit disabled', () => {
    render(
      <CreateOrgView associations={[]} onSubmit={vi.fn()} pending={false} error="" />,
    )
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Seed an association first')
    expect(screen.getByRole('button', { name: /create organization/i })).toBeDisabled()
  })
})
