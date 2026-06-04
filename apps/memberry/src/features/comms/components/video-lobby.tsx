import { useState } from 'react'
import { GlassCard } from '@/components/motion/glass-card'
import { Button } from '@monobase/ui'
import { Mic, MicOff, Video, VideoOff, Phone } from 'lucide-react'
import { VideoTile } from './video-tile'
import { useMediaStream } from '../hooks/use-media-stream'

interface VideoLobbyProps {
  roomName: string
  participants?: Array<{ id: string; name: string }>
  onJoin: (options: { audioEnabled: boolean; videoEnabled: boolean }) => void
  onCancel: () => void
}

/**
 * Pre-join lobby with camera/mic preview. User sees themselves,
 * toggles audio/video, sees who's already in the call, then joins.
 */
export function VideoLobby({ roomName, participants = [], onJoin, onCancel }: VideoLobbyProps) {
  const [joining, setJoining] = useState(false)

  const {
    stream,
    error,
    audioEnabled,
    videoEnabled,
    toggleMic,
    toggleCamera,
  } = useMediaStream({ initialAudio: true, initialVideo: true })

  const handleJoin = () => {
    setJoining(true)
    onJoin({ audioEnabled, videoEnabled })
  }

  return (
    <div className="flex items-center justify-center min-h-[400px] p-6" role="dialog" aria-label="Video call lobby">
      <GlassCard className="w-full max-w-md p-6 space-y-6">
        <h2 className="text-lg font-semibold text-[var(--color-text)] text-center">
          {roomName}
        </h2>

        {/* Camera preview */}
        <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-900">
          <VideoTile stream={stream} muted className="w-full h-full" label="You" />
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <p className="text-sm text-red-400 text-center px-4">{error}</p>
            </div>
          )}
        </div>

        {/* Audio/Video toggles */}
        <div className="flex items-center justify-center gap-4">
          {/* ui-c-exempt: interactive-emphasis — video-lobby control 48px round */}
          <Button
            variant={audioEnabled ? 'secondary' : 'destructive'}
            size="lg"
            className="rounded-full h-12 w-12"
            onClick={toggleMic}
            aria-label={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>
          {/* ui-c-exempt: interactive-emphasis — video-lobby control 48px round */}
          <Button
            variant={videoEnabled ? 'secondary' : 'destructive'}
            size="lg"
            className="rounded-full h-12 w-12"
            onClick={toggleCamera}
            aria-label={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
        </div>

        {/* Participants already in call */}
        {participants.length > 0 && (
          <div className="text-center">
            <p className="text-xs text-[var(--color-muted)] mb-2">Currently in call:</p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {participants.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 text-xs bg-[var(--color-surface-warm)] rounded-full px-2 py-1"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Join / Cancel buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={joining}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleJoin}
            disabled={joining}
          >
            <Phone className="h-4 w-4 mr-2" />
            {joining ? 'Joining...' : 'Join Call'}
          </Button>
        </div>
      </GlassCard>
    </div>
  )
}
