import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { checkLoginRateLimit, recordLoginAttempt, clientIp } from "@/server/services/loginGuard";
import { audit } from "@/server/services/audit";

/**
 * Logowanie Google (spec 09) — "logowanie bez zarzadzania kolejnym haslem".
 * Provider wchodzi do konfiguracji tylko wtedy, gdy sa klucze; bez nich caly
 * mechanizm nie istnieje, zamiast wysypywac sie przy probie uzycia.
 */
export const googleEnabled = !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    /**
     * OAuth nie zaklada kont. Zalogowac sie moze wylacznie ktos, komu
     * Administrator wczesniej utworzyl konto — inaczej kazdy adres Google
     * bylby przepustka do platformy.
     */
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;

      const email = profile?.email?.toLowerCase();
      if (!email) return false;
      // Google potrafi zwrocic adres niezweryfikowany — przyjecie go pozwoliloby
      // wejsc na cudze konto, gdyby ktos zarejestrowal u siebie ten sam adres.
      if (profile?.email_verified === false) return false;

      // Ograniczenie do domeny Workspace. `hd` z profilu mowi, do jakiej domeny
      // nalezy konto — samo dopasowanie koncowki adresu nie wystarcza, bo alias
      // z innej domeny moze konczyc sie tak samo.
      const domain = process.env.GOOGLE_WORKSPACE_DOMAIN?.toLowerCase();
      if (domain) {
        const hd = (profile as { hd?: string }).hd?.toLowerCase();
        if (hd !== domain && !email.endsWith(`@${domain}`)) return false;
      }

      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, isActive: true },
      });

      if (user) {
        if (!user.isActive) return false;
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return true;
      }

      // Konto nie istnieje. Zakladamy je automatycznie WYLACZNIE dla domeny
      // Workspace — bez ustawionego `GOOGLE_WORKSPACE_DOMAIN` byloby to zaproszenie
      // dla dowolnego adresu Google.
      if (!domain) return false;

      const created = await prisma.user.create({
        data: {
          email,
          fullName: profile?.name ?? email.split("@")[0],
          // Najnizsze uprawnienia na start — role Partner i Administrator
          // nadaje czlowiek w panelu administracyjnym.
          role: "CONSULTANT",
          isActive: true,
          lastLoginAt: new Date(),
        },
        select: { id: true },
      });
      await audit(created.id, "AUTO_PROVISION", "user", created.id, { email, domain });
      return true;
    },

    /**
     * Google zwraca wlasne `sub` jako id — podmieniamy je na id konta z naszej
     * bazy, zeby reszta aplikacji dostawala jeden spojny identyfikator.
     */
    async jwt({ token, user, account }) {
      if (account?.provider === "google" && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email.toLowerCase() },
          select: { id: true, role: true },
        });
        if (dbUser) {
          token.uid = dbUser.id;
          token.role = dbUser.role;
        }
        return token;
      }
      return authConfig.callbacks.jwt({ token, user });
    },
  },
  providers: [
    ...(googleEnabled
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!,
            // Reszta profilu Google jest odrzucana (spec 09) — bierzemy e-mail i imie.
            allowDangerousEmailAccountLinking: false,
            authorization: {
              params: {
                // `hd` podpowiada Google, zeby od razu pokazac konta z naszej domeny.
                // To wygoda, nie zabezpieczenie — domene weryfikujemy w `signIn`.
                ...(process.env.GOOGLE_WORKSPACE_DOMAIN
                  ? { hd: process.env.GOOGLE_WORKSPACE_DOMAIN }
                  : {}),
                prompt: "select_account",
              },
            },
          }),
        ]
      : []),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const ip = clientIp(request?.headers);

        // Blokada logowania — limit prob w oknie czasowym per para (IP, e-mail). Spec 10.
        if (!(await checkLoginRateLimit(email, ip))) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        const ok =
          !!user?.passwordHash &&
          user.isActive &&
          (await bcrypt.compare(password, user.passwordHash));

        await recordLoginAttempt(email, ip, ok);
        if (!ok || !user) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return { id: user.id, email: user.email, name: user.fullName, role: user.role };
      },
    }),
  ],
});
