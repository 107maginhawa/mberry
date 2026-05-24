ALTER TABLE "chat_message" ADD COLUMN "parent_message_id" uuid;--> statement-breakpoint
ALTER TABLE "chat_message" ADD COLUMN "reply_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "bio" text;--> statement-breakpoint
CREATE INDEX "chat_messages_parent_message_idx" ON "chat_message" USING btree ("parent_message_id");