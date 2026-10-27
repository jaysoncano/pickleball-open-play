ALTER TABLE "players" ADD COLUMN "email_confirmed_at" timestamp with time zone;--> statement-breakpoint
-- Emails saved before this column existed were all confirmed by a code.
UPDATE "players" SET "email_confirmed_at" = now() WHERE "email" IS NOT NULL;
