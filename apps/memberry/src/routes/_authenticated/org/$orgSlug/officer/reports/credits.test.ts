import { describe, test, expect } from '@/test/vitest-shim'
import { buildComplianceCsv, type ComplianceRow } from './credits'

/**
 * FIX-012 (10.7): officers need an exportable compliance report for
 * regulators. The standings rows are already loaded client-side, so the
 * export is a pure transform from rows → CSV text. These tests lock the CSV
 * shape (header + one line per member, with the category breakdown and
 * compliance verdict) so the regulator-facing file is correct.
 */
const ROWS: ComplianceRow[] = [
  {
    person_id: 'p1',
    first_name: 'Maria',
    last_name: 'Santos',
    member_number: 'PDA-001',
    earned: 45,
    byCategory: { General: 20, Major: 20, 'Self-Directed': 5 },
    required: 60,
    remaining: 15,
    compliance_status: 'at_risk',
  },
  {
    person_id: 'p2',
    first_name: 'Jose',
    last_name: 'Cruz',
    member_number: 'PDA-002',
    earned: 60,
    byCategory: { General: 30, Major: 25, 'Self-Directed': 5 },
    required: 60,
    remaining: 0,
    compliance_status: 'compliant',
  },
]

describe('buildComplianceCsv (FIX-012)', () => {
  test('emits a header row plus one data row per member', () => {
    const csv = buildComplianceCsv(ROWS)
    const lines = csv.trim().split('\n')
    expect(lines).toHaveLength(3) // header + 2 members
    expect(lines[0]).toContain('Member')
    expect(lines[0]).toContain('Required')
    expect(lines[0]).toContain('Status')
  })

  test('each data row carries the member name, earned, required, remaining, and verdict', () => {
    const csv = buildComplianceCsv(ROWS)
    const lines = csv.trim().split('\n')
    expect(lines[1]).toContain('Maria Santos')
    expect(lines[1]).toContain('PDA-001')
    expect(lines[1]).toContain('45')
    expect(lines[1]).toContain('60')
    expect(lines[1]).toContain('15')
    expect(lines[1]).toContain('at_risk')
  })

  test('includes the per-category breakdown (General / Major / Self-Directed)', () => {
    const csv = buildComplianceCsv(ROWS)
    const header = csv.trim().split('\n')[0]
    expect(header).toContain('General')
    expect(header).toContain('Major')
    expect(header).toContain('Self-Directed')
    const row1 = csv.trim().split('\n')[1]
    // Maria: General 20, Major 20, Self-Directed 5
    expect(row1).toContain('20')
    expect(row1).toContain('5')
  })

  test('escapes commas in member names so the CSV does not break columns', () => {
    const csv = buildComplianceCsv([
      { ...ROWS[0], first_name: 'Santos, Jr.', last_name: 'Maria' },
    ])
    const dataLine = csv.trim().split('\n')[1]
    // A name containing a comma must be quoted so it stays one field.
    expect(dataLine).toContain('"Santos, Jr. Maria"')
  })

  test('handles missing category / name fields without throwing', () => {
    const csv = buildComplianceCsv([
      {
        person_id: 'p3',
        earned: 0,
        required: 60,
        remaining: 60,
        compliance_status: 'non_compliant',
      } as ComplianceRow,
    ])
    const lines = csv.trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('non_compliant')
  })
})
