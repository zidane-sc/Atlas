import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { timingSafeEqual } from "crypto";

const allowedEmails = (process.env.ALLOWED_EMAIL ?? "")
  .split(",")
  .map((email) => email.trim())
  .filter(Boolean);

const passcode = process.env.ATLAS_PASSCODE ?? "";

// Next.js always sets NODE_ENV=production for `next build`/`next start`/Vercel deploys,
// so this provider is unreachable outside `next dev` — no separate opt-in flag needed.
const isDev = process.env.NODE_ENV !== "production";

function verifyPasscode(input: string, expected: string): boolean {
  if (!expected) return false;
  const inputBuf = Buffer.from(input);
  const expectedBuf = Buffer.from(expected);
  if (inputBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(inputBuf, expectedBuf);
}

const providers = [
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
  // Passcode bypass — only enabled when ATLAS_PASSCODE is explicitly set (prod or dev).
  ...(passcode
    ? [
        Credentials({
          id: "passcode",
          name: "Passcode",
          credentials: {
            passcode: { label: "Passcode", type: "password", placeholder: "Enter passcode" },
          },
          authorize(credentials) {
            const input = credentials?.passcode;
            if (typeof input === "string" && verifyPasscode(input, passcode)) {
              const email = allowedEmails[0];
              return { id: "passcode-user", email, name: "Passcode" };
            }
            return null;
          },
        }),
      ]
    : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
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
