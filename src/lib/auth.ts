import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/db/schema/users";
import { eq } from "drizzle-orm";
import type { UserRole } from "@/db/schema/users";
import type { Provider } from "next-auth/providers";
import { userWorkspaces, workspaces } from "@/db/schema/workspaces";
import { addUserToWorkspace } from "@/lib/workspaces";

const isDev = process.env.NODE_ENV === "development";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const providers: Provider[] = [
  // Required so invited users (no `account` row yet) can link via Google
  // on first sign-in; the email_verified guard + invite-only check below
  // are the compensating controls. See BUGS.md #24.
  Google({ allowDangerousEmailAccountLinking: true }),
];

// Dev-only Credentials provider — lets you sign in as any email
if (isDev) {
  providers.push(
    Credentials({
      id: "dev-login",
      name: "Dev Login",
      credentials: {
        email: { label: "Email", type: "email" },
        name: { label: "Name", type: "text" },
        role: { label: "Role", type: "text" },
        workspaceId: { label: "Workspace", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        const email = (credentials.email as string).toLowerCase().trim();
        const name = (credentials.name as string) || email.split("@")[0];
        const role = (credentials.role as UserRole) || "viewer";
        const workspaceId = (credentials.workspaceId as string) || undefined;

        // Find or create the user
        let [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email));

        if (!user) {
          // Auto-create in dev mode
          const [created] = await db
            .insert(users)
            .values({ email, name, role })
            .returning();
          user = created;
        } else {
          // Update name if not yet set, but never overwrite role
          // (role changes should be made through the UI, not on every login)
          if (!user.name && name) {
            await db
              .update(users)
              .set({ name })
              .where(eq(users.id, user.id));
            user = { ...user, name };
          }
        }

        // Auto-setup workspace memberships for dev users
        await setupDevWorkspaceMemberships(user.id, email, role, workspaceId);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    })
  );
}

/**
 * Set up workspace memberships for dev login users.
 * If a workspaceId is provided (from the login form dropdown), the user is
 * added to that specific workspace. Otherwise falls back to preset logic:
 * - france@pauseai.info → France workspace as admin
 * - Others → Global workspace with their role
 */
async function setupDevWorkspaceMemberships(
  userId: string,
  email: string,
  role: UserRole,
  workspaceId?: string
) {
  if (workspaceId) {
    // Explicit workspace selected in the dev login form
    await db
      .insert(userWorkspaces)
      .values({ userId, workspaceId, role })
      .onConflictDoNothing();
    return;
  }

  // Fallback: preset logic for known dev users
  const [globalWs] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.type, "global"))
    .limit(1);

  if (!globalWs) return; // No global workspace yet — seed first

  if (email === "france@pauseai.info") {
    // Create France workspace if it doesn't exist
    let [franceWs] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.slug, "france"))
      .limit(1);

    if (!franceWs) {
      const [created] = await db
        .insert(workspaces)
        .values({
          name: "Pause IA France",
          slug: "france",
          type: "chapter",
          defaultLanguage: "fr",
        })
        .returning();
      franceWs = created;
    }

    // Add to France workspace as admin
    await db
      .insert(userWorkspaces)
      .values({ userId, workspaceId: franceWs.id, role: "admin" })
      .onConflictDoNothing();
  } else {
    // Add to Global workspace with their role
    await db
      .insert(userWorkspaces)
      .values({ userId, workspaceId: globalWs.id, role })
      .onConflictDoNothing();
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: {
    strategy: "jwt",
  },
  providers,
  callbacks: {
    async signIn({ user, profile, account }) {
      // Skip invite check for dev credentials provider
      if (account?.provider === "dev-login") {
        return true;
      }

      // Pairs with allowDangerousEmailAccountLinking on the Google provider
      // — Google's email_verified flag is what makes the auto-link safe.
      if (account?.provider === "google" && profile?.email_verified !== true) {
        return "/login?error=email_not_verified";
      }

      const email = user.email || profile?.email;
      if (!email) return false;

      const normalizedEmail = email.toLowerCase();
      let [existingUser] = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.email, normalizedEmail));

      if (!existingUser) {
        if (!ADMIN_EMAILS.includes(normalizedEmail)) {
          return "/login?error=not_invited";
        }
        // Fail closed if Global is missing — otherwise we'd create a user row
        // with no workspace membership that subsequent sign-ins won't repair
        // (existingUser would be truthy, skipping this block entirely).
        const [globalWs] = await db
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(eq(workspaces.type, "global"))
          .limit(1);
        if (!globalWs) {
          console.error(
            `[auth] Cannot bootstrap admin ${normalizedEmail}: no Global workspace exists. Run \`npm run db:seed\`.`
          );
          return "/login?error=server_misconfigured";
        }
        // onConflictDoNothing covers concurrent first sign-ins for the same
        // email (e.g. double-click). RETURNING gives us the row directly when
        // we won the race; the SELECT fallback picks it up otherwise.
        const [created] = await db
          .insert(users)
          .values({ email: normalizedEmail, role: "admin" })
          .onConflictDoNothing({ target: users.email })
          .returning({ id: users.id, name: users.name });
        if (created) {
          existingUser = created;
        } else {
          [existingUser] = await db
            .select({ id: users.id, name: users.name })
            .from(users)
            .where(eq(users.email, normalizedEmail));
        }

        if (existingUser) {
          await addUserToWorkspace(existingUser.id, globalWs.id, "admin");
        }
      }

      // Update name and image from Google profile on first sign-in
      // (invited users have name=null until they actually sign in)
      if (!existingUser.name) {
        const name = profile?.name || user.name;
        const image = (profile?.picture as string) || user.image;
        await db
          .update(users)
          .set({
            ...(name ? { name } : {}),
            ...(image ? { image } : {}),
          })
          .where(eq(users.id, existingUser.id));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      if (token.id) {
        const [dbUser] = await db
          .select({ role: users.role, email: users.email })
          .from(users)
          .where(eq(users.id, token.id as string));

        if (dbUser) {
          const isEnvAdmin = dbUser.email
            ? ADMIN_EMAILS.includes(dbUser.email.toLowerCase())
            : false;

          if (isEnvAdmin && dbUser.role !== "admin") {
            // Auto-promote configured admin emails
            await db
              .update(users)
              .set({ role: "admin" })
              .where(eq(users.id, token.id as string));
            token.role = "admin";
          } else {
            token.role = dbUser.role;
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        // @ts-expect-error - extending session type
        session.user.role = (token.role as UserRole) || "viewer";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
