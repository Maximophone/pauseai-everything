/**
 * One-time migration: convert is_admin boolean to role enum.
 * Run this BEFORE drizzle-kit push to preserve admin status.
 *
 * Usage: npx tsx --env-file=.env src/db/migrate-roles.ts
 */
import { db } from "./index";
import { sql } from "drizzle-orm";

async function migrateRoles() {
  console.log("Starting role migration...");

  // 1. Create the enum type if it doesn't exist
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('admin', 'member', 'viewer');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  console.log("✓ Created user_role enum");

  // 2. Add the role column if it doesn't exist
  await db.execute(sql`
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" user_role NOT NULL DEFAULT 'viewer';
  `);
  console.log("✓ Added role column");

  // 3. Migrate existing admins: is_admin=true → role='admin', others → 'member'
  // (existing users who already signed in get 'member', not 'viewer',
  //  since they were previously trusted enough to have accounts)
  const result = await db.execute(sql`
    UPDATE "user"
    SET role = CASE
      WHEN is_admin = true THEN 'admin'::user_role
      ELSE 'member'::user_role
    END
    WHERE role = 'viewer'
    AND is_admin IS NOT NULL;
  `);
  console.log(`✓ Migrated existing users to roles`);

  // 4. Drop the is_admin column
  await db.execute(sql`
    ALTER TABLE "user" DROP COLUMN IF EXISTS "is_admin";
  `);
  console.log("✓ Dropped is_admin column");

  console.log("\nMigration complete! You can now run drizzle-kit push.");
  process.exit(0);
}

migrateRoles().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
