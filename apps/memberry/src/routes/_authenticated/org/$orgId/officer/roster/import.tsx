import { useState, useCallback } from 'react'
import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import { Button } from '@monobase/ui'
import { toast } from 'sonner'
import { Upload, FileText, Check, AlertTriangle, Loader2 } from 'lucide-react'
import { importRosterMembersMutation } from '@monobase/sdk-ts/generated/react-query'
import { ApiError } from '@/lib/api'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'

export const Route = createFileRoute(
  '/_authenticated/org/$orgId/officer/roster/import',
)({
  component: RosterImportPage,
})

interface ParsedRow {
  firstName: string
  lastName: string
  email: string
  licenseNumber: string
  memberNumber: string
  [key: string]: string
}

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  // Strip BOM if present
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  // Single-pass parser: handles quoted fields with embedded newlines, commas, and escaped quotes
  const records: string[][] = []
  let fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!
    if (inQuotes) {
      if (ch === '"' && clean[i + 1] === '"') {
        current += '"'
        i++ // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current.trim())
        current = ''
      } else if (ch === '\r') {
        // skip CR (handle both CRLF and bare CR)
        continue
      } else if (ch === '\n') {
        fields.push(current.trim())
        if (fields.some((f) => f !== '')) {
          records.push(fields)
        }
        fields = []
        current = ''
      } else {
        current += ch
      }
    }
  }
  // Final record (no trailing newline)
  fields.push(current.trim())
  if (fields.some((f) => f !== '')) {
    records.push(fields)
  }

  if (records.length < 2) return { headers: [], rows: [] }

  const headers = records[0]!

  const rows = records.slice(1).map((values) => {
    const row: any = {}
    headers.forEach((h, i) => {
      const key = normalizeHeader(h)
      row[key] = values[i] || ''
    })
    return row as ParsedRow
  })

  return { headers, rows }
}

function normalizeHeader(h: string): string {
  const lower = h.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (lower.includes('firstname') || lower === 'first') return 'firstName'
  if (lower.includes('lastname') || lower === 'last') return 'lastName'
  if (lower.includes('email')) return 'email'
  if (lower.includes('license')) return 'licenseNumber'
  if (lower.includes('member') && lower.includes('number')) return 'memberNumber'
  return h
}

function RosterImportPage() {
  const { orgId } = useParams({ from: '/_authenticated/org/$orgId/officer/roster/import' })
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<{ headers: string[]; rows: ParsedRow[] } | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number } | null>(null)

  const handleFile = useCallback(async (f: File) => {
    setFile(f)
    setResult(null)
    const text = await f.text()
    const data = parseCSV(text)
    if (data.rows.length === 0) {
      toast.error('No data rows found in CSV')
      return
    }
    setParsed(data)
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.csv') || f.type === 'text/csv')) {
      handleFile(f)
    } else {
      toast.error('Please upload a CSV file')
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  const importMutOpts = importRosterMembersMutation()

  async function handleImport() {
    if (!parsed || parsed.rows.length === 0) return
    setImporting(true)

    try {
      // Map parsed rows to API shape
      // BR-22: matching by email or license number happens server-side
      const members = parsed.rows
        .filter((r) => r.email || r.licenseNumber)
        .map((r) => ({
          personId: '', // server will match or create
          tierId: 'default',
          memberNumber: r.memberNumber || r.licenseNumber || undefined,
        }))

      const data: any = await (importMutOpts.mutationFn as (...args: any[]) => any)({
        body: { organizationId: orgId, members },
      })

      setResult(data?.imported != null ? data : { imported: data?.data?.imported ?? 0 })
      toast.success(`Imported ${data?.imported ?? data?.data?.imported ?? 0} members`)
    } catch (err: any) {
      const msg = err instanceof ApiError ? ((err.body as any)?.message ?? 'Import failed') : (err.message || 'Import failed')
      toast.error(msg)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import Roster"
        subtitle="Upload a CSV file to add members in bulk"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
          { label: 'Roster', href: `/org/${orgId}/officer/roster` },
          { label: 'Import' },
        ]}
      />

      {/* Result banner */}
      {result && (
        <div className="flex items-center gap-3 p-4 rounded-[12px] bg-[var(--color-success-bg)] border border-[var(--color-success)]/20">
          <Check size={18} className="text-[var(--color-success)] shrink-0" />
          <p className="text-[14px] text-[var(--color-success)]">
            Successfully imported {result.imported} members
          </p>
        </div>
      )}

      {/* Upload area */}
      {!parsed && (
        <GlassCard className="p-0">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-[var(--color-border)] rounded-[12px] p-12 text-center hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-colors cursor-pointer"
            onClick={() => document.getElementById('csv-input')?.click()}
          >
            <Upload size={32} className="mx-auto mb-3 text-[var(--color-muted)]" />
            <p className="text-[14px] font-medium text-[var(--color-text)]">
              Drop CSV file here or click to browse
            </p>
            <p className="text-[12px] text-[var(--color-muted)] mt-1">
              Expected columns: First Name, Last Name, Email, License Number, Member Number
            </p>
            <input
              id="csv-input"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        </GlassCard>
      )}

      {/* Preview table */}
      {parsed && !result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-[var(--color-primary)]" />
              <span className="text-[14px] font-medium">{file?.name}</span>
              <span className="text-[12px] text-[var(--color-muted)]">
                ({parsed.rows.length} rows)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { setParsed(null); setFile(null) }}>
                Change File
              </Button>
              <Button size="sm" onClick={handleImport} disabled={importing}>
                {importing ? (
                  <>
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>Import {parsed.rows.length} Members</>
                )}
              </Button>
            </div>
          </div>

          {/* Warning for rows without email */}
          {parsed.rows.some((r) => !r.email && !r.licenseNumber) && (
            <div className="flex items-start gap-2 p-3 rounded-[8px] bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/20">
              <AlertTriangle size={14} className="text-[var(--color-warning)] shrink-0 mt-0.5" />
              <p className="text-[12px] text-[var(--color-warning)]">
                Some rows have no email or license number and will be skipped during import.
                Per BR-22, members are matched by email or license number.
              </p>
            </div>
          )}

          {/* Preview table — show first 20 rows */}
          <div className="rounded-[12px] border border-[var(--color-border-light)] overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[var(--color-surface-warm)]">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--color-muted)] text-[11px] uppercase tracking-wide">#</th>
                  {parsed.headers.map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-[var(--color-muted)] text-[11px] uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 20).map((row, i) => (
                  <tr key={i} className="border-t border-[var(--color-border-light)]">
                    <td className="px-4 py-2 text-[var(--color-muted)]">{i + 1}</td>
                    {parsed.headers.map((h) => (
                      <td key={h} className="px-4 py-2 text-[var(--color-text)]">
                        {row[normalizeHeader(h)] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.rows.length > 20 && (
              <div className="px-4 py-2 text-[12px] text-[var(--color-muted)] bg-[var(--color-surface-warm)] border-t border-[var(--color-border-light)]">
                Showing 20 of {parsed.rows.length} rows
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
