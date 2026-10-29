CREATE TYPE "public"."open_play_kind" AS ENUM('regular', 'ranked');--> statement-breakpoint
DROP INDEX "players_name_key";--> statement-breakpoint
ALTER TABLE "open_plays" ADD COLUMN "kind" "open_play_kind" DEFAULT 'ranked' NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "guest" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "players_name_key" ON "players" USING btree (lower("name")) WHERE not "players"."guest";