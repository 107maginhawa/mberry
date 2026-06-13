import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// SDK react-query exports are globally stubbed (test-setup-root.ts): *Options →
// { queryKey, queryFn }, *Mutation → { mutationFn }. The panel calls
// getIceServersOptions/join/leaveVideoCallMutation unconditionally (hooks); the
// default stub shapes satisfy useQuery/useMutation with no per-test priming.
// SUT — first-party static import so the Confidence scanner detects SUT binding.
import { VideoCallPanel } from '../components/video-call-panel'
// FIX-011 gate: the panel reads this flag; we drive it per-test.
import { useFeatureFlag } from '../hooks/use-feature-flag'

vi.mock('../hooks/use-feature-flag', () => ({
  useFeatureFlag: vi.fn(),
}))

// Keep the WebRTC/media machinery out of the render — the gate is the SUT.
vi.mock('../hooks/use-video-call', () => ({
  useVideoCall: () => ({
    localStream: null,
    remoteStream: null,
    connectionState: 'disconnected',
    audioEnabled: true,
    videoEnabled: true,
    isScreenSharing: false,
    error: null,
    toggleMic: () => {},
    toggleCamera: () => {},
    startScreenShare: async () => {},
    stopScreenShare: () => {},
    endCall: () => {},
    sendChatMessage: () => {},
    onChatMessage: () => () => {},
  }),
}))

// The full call surface only mounts via VideoCallUI; mark it so its presence is
// observable (proves the join/active path was reached when the flag is on).
vi.mock('../components/video-call-ui', () => ({
  VideoCallUI: () => <div>video-call-ui</div>,
}))

vi.mock('@monobase/sdk-ts/utils/webrtc/peer-connection', () => ({
  VideoPeerConnection: class {
    close() {}
  },
}))

vi.mock('lucide-react', () => ({
  Video: () => <span>video-icon</span>,
  VideoOff: () => <span>video-off-icon</span>,
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  ;(useFeatureFlag as any).mockReset()
})

describe('VideoCallPanel — FIX-011 feature-flag gate', () => {
  test('flag OFF (default): renders honest unavailable state; no join/active UI mounts', () => {
    ;(useFeatureFlag as any).mockReturnValue(false)

    render(
      <VideoCallPanel roomId="room-1" isInitiator displayName="Me" enabled />,
      { wrapper },
    )

    // Honest state copy is shown.
    expect(screen.getByText(/video calls aren't available yet/i)).toBeDefined()
    // No Start/Join control mounts — so the active→join.mutate path is unreachable.
    expect(screen.queryByRole('button', { name: /start call|join call/i })).toBeNull()
    // The active call surface is not mounted.
    expect(screen.queryByText('video-call-ui')).toBeNull()
  })

  test('flag OFF: reads the commsVideoCalls flag (correct key)', () => {
    ;(useFeatureFlag as any).mockReturnValue(false)
    render(
      <VideoCallPanel roomId="room-1" isInitiator displayName="Me" enabled />,
      { wrapper },
    )
    expect((useFeatureFlag as any).mock.calls[0][0]).toBe('commsVideoCalls')
  })

  test('flag ON + enabled: existing join UI mounts (gate is a real branch, not a permanent hide)', () => {
    ;(useFeatureFlag as any).mockReturnValue(true)

    render(
      <VideoCallPanel roomId="room-1" isInitiator displayName="Me" enabled />,
      { wrapper },
    )

    // The pre-existing Start/Join control renders when the flag is on.
    expect(screen.getByRole('button', { name: /start call|join call/i })).toBeDefined()
    expect(screen.queryByText(/video calls aren't available yet/i)).toBeNull()
  })
})
