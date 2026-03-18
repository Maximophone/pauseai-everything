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
  providers: [Google],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      // Always refresh admin status from DB + ADMIN_EMAILS env var
      if (token.id) {
        const adminEmails = (process.env.ADMIN_EMAILS ?? "")
          .split(",")
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean);

        const [dbUser] = await db
          .select({ isAdmin: users.isAdmin, email: users.email })
          .from(users)
          .where(eq(users.id, token.id as string));

        if (dbUser) {
          const isEnvAdmin = dbUser.email
            ? adminEmails.includes(dbUser.email.toLowerCase())
            : false;

          if (isEnvAdmin && !dbUser.isAdmin) {
            // Auto-promote configured admin emails
            await db
              .update(users)
              .set({ isAdmin: true })
              .where(eq(users.id, token.id as string));
            token.isAdmin = true;
          } else {
            token.isAdmin = dbUser.isAdmin;
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        // @ts-expect-error - extending session type
        session.user.isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
