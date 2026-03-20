import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
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
  providers: [
    Google({
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      // Invite-only: only allow sign-in if the user's email already exists in the DB
      const email = user.email || profile?.email;
      if (!email) return false;

      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.toLowerCase()));

      if (!existingUser) {
        // Redirect to login with error message
        return "/login?error=not_invited";
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      // Always refresh role from DB + ADMIN_EMAILS env var
      if (token.id) {
        const adminEmails = (process.env.ADMIN_EMAILS ?? "")
          .split(",")
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean);

        const [dbUser] = await db
          .select({ role: users.role, email: users.email })
          .from(users)
          .where(eq(users.id, token.id as string));

        if (dbUser) {
          const isEnvAdmin = dbUser.email
            ? adminEmails.includes(dbUser.email.toLowerCase())
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
