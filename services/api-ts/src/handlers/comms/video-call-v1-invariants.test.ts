/**
 * PD-3 (FIX-011) — V1 video-call invariant unit tests.
 *
 * Pure, infra-free assertions on the V1 scope primitives:
 *  - capacity cap constant value + active-participant counting
 *  - no-recording invariant guard + structural absence of recording fields
 *
 * The browser-to-browser media flow (STUN/TURN/peer connections/recording)
 * is [BLOCKED BY ENVIRONMENT] / V2 and is NOT exercised here.
 */

import { describe, test, expect } from 'bun:test';
import {
  VIDEO_CALL_MAX_PARTICIPANTS,
  assertNoRecording,
  countActiveCallParticipants,
} from './repos/comms.schema';
import type { CallParticipant, VideoCallData } from './repos/comms.schema';

function p(user: string, extra: Partial<CallParticipant> = {}): CallParticipant {
  return {
    user,
    userType: 'host',
    displayName: user,
    audioEnabled: true,
    videoEnabled: true,
    joinedAt: new Date().toISOString(),
    ...extra,
  } as CallParticipant;
}

describe('VIDEO_CALL_MAX_PARTICIPANTS (V1 cap)', () => {
  test('is a small-group cap (1:1=2 .. small-group)', () => {
    expect(VIDEO_CALL_MAX_PARTICIPANTS).toBe(6);
    expect(VIDEO_CALL_MAX_PARTICIPANTS).toBeGreaterThanOrEqual(2);
  });
});

describe('countActiveCallParticipants', () => {
  test('counts joined-and-not-left participants only', () => {
    const participants = [
      p('a'),
      p('b'),
      p('c', { leftAt: new Date().toISOString() }), // left → not counted
      { user: 'd', userType: 'host', displayName: 'd', audioEnabled: true, videoEnabled: true } as CallParticipant, // never joined
    ];
    expect(countActiveCallParticipants(participants)).toBe(2);
  });

  test('handles null/undefined safely', () => {
    expect(countActiveCallParticipants(null)).toBe(0);
    expect(countActiveCallParticipants(undefined)).toBe(0);
    expect(countActiveCallParticipants([])).toBe(0);
  });
});

describe('assertNoRecording (V1 no-recording invariant)', () => {
  test('passes through data with no recording field', () => {
    const data: VideoCallData = { status: 'starting', participants: [p('a')] };
    expect(assertNoRecording(data)).toBe(data);
  });

  test('throws when recording is explicitly enabled', () => {
    expect(() => assertNoRecording({ status: 'starting', participants: [], recording: true })).toThrow();
    expect(() => assertNoRecording({ recordingEnabled: true })).toThrow();
    expect(() => assertNoRecording({ record: true })).toThrow();
  });

  test('does not throw for falsy/absent recording flags', () => {
    expect(() => assertNoRecording({ recording: false })).not.toThrow();
    expect(() => assertNoRecording({})).not.toThrow();
    expect(() => assertNoRecording(null)).not.toThrow();
  });

  test('VideoCallData type carries no recording field structurally', () => {
    const data: VideoCallData = {
      status: 'active',
      participants: [],
      startedAt: new Date().toISOString(),
    };
    // No recording key exists on the canonical shape.
    expect(Object.keys(data)).not.toContain('recording');
    expect(Object.keys(data)).not.toContain('recordingEnabled');
  });
});
