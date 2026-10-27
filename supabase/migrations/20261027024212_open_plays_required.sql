DROP INDEX "registrations_player_day_key";--> statement-breakpoint
ALTER TABLE "pairs" ALTER COLUMN "open_play_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "open_play_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_player_open_play_key" ON "registrations" USING btree ("player_id","open_play_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_live_open_play_key" ON "sessions" USING btree ("open_play_id") WHERE "sessions"."status" = 'active';--> statement-breakpoint
ALTER TABLE "pairs" DROP COLUMN "play_date";--> statement-breakpoint
ALTER TABLE "registrations" DROP COLUMN "play_date";--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "play_date";