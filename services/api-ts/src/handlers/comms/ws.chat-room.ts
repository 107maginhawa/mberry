/**
 * Chat Room WebSocket Handler
 * Room-specific connection for real-time chat and video signaling
 *
 * Endpoint: /ws/comms/chat-rooms/:room
 * Auth: Required + room participant validation
 *
 * Handles:
 * - Chat messages in this room
 * - Video signaling (offer/answer/ICE candidates)
 * - Presence indicators (typing, online status)
 */

import type { Context } from 'hono';
import type { WSContext } from 'hono/ws';
import type { WebSocketHandler } from '@/core/ws';
import type { User } from '@/types/auth';
import type { DatabaseInstance } from '@/core/database';
import { authMiddleware } from '@/middleware/auth';
import { ChatRoomRepository } from './repos/chatRoom.repo';
import { ChatMessageRepository } from './repos/chatMessage.repo';
import { ChatRoomMemberRepository } from './repos/chatRoomMember.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import type { ChatRoom } from './repos/comms.schema';
import { verifyCallToken } from './utils/call-token';

/**
 * Message types for chat room WebSocket.
 * Formal schema: specs/api/src/modules/comms.tsp — WebSocketEventType enum
 */
type MessageType =
  | 'chat.message'
  | 'chat.typing'
  | 'video.offer'
  | 'video.answer'
  | 'video.ice-candidate'
  | 'ping';

/**
 * WebRTC signaling message structure.
 * Formal schema: specs/api/src/modules/comms.tsp — VideoOfferPayload / VideoAnswerPayload / IceCandidatePayload
 */
interface SignalMessage {
  type: 'video.offer' | 'video.answer' | 'video.ice-candidate';
  from: string;
  data: unknown;
}

/**
 * Per-frame authorization re-check (P0 — HOLE 3).
 *
 * The REST send path (sendChatMessage) enforces org-isolation and re-derives
 * participant status on every request. The WS path historically only checked
 * membership at connect, so a revoked member kept writing for the socket's
 * lifetime, and the cross-org guard was skipped entirely. This re-runs BOTH on
 * every inbound write frame:
 *   (a) the sender is STILL an active room member (JSONB participants OR the
 *       chat_room_member join table — same OR-shim as onConnect), and
 *   (b) the room's org matches an org the sender currently belongs to (mirrors
 *       the `room.organizationId !== callerOrg` guard in sendChatMessage). Only
 *       enforced when the room is org-scoped, so org-agnostic legacy rows are
 *       not falsely blocked.
 *
 * Returns the freshly-fetched room on success, or null after sending an error
 * frame (caller must stop processing).
 */
async function authorizeWriteFrame(
  db: DatabaseInstance,
  logger: any,
  ws: WSContext,
  roomId: string,
  userId: string,
): Promise<ChatRoom | null> {
  const roomRepo = new ChatRoomRepository(db, logger);
  const room = await roomRepo.findOneById(roomId);
  if (!room) {
    ws.send(JSON.stringify({ event: 'error', payload: { message: 'Chat room not found' } }));
    return null;
  }

  // (a) Re-verify ACTIVE membership on every frame — handles mid-session revocation.
  const memberRepo = new ChatRoomMemberRepository(db, logger);
  const stillMember =
    room.participants.includes(userId) ||
    (await memberRepo.isMember(roomId, userId));
  if (!stillMember) {
    ws.send(JSON.stringify({
      event: 'error',
      payload: { message: 'Access denied: no longer a participant in this chat room' },
    }));
    logger?.warn?.({ action: 'ws.chat-room.revoked-rejected', userId, roomId }, 'Rejected frame from revoked member');
    return null;
  }

  // (b) Org-isolation: the room is org-scoped — the sender must currently belong
  // to the room's org. Mirrors the REST cross-org guard. Skipped for
  // org-agnostic rooms (no organizationId).
  const orgId = (room as { organizationId?: string }).organizationId;
  if (orgId) {
    const membershipRepo = new MembershipRepository(db, logger);
    const membership = await membershipRepo.findByPersonAndOrg(userId, orgId);
    if (!membership) {
      ws.send(JSON.stringify({
        event: 'error',
        payload: { message: 'Access denied: chat room belongs to a different organization' },
      }));
      logger?.warn?.({ action: 'ws.chat-room.cross-org-rejected', userId, roomId }, 'Rejected cross-org frame');
      return null;
    }
  }

  return room;
}

export const config: WebSocketHandler = {
  path: '/ws/comms/chat-rooms/:room',
  description: 'Chat room real-time communication (chat + video signaling)',
  middleware: [authMiddleware()],

  async onConnect(ctx: Context, ws: WSContext) {
    const roomId = ctx.req.param('room')!;
    const user = ctx.get('user') as User;
    const db = ctx.get('database') as DatabaseInstance;
    const wsService = ctx.get('ws');
    const baseLogger = ctx.get('logger');
    const traceId = ctx.get('requestId');
    const logger = baseLogger?.child?.({ traceId, module: 'comms' }) ?? baseLogger;

    // Verify room exists and user is a participant
    const roomRepo = new ChatRoomRepository(db, logger);

    // Authorization uses Person ID directly (no profile lookups needed)

    // Check room exists
    const room = await roomRepo.findOneById(roomId);
    if (!room) {
      logger.error({ action: 'ws.chat-room.1', roomId }, 'Chat room not found');
      ws.send(JSON.stringify({ event: 'error', payload: { message: 'Chat room not found' } }));
      ws.close(1008, 'Room not found');
      return;
    }

    // Check if user is a participant.
    // FIX-007 (G5): honor BOTH the legacy JSONB `participants` array AND the
    // `chat_room_member` join table, so a member tracked only in the join table
    // can connect. Compatibility OR-shim — JSONB stays canonical; the `||`
    // short-circuits, so the join-table query only runs when JSONB misses.
    const memberRepo = new ChatRoomMemberRepository(db, logger);
    const isParticipant =
      room.participants.includes(user.id) ||
      (await memberRepo.isMember(roomId, user.id));

    if (!isParticipant) {
      logger.error({ action: 'ws.chat-room.2', userId: user.id, roomId }, 'User is not a participant in chat room');
      ws.send(JSON.stringify({ event: 'error', payload: { message: 'Access denied: not a participant' } }));
      ws.close(1008, 'Not authorized');
      return;
    }

    // Track channel connection (namespaced to avoid conflicts with other resource types)
    const channel = `chat-rooms/${roomId}`;
    wsService.trackChannel(channel, ws);

    // Send connection confirmation
    ws.send(JSON.stringify({
      event: 'connected',
      payload: {
        roomId,
        userId: user.id,
        timestamp: new Date().toISOString(),
      },
    }));

    // Notify channel about new participant (exclude self)
    await wsService.publishToChannel(channel, 'user.joined', {
      userId: user.id,
      timestamp: new Date().toISOString(),
    }, ws);

    logger.info({ action: 'ws.chat-room.3', userId: user.id, roomId }, 'User connected to chat room WebSocket');
  },

  async onMessage(ctx: Context, ws: WSContext, message: any) {
    const roomId = ctx.req.param('room')!;
    const user = ctx.get('user') as User;
    const db = ctx.get('database') as DatabaseInstance;
    const wsService = ctx.get('ws');
    const logger = ctx.get('logger');

    const wsId = (ws.raw as unknown as Record<string, unknown>)['__wsId']; // structural: Hono WebSocket internal
    logger.debug({ action: 'ws.chat-room.4', userId: user.id, roomId, wsId, messageType: message.type }, 'Processing WebSocket message');

    const { type, data } = message as { type: MessageType; data: any };
    const channel = `chat-rooms/${roomId}`;

    switch (type) {
      case 'ping':
        // Heartbeat/keepalive
        ws.send(JSON.stringify({ event: 'pong', payload: { timestamp: new Date().toISOString() } }));
        break;

      case 'chat.message': {
        // Persist message to database
        const messageRepo = new ChatMessageRepository(db, logger);
        const roomRepo = new ChatRoomRepository(db, logger);

        // P0 (HOLE 3): re-check org-isolation + ACTIVE membership on every frame.
        // A revoked member or a cross-org sender is rejected here, even though
        // they passed the connect-time check.
        const targetRoom = await authorizeWriteFrame(db, logger, ws, roomId, user.id);
        if (!targetRoom) break;

        // FIX-012 (G10): archived rooms are read-only — reject the send on the WS
        // path too (mirrors the REST guard in sendChatMessage). Do not persist.
        if (targetRoom?.status === 'archived') {
          ws.send(JSON.stringify({
            event: 'error',
            payload: { message: 'Cannot send messages to an archived chat room' },
          }));
          logger.warn({ action: 'ws.chat-room.archived-rejected', userId: user.id, roomId }, 'Rejected chat message to archived room');
          break;
        }

        // PD-1 decision-3 (Step 41): #announcements is officer-post-only on the
        // WS write path too (mirrors sendChatMessage). The provisioned
        // announcements channel is keyed by its context slug; only an officer of
        // the room's org may post. WS connections carry no org-context
        // middleware, so the officer term is checked against the room's own org.
        if (targetRoom?.context === 'channel:announcements') {
          const termRepo = new OfficerTermRepository(db);
          const terms = await termRepo.findActiveByPersonAndOrg(
            user.id,
            (targetRoom as { organizationId: string }).organizationId,
          );
          if (terms.length === 0) {
            ws.send(JSON.stringify({
              event: 'error',
              payload: { message: 'Only officers may post to the announcements channel' },
            }));
            logger.warn({ action: 'ws.chat-room.announcements-rejected', userId: user.id, roomId }, 'Rejected non-officer announcement post');
            break;
          }
        }

        const savedMessage = await messageRepo.createTextMessage(
          roomId,
          user.id,
          data.text
        );

        // Update room metadata
        await roomRepo.updateLastMessage(roomId, savedMessage.timestamp);

        // Broadcast complete message object to all channel participants
        await wsService.publishToChannel(channel, 'chat.message', savedMessage);

        logger.debug({ action: 'ws.chat-room.5', userId: user.id, roomId, messageId: savedMessage.id }, 'Chat message persisted and sent');
        break;
      }

      case 'chat.typing': {
        // P0 (HOLE 3): typing/presence is a write frame too — re-check
        // org-isolation + ACTIVE membership before relaying `from: user.id`,
        // so a revoked or cross-org member cannot keep broadcasting presence
        // for the socket's lifetime (same guard as chat.message / video.*).
        const targetRoom = await authorizeWriteFrame(db, logger, ws, roomId, user.id);
        if (!targetRoom) break;

        // Relay typing indicator to channel
        await wsService.publishToChannel(channel, 'chat.typing', {
          from: user.id,
          isTyping: data.isTyping,
        });
        break;
      }

      case 'video.offer':
      case 'video.answer':
      case 'video.ice-candidate': {
        // P0 (HOLE 3): re-check org-isolation + ACTIVE membership on every frame.
        const targetRoom = await authorizeWriteFrame(db, logger, ws, roomId, user.id);
        if (!targetRoom) break;

        // P0 (HOLE 2 + HOLE 1): relaying video.* must be gated on a VERIFIED call
        // token bound to THIS room's active call and THIS sender — NOT merely
        // room membership. Without this, any room participant could hijack an
        // active call's signaling or bypass the capacity cap.
        const messageRepo = new ChatMessageRepository(db, logger);
        const activeCall = await messageRepo.findActiveVideoCall(roomId);
        if (!activeCall) {
          ws.send(JSON.stringify({
            event: 'error',
            payload: { message: 'No active video call in this room' },
          }));
          logger?.warn?.({ action: 'ws.chat-room.no-active-call', userId: user.id, roomId, type }, 'Rejected video signaling: no active call');
          break;
        }

        const token: string | undefined =
          (message as { token?: string }).token ??
          (data as { token?: string } | undefined)?.token;

        const verdict = verifyCallToken(token ?? '', {
          callId: activeCall.id,
          personId: user.id,
        });
        if (!verdict.valid) {
          ws.send(JSON.stringify({
            event: 'error',
            payload: { message: 'Invalid or missing video call token' },
          }));
          logger?.warn?.({
            action: 'ws.chat-room.bad-call-token',
            userId: user.id,
            roomId,
            type,
            reason: verdict.reason,
          }, 'Rejected video signaling: invalid call token');
          break;
        }

        // Relay WebRTC signaling to channel participants (exclude sender).
        // Strip any token carried inside `data` so a sender's call token is
        // never leaked to other peers.
        let relayData = data;
        if (relayData && typeof relayData === 'object' && 'token' in relayData) {
          const { token: _omit, ...rest } = relayData as Record<string, unknown>;
          relayData = rest;
        }
        const signalMessage: SignalMessage = {
          type,
          from: user.id,
          data: relayData,
        };

        await wsService.publishToChannel(channel, type, signalMessage, ws);
        logger.debug({ action: 'ws.chat-room.6', userId: user.id, roomId, type }, 'Video signaling message relayed');
        break;
      }

      default:
        logger.warn({ action: 'ws.chat-room.7', userId: user.id, roomId, type }, 'Unknown message type from chat room WebSocket');
    }
  },

  async onClose(ctx: Context, ws: WSContext) {
    const roomId = ctx.req.param('room');
    const user = ctx.get('user') as User;
    const wsService = ctx.get('ws');
    const logger = ctx.get('logger');

    // Untrack channel connection
    const channel = `chat-rooms/${roomId}`;
    wsService.untrackChannel(channel, ws);

    // Notify channel about participant leaving
    await wsService.publishToChannel(channel, 'user.left', {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    logger.info({ action: 'ws.chat-room.8', userId: user.id, roomId }, 'User disconnected from chat room WebSocket');
  },
};
