import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { Label } from '@monobase/ui'

export interface DirectoryFilterValues {
  specialty: string
  chapter: string
  duesStatus: string
  tier: string
}

interface DirectoryFiltersProps {
  filters: DirectoryFilterValues
  onChange: (filters: DirectoryFilterValues) => void
  specialties: string[]
}

export function DirectoryFilters({ filters, onChange, specialties }: DirectoryFiltersProps) {
  const update = (key: keyof DirectoryFilterValues, value: string) => {
    onChange({ ...filters, [key]: value === 'all' ? '' : value })
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-1.5 block">
          Specialty
        </Label>
        <Select value={filters.specialty || 'all'} onValueChange={(v) => update('specialty', v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All specialties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All specialties</SelectItem>
            {specialties.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-1.5 block">
          Dues Status
        </Label>
        <Select value={filters.duesStatus || 'all'} onValueChange={(v) => update('duesStatus', v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="current">Current (Active/Grace)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
