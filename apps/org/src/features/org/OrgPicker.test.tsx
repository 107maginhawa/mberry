import { it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const setOrgId = vi.fn()
vi.mock('./use-org', () => ({
  useOrgs: () => ({ status: 'ready', orgs: [{ id: 'o1', name: 'Chapter A' }, { id: 'o2', name: 'Chapter B' }] }),
  useSelectedOrg: () => ({ orgId: 'o1', setOrgId }),
}))

import { OrgPicker } from './OrgPicker'

it('renders an accessible select listing every org as an option', () => {
  render(<OrgPicker />)
  const select = screen.getByLabelText('Select organisation')
  expect(select).toBeInTheDocument()
  expect(screen.getByRole('combobox')).toBe(select)
  expect(screen.getByRole('option', { name: 'Chapter A' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Chapter B' })).toBeInTheDocument()
})

it('reflects the currently selected org', () => {
  render(<OrgPicker />)
  expect((screen.getByLabelText('Select organisation') as HTMLSelectElement).value).toBe('o1')
})

it('calls setOrgId with the new org id on change', async () => {
  const user = userEvent.setup()
  render(<OrgPicker />)
  await user.selectOptions(screen.getByLabelText('Select organisation'), 'o2')
  expect(setOrgId).toHaveBeenCalledWith('o2')
})
