ALTER TABLE "open_plays" ADD COLUMN "levels" "level"[];--> statement-breakpoint
-- A range becomes the list of every level in it.
UPDATE "open_plays" SET "levels" = enum_range("min_level", "max_level");
