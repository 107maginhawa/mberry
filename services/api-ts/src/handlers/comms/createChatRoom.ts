import type { ValidatedContext } from '@/types/app';
import type { CreateChatRoomBody } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import {
  ValidationError,
  ForbiddenError,
  BusinessLogicError,
  ConflictError
} from '@/core/errors';
import { ChatRoomRepository } from './repos/chatRoom.repo';
import { ChatRoomMemberRepository } from './repos/chatRoomMember.repo';
import { type CreateChatRoomRequest } from './repos/comms.schema';
import { requireOfficerTerm } from '@/core/auth/officer-checks';

/**
 * createChatRoom
 *
 * Path: POST /comms/chat-rooms
 * OperationId: createChatRoom
 *
 * Create a new chat room between participants (with upsert logic)
 */
export async function createChatRoom(
  ctx: ValidatedContext<CreateChatRoomBody, never, never>
): Promise<Response> {
  // Get authenticated user from Better-Auth
  const user = ctx.get('user') as User;

  if (!user.id) {
    throw new ValidationError('Valid user ID required');
  }

  // Extract validated request body
  const body = ctx.req.valid('json') as CreateChatRoomRequest;

  const roomType = body.roomType ?? 'group';
  const isChannel = roomType === 'channel';

  // Get dependencies from context for authorization check
  const db = ctx.get('database') as DatabaseInstance;
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'comms' }) ?? baseLogger;

  // Multi-tenant scoping (P0-7)
  const organizationId = ctx.get('organizationId') as string;

  // FIX-007 (PD-1): channel creation is officer-only. Members may not create
  // channels in V1; this gate runs before any validation/mutation.
  if (isChannel) {
    const denied = await requireOfficerTerm(ctx);
    if (denied) return denied;
  }

  // Validate participants. Channels may be created with no other participants —
  // the creator auto-joins (FIX-002/FIX-003). DMs/groups still require ≥2.
  if (!body.participants) {
    throw new ValidationError('At least one participant is required');
  }
  if (!isChannel) {
    if (body.participants.length === 0) {
      throw new ValidationError('At least one participant is required');
    }
    if (body.participants.length < 2) {
      throw new ValidationError('At least two participants are required for a chat room');
    }
  }

  // Business rule: prevent duplicate participants (on the caller-supplied list)
  const uniqueParticipants = [...new Set(body.participants)];
  if (uniqueParticipants.length !== body.participants.length) {
    throw new BusinessLogicError(
      'Duplicate participants not allowed',
      'DUPLICATE_PARTICIPANTS'
    );
  }

  // For channels the creator auto-joins as the first member + admin.
  const participants = isChannel
    ? [...new Set([...body.participants, user.id])]
    : body.participants;
  const admins = body.admins && body.admins.length > 0
    ? (isChannel ? [...new Set([...body.admins, user.id])] : body.admins)
    : participants;

  // Business rule: user must be one of the participants or admins. Channels
  // always satisfy this (creator auto-added above).
  if (!isChannel) {
    const allInvolvedIds = [...body.participants, ...admins];
    if (!allInvolvedIds.includes(user.id)) {
      throw new ForbiddenError('You can only create chat rooms you are involved in');
    }
  }

  // Instantiate repository
  const repo = new ChatRoomRepository(db, logger);

  // Upsert logic: channels are not deduped by participant set (two channels can
  // share the creator); only DM/group rooms look up an existing room.
  let room = isChannel ? null : await repo.findRoomWithParticipants(participants);
  let created = false;

  if (room && !body.upsert) {
    // Room exists and upsert is false - return conflict
    throw new ConflictError(
      'Chat room with these participants already exists'
    );
  }

  if (room && body.upsert) {
    // Room exists and upsert is true - update with new settings if needed
    const updates: any = {};

    // Security (FIX-005 / G6): privileged fields (admins, context) may only be
    // mutated by an existing admin of the room. Without this guard any
    // participant could self-promote to admin (gaining video start/end and
    // future admin powers) or relink the room's context via upsert.
    const callerIsExistingAdmin = room.admins.includes(user.id);

    if (callerIsExistingAdmin) {
      // Update admins if different
      const currentAdmins = new Set(room.admins);
      const newAdmins = new Set(admins);
      const adminsChanged = currentAdmins.size !== newAdmins.size ||
                           [...currentAdmins].some(admin => !newAdmins.has(admin));

      if (adminsChanged) {
        updates.admins = admins;
      }

      // Link to context if provided and not already linked
      if (body.context && room.context !== body.context) {
        updates.context = body.context;
      }
    } else if (
      (body.admins && body.admins.length > 0) ||
      (body.context && room.context !== body.context)
    ) {
      // A non-admin attempted to change privileged fields — ignore those
      // fields silently rather than failing the idempotent upsert, but record
      // the rejected escalation attempt for audit/trace.
      logger?.warn({
        userId: user.id,
        roomId: room.id,
        attemptedAdmins: body.admins,
        attemptedContext: body.context,
        action: 'reject_upsert_privilege_escalation'
      }, 'Non-admin upsert attempted to change admins/context; ignored');
    }

    // Reactivate if archived
    if (room.status === 'archived') {
      updates.status = 'active';
    }

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      room = await repo.updateOneById(room.id, updates);

      logger?.info({
        userId: user.id,
        roomId: room.id,
        updates,
        action: 'update_existing_chat_room'
      }, 'Existing chat room updated');
    }
  } else {
    // Create new room
    room = await repo.createOne({
      organizationId,
      name: isChannel ? body.name : undefined,
      roomType,
      participants,
      admins,
      context: body.context,
      status: 'active',
      messageCount: 0,
      createdBy: user.id
    });

    created = true;

    // FIX-007: populate the chat_room_member join table so the membership model
    // is authoritative for channels (creator joins as admin). Members auto-join
    // later via the membership.created domain-event consumer.
    if (isChannel) {
      const memberRepo = new ChatRoomMemberRepository(db, logger);
      await memberRepo.addMember(room.id, user.id, 'admin');
    }

    logger?.info({
      userId: user.id,
      roomId: room.id,
      roomType,
      name: isChannel ? body.name : undefined,
      participants,
      admins,
      context: body.context,
      action: 'create_chat_room'
    }, 'New chat room created');
  }

  // FIX-017: surface the room id to the per-route x-audit middleware (the op has
  // no path param, so without this the audit row would record resource 'unknown').
  ctx.set('auditResourceId', room.id);

  // Return appropriate status code
  const statusCode = created ? 201 : 200;

  return ctx.json({
    ...room,
    created // Include flag to indicate if room was newly created
  }, statusCode);
}