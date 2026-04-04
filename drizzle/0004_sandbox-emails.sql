CREATE TABLE "sandbox_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" text NOT NULL,
	"to_email" text NOT NULL,
	"to_name" text,
	"from_email" text NOT NULL,
	"from_name" text,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb,
	"template_params" jsonb,
	"campaign_id" uuid,
	"workspace_id" uuid,
	"status" text DEFAULT 'sent' NOT NULL,
	"status_history" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sandbox_emails_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
ALTER TABLE "sandbox_emails" ADD CONSTRAINT "sandbox_emails_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_emails" ADD CONSTRAINT "sandbox_emails_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;