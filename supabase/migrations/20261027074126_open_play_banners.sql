CREATE TABLE "open_play_banners" (
	"open_play_id" uuid PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"data" "bytea" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "open_play_banners" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "open_plays" ADD COLUMN "banner_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "open_play_banners" ADD CONSTRAINT "open_play_banners_open_play_id_open_plays_id_fk" FOREIGN KEY ("open_play_id") REFERENCES "public"."open_plays"("id") ON DELETE cascade ON UPDATE no action;