import { prisma } from "@/lib/prisma";

/** Limit prob logowania w oknie czasowym, liczony per para (IP, e-mail). Spec 10. */
const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;
/** Twardy limit na sam e-mail — dziala niezaleznie od tego, z ilu adresow ida proby. */
const MAX_ATTEMPTS_PER_EMAIL = 20;

/**
 * Adres klienta.
 *
 * `x-forwarded-for` jest naglowkiem od klienta i mozna go dowolnie zmyslic —
 * branie go na wiare zamienialo limit prob w atrape: wystarczylo inkrementowac
 * naglowek, zeby dostawac swiezy budzet piatki prob. Ufamy mu wylacznie wtedy,
 * gdy wdrozenie jawnie deklaruje, ze stoi za odwrotnym proxy (`TRUST_PROXY=true`).
 *
 * Niezaleznie od adresu dziala drugi, ostrzejszy limit na sam e-mail — dzieki
 * niemu podszycie sie pod inny adres nie omija ochrony konta.
 */
export function clientIp(headers?: Headers | null): string {
  if (process.env.TRUST_PROXY === "true" && headers) {
    const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
    const real = headers.get("x-real-ip")?.trim();
    if (real) return real;
  }
  return "unknown";
}

export async function checkLoginRateLimit(email: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000);

  const [failedForPair, failedForEmail] = await Promise.all([
    prisma.loginAttempt.count({ where: { email, ip, success: false, createdAt: { gte: since } } }),
    prisma.loginAttempt.count({ where: { email, success: false, createdAt: { gte: since } } }),
  ]);

  return failedForPair < MAX_ATTEMPTS && failedForEmail < MAX_ATTEMPTS_PER_EMAIL;
}

// Kasowanie starych prob logowania robi sprzatanie retencyjne w `gdpr.ts` —
// nie duplikujemy tu drugiego, konkurencyjnego okresu przechowywania.

export async function recordLoginAttempt(email: string, ip: string, success: boolean) {
  await prisma.loginAttempt.create({ data: { email, ip, success } });
  // Udane logowanie kasuje licznik nieudanych prob dla tej pary.
  if (success) {
    await prisma.loginAttempt.deleteMany({ where: { email, ip, success: false } });
  }
}
