import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor, within, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import type { ComponentType } from 'react'

// FIX-011 (G-12 / WF-012): the ID-card page hardcoded `memberships[0]`, so a
// member of multiple orgs could only ever see their first org's card despite a
// per-org backend (GET /persons/me/id-card/:orgId). This drives the page with a
// 2-org member and proves an org selector switches the rendered card.
//
// The page fetches via the raw `@/lib/api` client (not generated SDK hooks), so
// we mock that. PageShell/GlassCard are simplified to passthroughs to keep the
// render focused on the selector + card body.
//
// NOTE on assertions: the org selector keeps every org name in the DOM as an
// <option>, so org-name text is NOT unique. The per-org *category* ("Regular" /
// "Associate") only appears in the rendered card, so we use it as the switch
// signal; org names are only queried scoped to the selector.
//
// The page renders the @monobase/ui <Select> (Radix) — not testable in happy-dom
// without pointer polyfills — so we mock the Select family down to a native
// <select>/<option> here (the same pattern as training-form.test / event-form.test).
// This keeps the assertions driving the *real* org-switch logic, not a stub.
vi.mock('@monobase/ui', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Button: ({ children, onClick, ...props }: any) => (
    <button type="button" onClick={onClick} {...props}>{children}</button>
  ),
  Label: ({ htmlFor, children, ...props }: any) => <label htmlFor={htmlFor} {...props}>{children}</label>,
  // aria-label mirrors the component's <SelectTrigger aria-label="Select organization">
  Select: ({ children, value, onValueChange, ...props }: any) => (
    <select aria-label="Select organization" value={value ?? ''} onChange={(e) => onValueChange?.(e.target.value)} {...props}>{children}</select>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectTrigger: () => null,
  SelectValue: () => null,
}))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))
vi.mock('@/components/patterns/page-shell', () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/components/motion/glass-card', () => ({
  GlassCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { api } from '@/lib/api'
import { Route } from './id-card'

const MyIdCard = Route.options.component as ComponentType

const PERSON = { id: 'p1', firstName: 'Maria', lastName: 'Santos', licenseNumber: '0099999' }
const ORG1 = {
  id: 'm1',
  organizationId: 'org-1',
  organizationName: 'PDA Metro Manila',
  categoryName: 'Regular',
  status: 'active',
  memberNumber: 'PDA-001',
  duesExpiryDate: '2026-12-31',
}
const ORG2 = {
  id: 'm2',
  organizationId: 'org-2',
  organizationName: 'PDA Cebu Chapter',
  categoryName: 'Associate',
  status: 'gracePeriod',
  memberNumber: 'PDA-002',
  duesExpiryDate: '2026-06-30',
}

const mockGet = api.get as ReturnType<typeof vi.fn>

function primeMemberships(memberships: unknown[], idCardByOrg: Record<string, unknown> = {}) {
  mockGet.mockImplementation(async (path: string) => {
    if (path === '/api/persons/me') return PERSON
    if (path === '/api/persons/me/memberships') return { data: memberships }
    const idCardMatch = path.match(/^\/api\/persons\/me\/id-card\/([^/]+)$/)
    if (idCardMatch) return { data: idCardByOrg[idCardMatch[1]] ?? { verifyCredentialNumber: null } }
    throw new Error(`unexpected api.get path: ${path}`)
  })
}

describe('MyIdCard org selector (FIX-011)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('multi-org member sees an org selector with one option per membership', async () => {
    primeMemberships([ORG1, ORG2])

    renderWithProviders(<MyIdCard />)

    // Card loaded with the first org by default (category is card-only text).
    await screen.findByText('Regular')

    const selector = screen.getByRole('combobox', { name: /organization/i })
    expect(within(selector).getAllByRole('option')).toHaveLength(2)
    expect(within(selector).getByText('PDA Metro Manila')).toBeInTheDocument()
    expect(within(selector).getByText('PDA Cebu Chapter')).toBeInTheDocument()
  })

  test('switching the org renders the selected org\'s card', async () => {
    primeMemberships([ORG1, ORG2])

    renderWithProviders(<MyIdCard />)

    await screen.findByText('Regular') // org1 category in card

    const selector = screen.getByRole('combobox', { name: /organization/i })
    fireEvent.change(selector, { target: { value: 'org-2' } })

    // Card now shows org2's category; org1's is gone.
    await waitFor(() => expect(screen.getByText('Associate')).toBeInTheDocument())
    expect(screen.queryByText('Regular')).toBeNull()
  })

  test('single-org member shows no selector but still renders the card', async () => {
    primeMemberships([ORG1])

    renderWithProviders(<MyIdCard />)

    await screen.findByText('Regular')
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})

// FIX-001 (G1): the in-app QR used to encode `/verify/<memberNumber>` — a value
// no verify surface accepts (it resolves to a "not found" page) and which leaks
// the member number into a public URL. Until a verifiable digital credential
// exists for the membership, the card must NOT render a QR that always fails.
describe('MyIdCard QR verification chain (FIX-001)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('does NOT render a QR encoding the raw member number', async () => {
    primeMemberships([ORG1]) // ORG1 has no credentialNumber
    renderWithProviders(<MyIdCard />)
    await screen.findByText('Regular')
    expect(screen.queryByLabelText(/QR code to verify member/i)).toBeNull()
  })

  test('renders a verification QR when the membership carries a credential number', async () => {
    primeMemberships([{ ...ORG1, credentialNumber: 'CRED-123' }])
    renderWithProviders(<MyIdCard />)
    await screen.findByText('Regular')
    const qr = await screen.findByLabelText(/QR code to verify credential CRED-123/i)
    expect(qr).toBeInTheDocument()
  })

  test('renders a verification QR from the backend card builder verifyCredentialNumber', async () => {
    // Batch A2: the backend lazily issues a member-card credential and returns its
    // number via getMyIdCard; the UI consumes that for the QR.
    primeMemberships([ORG1], { 'org-1': { verifyCredentialNumber: 'MC-FROMAPI' } })
    renderWithProviders(<MyIdCard />)
    await screen.findByText('Regular')
    const qr = await screen.findByLabelText(/QR code to verify credential MC-FROMAPI/i)
    expect(qr).toBeInTheDocument()
  })
})
