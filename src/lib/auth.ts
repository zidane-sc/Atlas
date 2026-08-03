import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";

const allowedEmails = (process.env.ALLOWED_EMAIL ?? "")
  .split(",")
  .map((email) => email.trim())
  .filter(Boolean);

// Next.js always sets NODE_ENV=production for `next build`/`next start`/Vercel deploys,
// so this provider is unreachable outside `next dev` — no separate opt-in flag needed.
const isDev = process.env.NODE_ENV !== "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub,
    ...(isDev
      ? [
          Credentials({
            id: "dev",
            name: "Dev Login",
            credentials: {},
            authorize() {
              const email = allowedEmails[0];
              if (!email) return null;
              return { id: "dev-user", email, name: "Dev" };
            },
          }),
        ]
      : []),
  ],
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth",
  },
  callbacks: {
    // Atlas is single-user per account, but multiple emails may map to that one account (docs/02-architecture.md §6).
    signIn({ user, profile }) {
      const email = profile?.email ?? user?.email;
      return Boolean(email) && allowedEmails.includes(email as string);
    },
    jwt({ token, trigger, session, user }) {
      if (user) {
        token.name = user.name;
      }
      if (trigger === "update" && session?.user?.name) {
        token.name = session.user.name;
      }
      return token;
    },
    session({ session, token }) {
      if (token?.name && session.user) {
        session.user.name = token.name as string;
      }
      return session;
    },
  },
});
