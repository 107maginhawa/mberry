// apps/org/src/features/roster-import/csv.ts
import type { ImportMemberRow } from '@monobase/sdk-ts/generated'

/** Minimal RFC-4180 parser — ported from the engine's invite/bulkImportMembers.ts. */
export function parseCsv(content: string): string[][] {
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1)
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else { field += ch }
    } else if (ch === '"') { inQuotes = true }
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && content[i + 1] === '\n') i++
      row.push(field); rows.push(row); field = ''; row = []
    } else { field += ch }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

const HEADER_ALIASES: Record<keyof ImportMemberRow, string[]> = {
  firstName: ['firstname', 'first name', 'first'],
  lastName: ['lastname', 'last name', 'last'],
  email: ['email', 'e-mail'],
  licenseNumber: ['licensenumber', 'license', 'license number', 'prc', 'prc number'],
  memberNumber: ['membernumber', 'member number', 'member no', 'member #'],
}

export function mapRows(grid: string[][]): { rows: ImportMemberRow[]; headerError?: string } {
  if (grid.length === 0) return { rows: [] }
  const header = grid[0]!.map((h) => h.trim().toLowerCase())
  const colOf = (field: keyof ImportMemberRow): number =>
    header.findIndex((h) => HEADER_ALIASES[field].includes(h))
  const idx = {
    firstName: colOf('firstName'),
    lastName: colOf('lastName'),
    email: colOf('email'),
    licenseNumber: colOf('licenseNumber'),
    memberNumber: colOf('memberNumber'),
  }
  if (idx.email === -1 && idx.licenseNumber === -1) {
    return { rows: [], headerError: 'CSV must include an email or licenseNumber column.' }
  }
  const rows: ImportMemberRow[] = []
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r]!
    const cell = (c: number) => (c === -1 ? '' : (cells[c] ?? '').trim())
    const row: ImportMemberRow = {}
    const fn = cell(idx.firstName); if (fn) row.firstName = fn
    const ln = cell(idx.lastName); if (ln) row.lastName = ln
    const em = cell(idx.email); if (em) row.email = em
    const lic = cell(idx.licenseNumber); if (lic) row.licenseNumber = lic
    const mn = cell(idx.memberNumber); if (mn) row.memberNumber = mn
    if (Object.keys(row).length > 0) rows.push(row)
  }
  return { rows }
}

export function summarizeRows(rows: ImportMemberRow[]): {
  total: number; missingIdentifier: number; missingName: number
} {
  let missingIdentifier = 0
  let missingName = 0
  for (const r of rows) {
    if (!r.email && !r.licenseNumber) missingIdentifier++
    if (!r.firstName) missingName++
  }
  return { total: rows.length, missingIdentifier, missingName }
}
