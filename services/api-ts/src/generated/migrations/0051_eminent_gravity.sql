CREATE TYPE "public"."chat_room_member_role" AS ENUM('member', 'admin');--> statement-breakpoint
CREATE TYPE "public"."chat_room_type" AS ENUM('channel', 'dm', 'group');--> statement-breakpoint
CREATE TABLE "chat_room_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_room_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role" "chat_room_member_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_read_at" timestamp with time zone,
	"muted_until" timestamp with time zone,
	CONSTRAINT "chat_room_members_unique" UNIQUE("chat_room_id","person_id")
);
--> statement-breakpoint
ALTER TABLE "survey_response" ALTER COLUMN "responder_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_room" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "chat_room" ADD COLUMN "room_type" "chat_room_type" DEFAULT 'group' NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_room_member" ADD CONSTRAINT "chat_room_member_chat_room_id_chat_room_id_fk" FOREIGN KEY ("chat_room_id") REFERENCES "public"."chat_room"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_room_members_room_idx" ON "chat_room_member" USING btree ("chat_room_id");--> statement-breakpoint
CREATE INDEX "chat_room_members_person_idx" ON "chat_room_member" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "chat_room_members_room_role_idx" ON "chat_room_member" USING btree ("chat_room_id","role");--> statement-breakpoint
CREATE INDEX "chat_rooms_room_type_idx" ON "chat_room" USING btree ("room_type");--> statement-breakpoint
CREATE INDEX "chat_rooms_org_room_type_idx" ON "chat_room" USING btree ("organization_id","room_type");