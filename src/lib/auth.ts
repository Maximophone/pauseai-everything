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

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [Google],
  callbacks: {
    async session({ session, user }) {
      // Add isAdmin to the session so the client can check it
      if (session.user) {
        session.user.id = user.id;
        // @ts-expect-error - extending session type
        session.user.isAdmin = (user as typeof users.$inferSelect).isAdmin;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
