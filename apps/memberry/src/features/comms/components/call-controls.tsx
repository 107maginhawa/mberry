/**
 * Call Controls Component
 * Buttons for mute/camera/end call actions
 */

import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff } from 'lucide-react'
import { RoundActionButton } from '@monobase/ui'
import { cn } from '@/lib/utils'

interface CallControlsProps {
  audioEnabled: boolean
  videoEnabled: boolean
  isScreenSharing: boolean
  onToggleMic: () => void
  onToggleCamera: () => void
  onStartScreenShare: () => void
  onStopScreenShare: () => void
  onEndCall: () => void
  className?: string
}

export function CallControls({
  audioEnabled,
  videoEnabled,
  isScreenSharing,
  onToggleMic,
  onToggleCamera,
  onStartScreenShare,
  onStopScreenShare,
  onEndCall,
  className
}: CallControlsProps) {
  return (
    <div className={cn('flex items-center justify-center gap-4', className)}>
      {/* Microphone Toggle */}
      <RoundActionButton
        variant={audioEnabled ? 'secondary' : 'destructive'}
        size="lg"
        onClick={onToggleMic}
        title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
      >
        {audioEnabled ? (
          <Mic className="h-6 w-6" />
        ) : (
          <MicOff className="h-6 w-6" />
        )}
      </RoundActionButton>

      {/* Camera Toggle */}
      <RoundActionButton
        variant={videoEnabled ? 'secondary' : 'destructive'}
        size="lg"
        onClick={onToggleCamera}
        title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
      >
        {videoEnabled ? (
          <Video className="h-6 w-6" />
        ) : (
          <VideoOff className="h-6 w-6" />
        )}
      </RoundActionButton>

      {/* Screen Share Toggle */}
      <RoundActionButton
        variant={isScreenSharing ? 'default' : 'secondary'}
        size="lg"
        onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare}
        title={isScreenSharing ? 'Stop screen sharing' : 'Start screen sharing'}
      >
        {isScreenSharing ? (
          <Monitor className="h-6 w-6" />
        ) : (
          <MonitorOff className="h-6 w-6" />
        )}
      </RoundActionButton>

      {/* End Call */}
      {/* ui-c-exempt: methodology-carry — end-call destructive emphasis brand red */}
      <RoundActionButton
        variant="destructive"
        size="lg"
        className="bg-red-600 hover:bg-red-700"
        onClick={onEndCall}
        title="End call"
      >
        <PhoneOff className="h-6 w-6" />
      </RoundActionButton>
    </div>
  )
}
