CREATE TABLE "open_plays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"play_date" date NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"min_level" "level" NOT NULL,
	"max_level" "level" NOT NULL,
	"max_pairs" integer,
	"fee_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "open_plays" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pairs" ADD COLUMN "open_play_id" uuid;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "open_play_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "open_play_id" uuid;--> statement-breakpoint
ALTER TABLE "pairs" ADD CONSTRAINT "pairs_open_play_id_open_plays_id_fk" FOREIGN KEY ("open_play_id") REFERENCES "public"."open_plays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_open_play_id_open_plays_id_fk" FOREIGN KEY ("open_play_id") REFERENCES "public"."open_plays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_open_play_id_open_plays_id_fk" FOREIGN KEY ("open_play_id") REFERENCES "public"."open_plays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Existing sign-ups become one "All levels" open play per date.
INSERT INTO "open_plays" ("play_date", "start_time", "end_time", "min_level", "max_level")
SELECT DISTINCT "play_date", '18:00', '21:00', 'beginner'::"level", 'pro'::"level"
FROM "registrations";--> statement-breakpoint
UPDATE "registrations" r SET "open_play_id" = o."id"
FROM "open_plays" o WHERE o."play_date" = r."play_date";--> statement-breakpoint
UPDATE "pairs" p SET "open_play_id" = o."id"
FROM "open_plays" o WHERE o."play_date" = p."play_date";--> statement-breakpoint
UPDATE "sessions" s SET "open_play_id" = o."id"
FROM "open_plays" o WHERE o."play_date" = s."play_date" AND s."status" = 'active';
