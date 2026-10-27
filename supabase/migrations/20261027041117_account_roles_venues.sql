CREATE TYPE "public"."account_role" AS ENUM('admin', 'host');--> statement-breakpoint
CREATE TABLE "open_play_hosts" (
	"open_play_id" uuid NOT NULL,
	"admin_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "open_play_hosts_open_play_id_admin_id_pk" PRIMARY KEY("open_play_id","admin_id")
);
--> statement-breakpoint
ALTER TABLE "open_play_hosts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "role" "account_role" DEFAULT 'host' NOT NULL;--> statement-breakpoint
ALTER TABLE "open_plays" ADD COLUMN "venue" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "open_plays" ADD COLUMN "location" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "open_plays" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "open_play_hosts" ADD CONSTRAINT "open_play_hosts_open_play_id_open_plays_id_fk" FOREIGN KEY ("open_play_id") REFERENCES "public"."open_plays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_play_hosts" ADD CONSTRAINT "open_play_hosts_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_plays" ADD CONSTRAINT "open_plays_created_by_admins_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Accounts made before roles were all full admins: keep them that way.
UPDATE "admins" SET "role" = 'admin';--> statement-breakpoint
-- Older open plays belong to the first admin.
UPDATE "open_plays" SET "created_by" = (SELECT "id" FROM "admins" ORDER BY "created_at" LIMIT 1) WHERE "created_by" IS NULL;
