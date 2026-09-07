import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  exchangeCode,
  fetchGoogleEmail,
  googleCalendarConfigured,
} from "@/server/services/googleOAuth";
import { verifyState } from "@/server/services/oauthState";
import { audit } from "@/server/services/audit";
import { encryptSecret } from "@/server/services/crypto";

/**
 * Powrót ze zgody Google. Tożsamość bierze się z podpisanego `state`, nie z sesji —
 * przeglądarka wraca tu z domeny Google i ciasteczko sesji może nie dojechać.
 */
export async function GET(req: Request) {
  if (!googleCalendarConfigured()) redirect("/improvements?google=nieskonfigurowane");

  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  if (error) redirect(`/improvements?google=odmowa`);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) redirect("/improvements?google=blad");

  const userId = verifyState(state);
  if (!userId) redirect("/improvements?google=stan-nieprawidlowy");

  // Konto musi nadal istniec i byc aktywne — zgoda mogla wisiec w przegladarce
  // dluzej niz konto w systemie.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true },
  });
  if (!user?.isActive) redirect("/login");

  try {
    const tokens = await exchangeCode(code);

    // Bez refresh tokenu polaczenie umrze po godzinie — lepiej odmowic teraz
    // z czytelnym komunikatem niz zostawic integracje, ktora jutro przestanie dzialac.
    if (!tokens.refresh_token) {
      redirect("/improvements?google=brak-refresh");
    }

    const googleEmail = await fetchGoogleEmail(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.googleCalendarLink.upsert({
      where: { userId },
      update: {
        googleEmail,
        // Tokeny szyfrowane w spoczynku (RODO art. 32) — wyciek kopii bazy
        // nie moze oddac dostepu do kalendarzy uzytkownikow.
        accessToken: encryptSecret(tokens.access_token),
        refreshToken: encryptSecret(tokens.refresh_token!),
        expiresAt,
        scope: tokens.scope,
        lastSyncError: null,
      },
      create: {
        userId,
        googleEmail,
        accessToken: encryptSecret(tokens.access_token),
        refreshToken: encryptSecret(tokens.refresh_token!),
        expiresAt,
        scope: tokens.scope,
      },
    });

    await audit(userId, "CONNECT", "googleCalendar", userId, { googleEmail });
  } catch (err) {
    // `redirect()` dziala przez wyjatek — nie mozemy go zlapac jako bledu.
    if (err && typeof err === "object" && "digest" in err) throw err;
    console.error("[google-calendar] wymiana kodu nieudana", err);
    redirect("/improvements?google=blad");
  }

  redirect("/improvements?google=polaczono");
}
