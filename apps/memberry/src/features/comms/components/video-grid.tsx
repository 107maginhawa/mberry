import { useMemo } from 'react'
import { VideoTile } from './video-tile'
import { CallControls } from './call-controls'
import { ConnectionStatus } from './connection-status'
import type { ConnectionState } from './video-call-ui'

interface Participant {
  id: string
  name: string
  stream: MediaStream | null
  audioEnabled: boolean
  videoEnabled: boolean
}

interface VideoGridProps {
  localStream: MediaStream | null
  participants: Participant[]
  connectionState: ConnectionState
  audioEnabled: boolean
  videoEnabled: boolean
  isScreenSharing: boolean
  onToggleMic: () => void
  onToggleCamera: () => void
  onStartScreenShare: () => void
  onStopScreenShare: () => void
  onEndCall: () => void
  duration?: string
}

/**
 * Multi-party video grid. Adapts layout based on participant count:
 * - 1 participant: full screen
 * - 2: side by side
 * - 3-4: 2x2 grid
 * - 5-6: 3x2 grid
 * - 7+: scrollable grid
 *
 * Mobile: portrait stacked layout with smaller tiles.
 */
export function VideoGrid({
  localStream,
  participants,
  connectionState,
  audioEnabled,
  videoEnabled,
  isScreenSharing,
  onToggleMic,
  onToggleCamera,
  onStartScreenShare,
  onStopScreenShare,
  onEndCall,
  duration,
}: VideoGridProps) {
  // Total tiles = remote participants + local
  const totalTiles = participants.length + 1

  const gridClass = useMemo(() => {
    if (totalTiles <= 1) return 'grid-cols-1'
    if (totalTiles === 2) return 'grid-cols-1 md:grid-cols-2'
    if (totalTiles <= 4) return 'grid-cols-2'
    if (totalTiles <= 6) return 'grid-cols-2 md:grid-cols-3'
    return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
  }, [totalTiles])

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col" role="region" aria-label="Video call">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900/80 backdrop-blur-sm z-10">
        <ConnectionStatus state={connectionState} />
        {duration && (
          <span className="text-sm text-gray-300 font-mono">{duration}</span>
        )}
        <span className="text-xs text-gray-400">
          {totalTiles} participant{totalTiles !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Video grid */}
      <div className={`flex-1 grid ${gridClass} gap-1 p-1 overflow-y-auto`}>
        {/* Remote participants */}
        {participants.map((p) => (
          <div key={p.id} className="relative min-h-[120px]">
            <VideoTile
              stream={p.stream}
              className="w-full h-full"
              label={p.name}
            />
            {!p.audioEnabled && (
              <div className="absolute top-2 right-2 bg-red-600/80 rounded-full p-1">
                <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                </svg>
              </div>
            )}
          </div>
        ))}

        {/* Local tile */}
        <div className="relative min-h-[120px]">
          <VideoTile
            stream={localStream}
            muted
            className="w-full h-full"
            label="You"
          />
        </div>
      </div>

      {/* Call controls */}
      <div className="bg-gray-900/80 backdrop-blur-sm py-4">
        <CallControls
          audioEnabled={audioEnabled}
          videoEnabled={videoEnabled}
          isScreenSharing={isScreenSharing}
          onToggleMic={onToggleMic}
          onToggleCamera={onToggleCamera}
          onStartScreenShare={onStartScreenShare}
          onStopScreenShare={onStopScreenShare}
          onEndCall={onEndCall}
        />
      </div>
    </div>
  )
}
