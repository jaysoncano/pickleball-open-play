ALTER TABLE "players" ADD COLUMN "first_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "last_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Split existing full names: last word is the last name, the rest first.
UPDATE "players" SET
  "first_name" = CASE WHEN position(' ' in trim("full_name")) > 0
    THEN regexp_replace(trim("full_name"), '\s+\S+$', '') ELSE trim("full_name") END,
  "last_name" = CASE WHEN position(' ' in trim("full_name")) > 0
    THEN substring(trim("full_name") from '\S+$') ELSE '' END
WHERE "full_name" <> '';
