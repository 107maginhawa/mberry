import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Label } from '@monobase/ui'
import { Badge } from '@monobase/ui'
import { Button } from '@monobase/ui'
import { api } from '@/lib/api'
import { toast } from 'sonner'

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
          <select
            id="saved-segment"
            data-testid="saved-segment-select"
            onChange={(e) => {
              if (e.target.value) handleSelectSegment(e.target.value)
              e.target.value = ''
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Choose a saved segment...</option>
            {savedSegments.map((seg) => (
              <option key={seg.id} value={seg.id}>
                {seg.name}
              </option>
            ))}
          </select>
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
          <select
            id="dues-status"
            value={value.duesStatus ?? ''}
            onChange={(e) => updateFilter('duesStatus', e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        {/* Membership Tier */}
        <div className="space-y-1.5">
          <Label htmlFor="membership-tier" className="text-sm">Membership Tier</Label>
          <select
            id="membership-tier"
            value={value.membershipTier ?? ''}
            onChange={(e) => updateFilter('membershipTier', e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All tiers</option>
            <option value="regular">Regular</option>
            <option value="associate">Associate</option>
            <option value="fellow">Fellow</option>
            <option value="honorary">Honorary</option>
          </select>
        </div>

        {/* CPD Compliance */}
        <div className="space-y-1.5">
          <Label htmlFor="cpd-compliant" className="text-sm">CPD Compliance</Label>
          <select
            id="cpd-compliant"
            value={value.cpdCompliant === undefined ? '' : String(value.cpdCompliant)}
            onChange={(e) => {
              const v = e.target.value
              updateFilter('cpdCompliant', v === '' ? undefined : v === 'true')
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Any</option>
            <option value="true">Compliant</option>
            <option value="false">Non-compliant</option>
          </select>
        </div>

        {/* Joined After */}
        <div className="space-y-1.5">
          <Label htmlFor="joined-after" className="text-sm">Joined After</Label>
          <input
            id="joined-after"
            type="date"
            value={value.joinedAfter ?? ''}
            onChange={(e) => updateFilter('joinedAfter', e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
