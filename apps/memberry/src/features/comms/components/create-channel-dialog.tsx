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
}

/**
 * Dialog for officers to create a new chat channel.
 * Name is required, description optional.
 */
export function CreateChannelDialog({ open, onOpenChange, onCreated }: CreateChannelDialogProps) {
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
    const channelName = name.trim().toLowerCase().replace(/\s+/g, '-')
    createRoom.mutate({
      body: {
        participants: [], // Backend adds creator automatically
        context: `channel:${channelName}`,
      },
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
