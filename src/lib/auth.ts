import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

const allowedEmail = process.env.ALLOWED_EMAIL;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth",
  },
  callbacks: {
    // Atlas is single-user — reject anyone whose GitHub email isn't the allow-listed one (docs/02-architecture.md §6).
    signIn({ profile }) {
      return Boolean(allowedEmail) && profile?.email === allowedEmail;
    },
  },
});
