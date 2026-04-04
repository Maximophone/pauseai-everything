-- Add workspace_id column to api_keys (nullable first for backfill)
ALTER TABLE "api_keys" ADD COLUMN "workspace_id" uuid;

-- Backfill existing keys with the global workspace (first workspace created)
UPDATE "api_keys" SET "workspace_id" = (SELECT "id" FROM "workspaces" ORDER BY "created_at" ASC LIMIT 1) WHERE "workspace_id" IS NULL;

-- Now make it NOT NULL and add the FK constraint
ALTER TABLE "api_keys" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
