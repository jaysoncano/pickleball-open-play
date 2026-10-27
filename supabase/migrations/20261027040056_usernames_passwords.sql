CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "admins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "password_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "players_username_key" ON "players" USING btree ("username");