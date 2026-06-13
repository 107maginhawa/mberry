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

        // FIX-012 (G10): archived rooms are read-only — reject the send on the WS
        // path too (mirrors the REST guard in sendChatMessage). Do not persist.
        const targetRoom = await roomRepo.findOneById(roomId);
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

      case 'chat.typing':
        // Relay typing indicator to channel
        await wsService.publishToChannel(channel, 'chat.typing', {
          from: user.id,
          isTyping: data.isTyping,
        });
        break;

      case 'video.offer':
      case 'video.answer':
      case 'video.ice-candidate': {
        // Relay WebRTC signaling to channel participants (exclude sender)
        const signalMessage: SignalMessage = {
          type,
          from: user.id,
          data: data,
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
