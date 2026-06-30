import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AddMemberDialog } from './AddMemberDialog'

// hoisted: vi.mock factories run before module-scope consts, so the mock targets
// must be created inside vi.hoisted to be referenceable.
const { toast, mutate } = vi.hoisted(() => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
  mutate: vi.fn(),
}))
vi.mock('sonner', () => ({ toast }))
vi.mock('../roster-import/use-tiers', () => ({
  useTiers: () => ({ tiers: [{ id: 't1', name: 'Regular', code: 'REG' }], loading: false }),
}))
vi.mock('../roster-import/use-import-roster', () => ({
  useImportRoster: () => ({ mutate, isPending: false }),
}))

beforeEach(() => vi.clearAllMocks())

function openDialog() {
  render(<AddMemberDialog orgId="o1" />)
  fireEvent.click(screen.getByRole('button', { name: 'Add member' }))
}
// Two "Add member" buttons exist once open (trigger + submit); the submit is last in the DOM.
const submitBtn = () => screen.getAllByRole('button', { name: /add member/i }).at(-1)!

describe('AddMemberDialog', () => {
  it('requires a first name + an identifier before calling the engine', () => {
    openDialog()
    fireEvent.click(submitBtn())
    expect(screen.getByRole('alert')).toHaveTextContent(/first name is required/i)
    expect(mutate).not.toHaveBeenCalled()
  })

  it('sends a single-row importRosterMembers payload and toasts success', () => {
    mutate.mockImplementation((_v, { onSuccess }) => onSuccess({ imported: 1, skipped: 0, failed: 0, errors: [] }))
    openDialog()
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Maria' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'maria@x.com' } })
    fireEvent.change(screen.getByLabelText('Membership tier'), { target: { value: 't1' } })
    fireEvent.click(submitBtn())
    expect(mutate).toHaveBeenCalledWith(
      { tierId: 't1', members: [{ firstName: 'Maria', lastName: undefined, email: 'maria@x.com', licenseNumber: undefined }] },
      expect.anything(),
    )
    expect(toast.success).toHaveBeenCalledWith('Added Maria')
  })

  it('treats a skipped row as "already a member"', () => {
    mutate.mockImplementation((_v, { onSuccess }) => onSuccess({ imported: 0, skipped: 1, failed: 0, errors: [] }))
    openDialog()
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Maria' } })
    fireEvent.change(screen.getByLabelText('License number'), { target: { value: 'LIC1' } })
    fireEvent.change(screen.getByLabelText('Membership tier'), { target: { value: 't1' } })
    fireEvent.click(submitBtn())
    expect(toast.info).toHaveBeenCalledWith('Maria is already a member')
  })

  it('surfaces a failed row error in the dialog and a toast', () => {
    mutate.mockImplementation((_v, { onSuccess }) => onSuccess({ imported: 0, skipped: 0, failed: 1, errors: [{ index: 0, error: 'bad email' }] }))
    openDialog()
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Maria' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'x' } })
    fireEvent.change(screen.getByLabelText('Membership tier'), { target: { value: 't1' } })
    fireEvent.click(submitBtn())
    expect(toast.error).toHaveBeenCalledWith('bad email')
    expect(screen.getByRole('alert')).toHaveTextContent('bad email')
  })
})
