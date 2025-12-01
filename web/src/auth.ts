import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import { sendWelcomeEmail } from "./lib/email";

const prisma = new PrismaClient();

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        // @ts-expect-error isEarlyAdopter is not yet in the type definition but is in the DB
        session.user.isEarlyAdopter = user.isEarlyAdopter;
      }
      return session;
    },
  },
  events: {
    async signIn({ user, isNewUser }) {
      if (isNewUser && user.email && user.name) {
        await sendWelcomeEmail(user.email, user.name);
      }
    },
  },
});
