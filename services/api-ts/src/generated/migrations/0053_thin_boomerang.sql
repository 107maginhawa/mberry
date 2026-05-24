CREATE TABLE "chat_message_reaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_message_reactions_unique" UNIQUE("message_id","person_id","emoji")
);
--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "parent_event_id" uuid;--> statement-breakpoint
ALTER TABLE "chat_message_reaction" ADD CONSTRAINT "chat_message_reaction_message_id_chat_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_message_reactions_message_idx" ON "chat_message_reaction" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_event_parent" ON "event" USING btree ("parent_event_id");