// apps/org/src/features/roster-import/ImportRoster.tsx
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button, EmptyState } from '@monobase/ui'
import type { ImportMemberRow, ImportResult } from '@monobase/sdk-ts/generated'
import { useOrgs, useSelectedOrg } from '../org/use-org'
import { OrgPicker } from '../org/OrgPicker'
import { useTiers } from './use-tiers'
import { useImportRoster } from './use-import-roster'
import { parseCsv, mapRows, summarizeRows } from './csv'

const MAX_ROWS = 500

export interface Parsed {
  rows: ImportMemberRow[]
  stats: { total: number; missingIdentifier: number; missingName: number }
}

export interface ImportRosterViewProps {
  tiers: { id: string; name: string; code: string }[]
  tiersLoading: boolean
  tierId: string
  onTierChange: (id: string) => void
  onFile: (file: File) => void
  fileError: string | null
  parsed: Parsed | null
  onImport: () => void
  importing: boolean
  result: ImportResult | null
  importError: string | null
}

// ─── Presentational ─────────────────────────────────────────────────────────

export function ImportRosterView({
  tiers, tiersLoading, tierId, onTierChange, onFile, fileError,
  parsed, onImport, importing, result, importError,
}: ImportRosterViewProps) {
  if (result) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h1 className="text-title font-semibold text-foreground">Import complete</h1>
        <ul className="flex flex-col gap-2 text-body">
          <li className="text-foreground">✓ {result.imported} new member{result.imported === 1 ? '' : 's'} added</li>
          <li className="text-text-secondary">
            ↺ {result.skipped} {result.skipped === 1 ? 'already a member' : 'already members'} (skipped)
          </li>
          <li className={result.failed > 0 ? 'text-[var(--color-error)]' : 'text-muted-foreground'}>
            ✗ {result.failed} row{result.failed === 1 ? '' : 's'} failed
          </li>
        </ul>
        {result.errors.length > 0 && (
          <ul className="flex flex-col gap-1 text-caption text-[var(--color-error)]">
            {result.errors.map((e) => (
              <li key={e.index}>Row {e.index + 1}: {e.error}</li>
            ))}
          </ul>
        )}
        <Button asChild className="min-h-tap self-start">
          <Link to="/">View roster</Link>
        </Button>
      </div>
    )
  }

  const rowCount = parsed?.rows.length ?? 0
  const tooMany = rowCount > MAX_ROWS
  const canImport = !!tierId && rowCount > 0 && !tooMany && !importing

  return (
    <div className="flex flex-col gap-5 p-4">
      <h1 className="text-title font-semibold text-foreground">Import roster</h1>

      <label className="flex flex-col gap-1">
        <span className="text-body font-medium text-foreground">Membership tier</span>
        <select
          className="min-h-tap rounded-md border border-[var(--color-border)] bg-surface px-3 text-body"
          value={tierId}
          onChange={(e) => onTierChange(e.target.value)}
          disabled={tiersLoading}
        >
          <option value="">{tiersLoading ? 'Loading tiers…' : 'Select a tier…'}</option>
          {tiers.map((t) => (
            <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1">
        <label htmlFor="roster-file" className="text-body font-medium text-foreground">Roster CSV file</label>
        <input
          id="roster-file"
          type="file"
          accept=".csv,text/csv"
          // The native picker button is ~28px tall — below the 48px tap floor.
          // Style it via file: utilities into a real ≥48px branded button.
          className="text-body file:mr-4 file:min-h-tap file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-5 file:text-body file:font-medium file:text-secondary-foreground hover:file:bg-primary-subtle"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
        />
        {/* help text is a sibling, NOT inside <label>, so it isn't folded into the input's accessible name */}
        <span className="text-caption text-muted-foreground">
          Expected columns: firstName, lastName, email, licenseNumber, memberNumber. Email or licenseNumber is required.
        </span>
      </div>

      {fileError && (
        <p role="alert" className="text-body text-[var(--color-error)]">{fileError}</p>
      )}

      {parsed && (
        <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-border-light)] bg-surface p-4">
          <p className="text-body text-foreground">
            {parsed.stats.total} member{parsed.stats.total === 1 ? '' : 's'} found
          </p>
          {parsed.stats.missingIdentifier > 0 && (
            <p className="text-caption text-[var(--color-warning)]">
              {parsed.stats.missingIdentifier} with no email or license — these rows will fail.
            </p>
          )}
          {parsed.stats.missingName > 0 && (
            <p className="text-caption text-[var(--color-warning)]">
              {parsed.stats.missingName} with no first name — will fail if not already a member.
            </p>
          )}
          {tooMany && (
            <p role="alert" className="text-caption text-[var(--color-error)]">
              This file has more than {MAX_ROWS} rows. Split it into smaller files.
            </p>
          )}
        </div>
      )}

      {importError && (
        <p role="alert" className="text-body text-[var(--color-error)]">{importError}</p>
      )}

      <Button
        type="button"
        onClick={onImport}
        disabled={!canImport}
        className="min-h-tap self-start"
      >
        {importing ? 'Importing…' : `Import ${rowCount || ''} ${rowCount === 1 ? 'member' : 'members'}`.replace(/\s+/g, ' ').trim()}
      </Button>
    </div>
  )
}

// ─── Container ───────────────────────────────────────────────────────────────

export default function ImportRoster() {
  const { orgs } = useOrgs()
  const { orgId } = useSelectedOrg()
  const { tiers, loading: tiersLoading } = useTiers(orgId)
  const importMut = useImportRoster(orgId)

  const [tierId, setTierId] = useState('')
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const { rows, headerError } = mapRows(parseCsv(text))
      if (headerError) { setFileError(headerError); setParsed(null); return }
      if (rows.length === 0) { setFileError('No member rows found in this file.'); setParsed(null); return }
      setFileError(null)
      setParsed({ rows, stats: summarizeRows(rows) })
    }
    reader.readAsText(file)
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <div className="max-w-lg mx-auto pt-4">
        {orgs.length > 1 && <div className="px-4 pb-2"><OrgPicker /></div>}
        {!orgId ? (
          <div className="p-4">
            <EmptyState headline="No organization selected" description="Pick a chapter to import its roster." />
          </div>
        ) : (
          <ImportRosterView
            tiers={tiers}
            tiersLoading={tiersLoading}
            tierId={tierId}
            onTierChange={setTierId}
            onFile={handleFile}
            fileError={fileError}
            parsed={parsed}
            onImport={() => parsed && importMut.mutate({ tierId, members: parsed.rows })}
            importing={importMut.isPending}
            result={importMut.data ?? null}
            importError={importMut.isError ? importMut.error.message : null}
          />
        )}
      </div>
    </div>
  )
}
