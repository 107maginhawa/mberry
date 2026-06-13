import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createChatRoomMutation } from '@monobase/sdk-ts/generated/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Textarea,
  Label,
} from '@monobase/ui'
import { toast } from 'sonner'

interface CreateChannelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (roomId: string) => void
  /** Org UUID — scopes the channel so the org-context middleware resolves it. */
  orgId?: string
}

/**
 * Build the createChatRoom request body for a new channel (FIX-002).
 *
 * Sends `roomType: 'channel'` + a slugged `name` + the org id so the room is
 * org-scoped. The creator is auto-added by the backend, so `participants` is
 * empty. The old `context: "channel:x"` hack (which violated the UUID validator)
 * is gone — `name`/`roomType` now model the channel directly.
 */
export function buildChannelCreateBody(name: string, orgId: string) {
  const channelName = name.trim().toLowerCase().replace(/\s+/g, '-')
  return {
    name: channelName,
    roomType: 'channel' as const,
    organizationId: orgId,
    participants: [] as string[],
  }
}

/**
 * Dialog for officers to create a new chat channel.
 * Name is required, description optional.
 */
export function CreateChannelDialog({ open, onOpenChange, onCreated, orgId = '' }: CreateChannelDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const queryClient = useQueryClient()

  const createRoom = useMutation({
    ...createChatRoomMutation(),
    onSuccess: (data: any) => {
      toast.success(`#${name} created`)
      queryClient.invalidateQueries({ queryKey: ['listChatRooms'] })
      onCreated(data?.id ?? '')
      setName('')
      setDescription('')
      onOpenChange(false)
    },
    onError: () => {
      toast.error('Failed to create channel')
    },
  })

  const canSubmit = name.trim().length > 0 && !createRoom.isPending

  const handleSubmit = () => {
    if (!canSubmit) return
    createRoom.mutate({
      body: buildChannelCreateBody(name, orgId),
    } as any)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Channel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="channel-name">Channel Name</Label>
            <Input
              id="channel-name"
              aria-label="Channel name"
              placeholder="e.g. general, events, training"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="channel-desc">Description</Label>
            <Textarea
              id="channel-desc"
              aria-label="Description"
              placeholder="What is this channel for? (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-label="Create channel"
          >
            {createRoom.isPending ? 'Creating...' : 'Create Channel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
