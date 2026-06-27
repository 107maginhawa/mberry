import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

vi.mock('@monobase/ui', () => ({
  Button: ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => (
    <button onClick={onClick} className={className}>{children}</button>
  ),
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TableCell: ({ children }: { children: React.ReactNode }) => <td>{children}</td>,
  Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className} />,
  // Use en-US locale (always available in Node.js) so commas are predictable
  centavosToPhp: (amount: number) =>
    '₱' + (amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
}))

import OrgsView from './OrgsView'
import type { OrgRow } from './use-orgs'
import type { PlatformStats } from './use-platform-stats'

const sampleOrg: OrgRow = {
  id: 'o1',
  name: 'Olive Dental Chapter',
  region: 'NCR',
  orgType: 'chapter',
  status: 'trial',
  createdAt: '2026-06-01',
}

const sampleStats: PlatformStats = {
  totalMembers: 100,
  activeMembers: 80,
  totalRevenueCents: 200000,
  avgCollectionRate: 75,
}

const zeroStats: PlatformStats = {
  totalMembers: 0,
  activeMembers: 0,
  totalRevenueCents: 0,
  avgCollectionRate: 0,
}

describe('OrgsView', () => {
  it('Organizations tile shows total', () => {
    render(
      <OrgsView
        orgs={[sampleOrg]} total={5} orgsStatus="ready"
        associationsCount={3} stats={sampleStats} statsStatus="ready"
        hasSnapshot={true} onCreate={vi.fn()}
      />,
    )
    expect(screen.getByText('5')).toBeTruthy()
  })

  it('Associations tile shows associationsCount', () => {
    render(
      <OrgsView
        orgs={[sampleOrg]} total={1} orgsStatus="ready"
        associationsCount={3} stats={sampleStats} statsStatus="ready"
        hasSnapshot={true} onCreate={vi.fn()}
      />,
    )
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('when hasSnapshot=true: Revenue shows centavosToPhp(200000), no NaN', () => {
    const { container } = render(
      <OrgsView
        orgs={[sampleOrg]} total={1} orgsStatus="ready"
        associationsCount={1} stats={sampleStats} statsStatus="ready"
        hasSnapshot={true} onCreate={vi.fn()}
      />,
    )
    // centavosToPhp(200000) with en-US locale = ₱2,000.00
    expect(screen.getByText('₱2,000.00')).toBeTruthy()
    expect(container.innerHTML).not.toMatch(/NaN/)
  })

  it('when hasSnapshot=false: snapshot tiles show em-dash + "No snapshot" text, NOT ₱0.00', () => {
    const { container } = render(
      <OrgsView
        orgs={[]} total={0} orgsStatus="ready"
        associationsCount={0} stats={zeroStats} statsStatus="ready"
        hasSnapshot={false} onCreate={vi.fn()}
      />,
    )
    // Em-dashes must appear for snapshot-derived tiles
    const emDashes = screen.getAllByText('—')
    expect(emDashes.length).toBeGreaterThan(0)
    // Empty-state helper text must appear
    expect(screen.getByText(/No snapshot/i)).toBeTruthy()
    // ₱0.00 must NOT appear (confident zero for a snapshot-derived tile is misleading)
    expect(screen.queryByText('₱0.00')).toBeNull()
    // No NaN anywhere
    expect(container.innerHTML).not.toMatch(/NaN/)
  })

  it('no NaN in rendered output when hasSnapshot=false (I1 guard)', () => {
    const { container } = render(
      <OrgsView
        orgs={[]} total={0} orgsStatus="ready"
        associationsCount={undefined} stats={zeroStats} statsStatus="ready"
        hasSnapshot={false} onCreate={vi.fn()}
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN/)
  })

  it('org table lists org names', () => {
    render(
      <OrgsView
        orgs={[sampleOrg]} total={1} orgsStatus="ready"
        associationsCount={1} stats={sampleStats} statsStatus="ready"
        hasSnapshot={true} onCreate={vi.fn()}
      />,
    )
    expect(screen.getByText('Olive Dental Chapter')).toBeTruthy()
  })

  it('"Create organization" button calls onCreate', () => {
    const onCreate = vi.fn()
    render(
      <OrgsView
        orgs={[]} total={0} orgsStatus="ready"
        associationsCount={0} stats={zeroStats} statsStatus="ready"
        hasSnapshot={false} onCreate={onCreate}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /create organization/i }))
    expect(onCreate).toHaveBeenCalledOnce()
  })
})
