import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Label } from '@monobase/ui'
import { Badge } from '@monobase/ui'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { api } from '@/lib/api'
import { toast } from 'sonner'

// Radix Select forbids empty-string values on SelectItem. Use a sentinel for
// the "no filter" rows and translate to/from undefined at the props boundary.
const NONE = '__none__'

export interface SegmentFilters {
  chapterId?: string
  duesStatus?: string
  membershipTier?: string
  cpdCompliant?: boolean
  joinedAfter?: string
}

interface SavedSegment {
  id: string
  name: string
  filters: SegmentFilters
  createdAt: string
}

interface AudiencePickerProps {
  orgId: string
  value: SegmentFilters
  onChange: (filters: SegmentFilters) => void
}

const hasActiveFilters = (filters: SegmentFilters): boolean =>
  Boolean(filters.chapterId || filters.duesStatus || filters.membershipTier || filters.cpdCompliant !== undefined || filters.joinedAfter)

export function AudiencePicker({ orgId, value, onChange }: AudiencePickerProps) {
  const [debouncedFilters, setDebouncedFilters] = useState(value)
  // Bumping this remounts the saved-segment Select so picking the same segment
  // twice in a row still fires onValueChange.
  const [savedSegmentKey, setSavedSegmentKey] = useState(0)
  const queryClient = useQueryClient()

  // Debounce filter changes for roster preview
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(value)
    }, 500)
    return () => clearTimeout(timer)
  }, [value])

  // Preview recipient count
  const { data: rosterData, isLoading: rosterLoading } = useQuery({
    queryKey: ['roster-preview', orgId, debouncedFilters],
    queryFn: () => {
      const params = new URLSearchParams({ organizationId: orgId })
      if (debouncedFilters.duesStatus) params.set('status', debouncedFilters.duesStatus)
      return api.get<{ data: any[]; total: number }>(`/api/association/member/roster?${params}`)
    },
  })

  // Saved segments
  const { data: segmentsData } = useQuery({
    queryKey: ['saved-segments', orgId],
    queryFn: () =>
      api.get<{ data: SavedSegment[] }>(
        `/api/communications/segments?organizationId=${orgId}`,
      ),
  })

  const savedSegments = segmentsData?.data ?? []

  const saveSegmentMutation = useMutation({
    mutationFn: (payload: { name: string; filters: SegmentFilters }) =>
      api.post('/api/communications/segments', {
        organizationId: orgId,
        name: payload.name,
        filters: payload.filters,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-segments', orgId] })
      toast.success('Segment saved')
    },
    onError: () => toast.error('Failed to save segment'),
  })

  const deleteSegmentMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/communications/segments/${id}?organizationId=${orgId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-segments', orgId] })
      toast.success('Segment deleted')
    },
    onError: () => toast.error('Failed to delete segment'),
  })

  const handleSaveSegment = () => {
    const name = window.prompt('Segment name:')
    if (!name?.trim()) return
    saveSegmentMutation.mutate({ name: name.trim(), filters: value })
  }

  const handleSelectSegment = (segmentId: string) => {
    const segment = savedSegments.find((s) => s.id === segmentId)
    if (segment) onChange(segment.filters)
  }

  const recipientCount = rosterData?.total ?? 0

  const updateFilter = useCallback(
    (key: keyof SegmentFilters, val: string | boolean | undefined) => {
      onChange({ ...value, [key]: val || undefined })
    },
    [value, onChange],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Audience Filters</Label>
        <Badge variant={recipientCount > 0 ? 'default' : 'secondary'}>
          {rosterLoading ? 'Loading...' : `${recipientCount} recipients`}
        </Badge>
      </div>

      {/* Saved Segments */}
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="saved-segment" className="text-sm">Saved Segments</Label>
          {/* One-shot picker: applying a segment must NOT keep its id selected,
              so the next pick of the same id still fires. Reset via savedSegmentKey. */}
          <Select
            key={savedSegmentKey}
            value=""
            onValueChange={(v) => {
              if (v) handleSelectSegment(v)
              setSavedSegmentKey((k) => k + 1)
            }}
            data-testid="saved-segment-select"
          >
            <SelectTrigger id="saved-segment" className="w-full">
              <SelectValue placeholder="Choose a saved segment..." />
            </SelectTrigger>
            <SelectContent>
              {savedSegments.map((seg) => (
                <SelectItem key={seg.id} value={seg.id}>
                  {seg.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hasActiveFilters(value) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaveSegment}
            disabled={saveSegmentMutation.isPending}
          >
            Save Segment
          </Button>
        )}
        {savedSegments.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const segId = window.prompt(
                'Enter segment ID to delete (from dropdown):',
              )
              if (segId) deleteSegmentMutation.mutate(segId)
            }}
            className="text-destructive"
          >
            Delete
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Dues Status */}
        <div className="space-y-1.5">
          <Label htmlFor="dues-status" className="text-sm">Dues Status</Label>
          <Select
            value={value.duesStatus ?? NONE}
            onValueChange={(v) => updateFilter('duesStatus', v === NONE ? undefined : v)}
          >
            <SelectTrigger id="dues-status" className="w-full">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Membership Tier */}
        <div className="space-y-1.5">
          <Label htmlFor="membership-tier" className="text-sm">Membership Tier</Label>
          <Select
            value={value.membershipTier ?? NONE}
            onValueChange={(v) => updateFilter('membershipTier', v === NONE ? undefined : v)}
          >
            <SelectTrigger id="membership-tier" className="w-full">
              <SelectValue placeholder="All tiers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All tiers</SelectItem>
              <SelectItem value="regular">Regular</SelectItem>
              <SelectItem value="associate">Associate</SelectItem>
              <SelectItem value="fellow">Fellow</SelectItem>
              <SelectItem value="honorary">Honorary</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* CPD Compliance */}
        <div className="space-y-1.5">
          <Label htmlFor="cpd-compliant" className="text-sm">CPD Compliance</Label>
          <Select
            value={value.cpdCompliant === undefined ? NONE : String(value.cpdCompliant)}
            onValueChange={(v) => {
              updateFilter('cpdCompliant', v === NONE ? undefined : v === 'true')
            }}
          >
            <SelectTrigger id="cpd-compliant" className="w-full">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Any</SelectItem>
              <SelectItem value="true">Compliant</SelectItem>
              <SelectItem value="false">Non-compliant</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Joined After */}
        <div className="space-y-1.5">
          <Label htmlFor="joined-after" className="text-sm">Joined After</Label>
          <Input
            id="joined-after"
            type="date"
            value={value.joinedAfter ?? ''}
            onChange={(e) => updateFilter('joinedAfter', e.target.value)}
          />
        </div>
      </div>

      {recipientCount === 0 && !rosterLoading && (
        <p className="text-sm text-[var(--color-warning)]">
          No members match the current filters. Adjust your filters or send to all members.
        </p>
      )}
    </div>
  )
}
