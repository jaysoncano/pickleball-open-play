CREATE TYPE "public"."hand" AS ENUM('right', 'left');--> statement-breakpoint
CREATE TABLE "email_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "player_photos" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"data" "bytea" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "full_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "phone" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "home_club" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "bio" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "hand" "hand";--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "claim_token" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "photo_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_codes" ADD CONSTRAINT "email_codes_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_photos" ADD CONSTRAINT "player_photos_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "players_email_key" ON "players" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "players_claim_token_key" ON "players" USING btree ("claim_token");