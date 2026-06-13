/**
 * FIX-003 (G2) — channel-create validator round-trip.
 *
 * Proves the REAL generated CreateChatRoom validator (not a mocked mutation)
 * models channels: a `name` + `roomType: 'channel'` payload survives parsing,
 * and `context` accepts a non-UUID channel string (e.g. "channel:general"),
 * which previously failed because `context` was typed `string().uuid()`.
 */

import { describe, test, expect } from 'bun:test';
import { CreateChatRoomRequestSchema } from '@/generated/openapi/validators';

describe('FIX-003 channel-create validator (real generated schema)', () => {
  test('preserves name + roomType=channel on a channel payload', () => {
    const parsed = CreateChatRoomRequestSchema.parse({
      participants: [],
      name: 'general',
      roomType: 'channel',
    }) as Record<string, unknown>;

    expect(parsed.name).toBe('general');
    expect(parsed.roomType).toBe('channel');
  });

  test('accepts a non-UUID context string (channel:* link)', () => {
    const result = CreateChatRoomRequestSchema.safeParse({
      participants: [],
      context: 'channel:announcements',
    });
    expect(result.success).toBe(true);
  });

  test('still accepts a UUID context (booking-room link, regression)', () => {
    const result = CreateChatRoomRequestSchema.safeParse({
      participants: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
      context: '33333333-3333-4333-8333-333333333333',
    });
    expect(result.success).toBe(true);
  });

  test('rejects an unknown roomType', () => {
    const result = CreateChatRoomRequestSchema.safeParse({
      participants: [],
      name: 'x',
      roomType: 'bogus',
    });
    expect(result.success).toBe(false);
  });
});
