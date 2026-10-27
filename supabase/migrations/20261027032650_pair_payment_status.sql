CREATE TYPE "public"."pair_status" AS ENUM('pending', 'paid');--> statement-breakpoint
ALTER TABLE "pairs" ALTER COLUMN "amount_cents" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pairs" ALTER COLUMN "method" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pairs" ADD COLUMN "status" "pair_status" DEFAULT 'paid' NOT NULL;--> statement-breakpoint
ALTER TABLE "pairs" ADD COLUMN "requested_level" "level";--> statement-breakpoint
ALTER TABLE "pairs" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
-- Pairs recorded before this were paid at the desk.
UPDATE "pairs" SET "paid_at" = "created_at" WHERE "status" = 'paid';
