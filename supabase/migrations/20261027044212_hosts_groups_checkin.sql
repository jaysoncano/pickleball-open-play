CREATE TABLE "account_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "group_logos" (
	"admin_id" uuid PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"data" "bytea" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "group_logos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "open_play_invites" (
	"open_play_id" uuid NOT NULL,
	"email" text NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "open_play_invites_open_play_id_email_pk" PRIMARY KEY("open_play_id","email")
);
--> statement-breakpoint
ALTER TABLE "open_play_invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "group_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "logo_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "checked_in_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account_codes" ADD CONSTRAINT "account_codes_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_logos" ADD CONSTRAINT "group_logos_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_play_invites" ADD CONSTRAINT "open_play_invites_open_play_id_open_plays_id_fk" FOREIGN KEY ("open_play_id") REFERENCES "public"."open_plays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_play_invites" ADD CONSTRAINT "open_play_invites_invited_by_admins_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admins" ADD CONSTRAINT "admins_email_unique" UNIQUE("email");