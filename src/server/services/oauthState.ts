import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Parametr `state` w przepływie OAuth — chroni przed CSRF: bez niego ktoś mógłby
 * podstawić własny kod autoryzacyjny i podpiąć swój kalendarz pod cudze konto.
 *
 * Podpisujemy id użytkownika i znacznik czasu sekretem aplikacji, więc nie trzeba
 * trzymać stanu po stronie serwera.
 */

const MAX_AGE_MS = 10 * 60_000;

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET jest wymagany do podpisania stanu OAuth");
  return value;
}

export function signState(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  const signature = createHmac("sha256", secret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export function verifyState(state: string): string | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const [userId, issuedAt, signature] = decoded.split(".");
    if (!userId || !issuedAt || !signature) return null;

    const expected = createHmac("sha256", secret()).update(`${userId}.${issuedAt}`).digest("hex");
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    // Porownanie stałoczasowe — zwykłe === wycieka informację przez czas odpowiedzi.
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    if (Date.now() - Number(issuedAt) > MAX_AGE_MS) return null;
    return userId;
  } catch {
    return null;
  }
}
