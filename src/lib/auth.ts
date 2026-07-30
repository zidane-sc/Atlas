import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";

const allowedEmail = process.env.ALLOWED_EMAIL;

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
              if (!allowedEmail) return null;
              return { id: "dev-user", email: allowedEmail, name: "Dev" };
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
    // Atlas is single-user — reject anyone whose email isn't the allow-listed one (docs/02-architecture.md §6).
    signIn({ user, profile }) {
      const email = profile?.email ?? user?.email;
      return Boolean(allowedEmail) && email === allowedEmail;
    },
  },
});
