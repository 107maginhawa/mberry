import { describe, it, expect } from 'vitest'
import { membersToCsv, type ExportMember } from './members-csv'

const m = (o: Partial<ExportMember> = {}): ExportMember => ({
  name: 'Maria Santos', memberNumber: 'A-1', joinedAt: '2019-05-01T00:00:00Z',
  status: 'active', duesExpiryDate: '2026-01-12T00:00:00Z', unpaid: false, ...o,
})

describe('membersToCsv', () => {
  it('emits the header and one row per member with friendly status + Paid/Unpaid + ISO dates', () => {
    const csv = membersToCsv([m(), m({ name: 'Jose Cruz', memberNumber: 'A-2', status: 'pendingPayment', unpaid: true })])
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('Name,Member number,Member since,Status,Renews,Dues')
    expect(lines[1]).toBe('Maria Santos,A-1,2019-05-01,Active,2026-01-12,Paid')
    expect(lines[2]).toBe('Jose Cruz,A-2,2019-05-01,Pending,2026-01-12,Unpaid')
  })

  it('RFC-4180 quotes a name containing a comma or a quote', () => {
    expect(membersToCsv([m({ name: 'Santos, Maria' })]).split('\r\n')[1]).toMatch(/^"Santos, Maria",/)
    expect(membersToCsv([m({ name: 'Jo"e' })]).split('\r\n')[1]).toMatch(/^"Jo""e",/)
  })

  it('neutralises spreadsheet formula injection (=, +, -, @)', () => {
    expect(membersToCsv([m({ name: '=SUM(A1:A9)' })]).split('\r\n')[1]).toMatch(/^'=SUM\(A1:A9\),/)
    expect(membersToCsv([m({ name: '@cmd' })]).split('\r\n')[1]).toMatch(/^'@cmd,/)
  })

  it('a name that is both injection-risky AND has a comma is escaped then quoted', () => {
    // leading '=' → prefix ' ; then the comma forces quoting → "'=a,b"
    expect(membersToCsv([m({ name: '=a,b' })]).split('\r\n')[1]).toMatch(/^"'=a,b",/)
  })

  it('treats the epoch-coerced null date (1970) as a blank cell', () => {
    // the roster transformer turns a null date into new Date(0) — not a real renewal date
    expect(membersToCsv([m({ duesExpiryDate: new Date(0) })]).split('\r\n')[1])
      .toBe('Maria Santos,A-1,2019-05-01,Active,,Paid')
  })

  it('empty roster yields just the header', () => {
    expect(membersToCsv([])).toBe('Name,Member number,Member since,Status,Renews,Dues')
  })

  it('blank dates / missing member number render as empty cells', () => {
    expect(membersToCsv([m({ memberNumber: null, joinedAt: null, duesExpiryDate: null })]).split('\r\n')[1])
      .toBe('Maria Santos,,,Active,,Paid')
  })
})
