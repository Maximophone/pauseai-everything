-- Convert sync_interval_minutes from text to integer
ALTER TABLE "email_connections" ALTER COLUMN "sync_interval_minutes" SET DATA TYPE integer USING "sync_interval_minutes"::integer;--> statement-breakpoint
ALTER TABLE "email_connections" ALTER COLUMN "sync_interval_minutes" SET DEFAULT 5;
