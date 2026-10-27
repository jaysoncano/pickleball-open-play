ALTER TABLE "open_plays" ALTER COLUMN "levels" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "open_plays" DROP COLUMN "min_level";--> statement-breakpoint
ALTER TABLE "open_plays" DROP COLUMN "max_level";