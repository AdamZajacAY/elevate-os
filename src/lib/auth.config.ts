import type { NextAuthConfig } from "next-auth";

/**
 * Konfiguracja bezpieczna dla edge (middleware) — bez Prismy i bcrypta.
 * Pelna konfiguracja z providerem jest w src/lib/auth.ts.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id as string;
        token.role = (user as { role?: string }).role ?? "CONSULTANT";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
