import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/server/services/crypto";

/**
 * OAuth dla Google Calendar (spec 09).
 *
 * Zgoda na kalendarz jest **osobna od logowania**. Logowanie prosi tylko o e-mail
 * i imię; dostęp do kalendarza użytkownik nadaje świadomie, gdy tego chce, i może
 * go cofnąć bez tracenia możliwości logowania.
 */

/** Zapis wydarzeń w kalendarzu — najwęższy zakres, który wystarcza do synchronizacji. */
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
/** Potrzebny, żeby pokazać użytkownikowi, z którym kontem Google spiął narzędzie. */
const EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

export function googleCalendarConfigured(): boolean {
  return !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;
}

function redirectUri(): string {
  const base = process.env.AUTH_URL ?? "http://localhost:3002";
  return `${base}/api/google/calendar/callback`;
}

/**
 * Adres zgody. `access_type=offline` + `prompt=consent` są konieczne, żeby Google
 * oddało refresh token — bez niego połączenie umiera po godzinie i użytkownik
 * musiałby je klikać codziennie.
 */
export function buildConsentUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: `${CALENDAR_SCOPE} ${EMAIL_SCOPE}`,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Google odrzuciło żądanie tokenu (${res.status}): ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  return tokenRequest({
    code,
    client_id: process.env.AUTH_GOOGLE_ID!,
    client_secret: process.env.AUTH_GOOGLE_SECRET!,
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
  });
}

/** Adres e-mail konta, które wyraziło zgodę. */
export async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return "konto Google";
  const data = (await res.json()) as { email?: string };
  return data.email ?? "konto Google";
}

/**
 * Zwraca ważny access token, odświeżając go w razie potrzeby.
 * Minuta zapasu, żeby token nie wygasł w trakcie serii wywołań API.
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const link = await prisma.googleCalendarLink.findUnique({ where: { userId } });
  if (!link) return null;

  if (link.expiresAt.getTime() > Date.now() + 60_000) return decryptSecret(link.accessToken);

  try {
    const refreshed = await tokenRequest({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      refresh_token: decryptSecret(link.refreshToken),
      grant_type: "refresh_token",
    });

    await prisma.googleCalendarLink.update({
      where: { userId },
      data: {
        accessToken: encryptSecret(refreshed.access_token),
        expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        // Google zwykle nie oddaje nowego refresh tokenu przy odswiezeniu —
        // zostawiamy stary, chyba ze przyszedl nowy.
        ...(refreshed.refresh_token
          ? { refreshToken: encryptSecret(refreshed.refresh_token) }
          : {}),
        lastSyncError: null,
      },
    });
    return refreshed.access_token;
  } catch (err) {
    // Cofnieta zgoda po stronie Google objawia sie wlasnie tutaj.
    const message = err instanceof Error ? err.message : "nieznany błąd";
    await prisma.googleCalendarLink.update({
      where: { userId },
      data: { lastSyncError: `Odświeżenie tokenu nieudane: ${message}` },
    });
    return null;
  }
}

/** Cofnięcie zgody po stronie Google — bez tego token żyje dalej mimo rozłączenia u nas. */
export async function revokeToken(token: string): Promise<void> {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }).toString(),
  }).catch(() => {
    // Rozlaczenie u nas ma sie udac nawet, gdy Google jest nieosiagalne.
  });
}
