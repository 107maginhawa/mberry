export type ExportMember = {
  name: string
  memberNumber?: string | null
  joinedAt?: string | Date | null
  status: string
  duesExpiryDate?: string | Date | null
  unpaid: boolean
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Active', pendingPayment: 'Pending', gracePeriod: 'Grace', lapsed: 'Lapsed',
  suspended: 'Suspended', expired: 'Expired', removed: 'Removed', resigned: 'Resigned',
  deceased: 'Deceased', expelled: 'Expelled', pending: 'Pending',
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return ''
  const t = new Date(d)
  const ms = t.getTime()
  // The roster transformer coerces a null date to the epoch (new Date(null)=1970-01-01) — a
  // missing date, not a real one. Treat epoch/invalid as blank.
  return Number.isNaN(ms) || ms <= 0 ? '' : t.toISOString().slice(0, 10) // YYYY-MM-DD
}

// One CSV cell: neutralise spreadsheet formula-injection (a member-typed name like "=cmd()"
// must not execute in Excel/Sheets — prefix a single quote), THEN RFC-4180 quote when needed.
function cell(value: string): string {
  let s = value ?? ''
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

export function membersToCsv(rows: ExportMember[]): string {
  const header = ['Name', 'Member number', 'Member since', 'Status', 'Renews', 'Dues']
  const lines = [header.map(cell).join(',')]
  for (const m of rows) {
    lines.push([
      m.name,
      m.memberNumber ?? '',
      fmtDate(m.joinedAt),
      STATUS_LABEL[m.status] ?? m.status,
      fmtDate(m.duesExpiryDate),
      m.unpaid ? 'Unpaid' : 'Paid',
    ].map((c) => cell(String(c))).join(','))
  }
  return lines.join('\r\n') // RFC-4180 CRLF
}

// Tiny client-side download — no lib. ponytail: a Blob + object-URL anchor is the whole feature.
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
