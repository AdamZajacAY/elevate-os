import { timingSafeEqual } from "node:crypto";
import { runRetentionCleanup } from "@/server/services/gdpr";
import { audit } from "@/server/services/audit";

/**
 * Sprzatanie retencyjne z harmonogramu (RODO art. 5 ust. 1 lit. e).
 *
 * Trasy wolane przez maszyny mieszkaja pod `/api/cron`, bo caly ten prefiks jest
 * wylaczony z middleware — scheduler nie ma ciasteczka sesji i przekierowanie
 * na /login byloby dla niego bezuzyteczne. Wersja dla Administratora
 * (z sesja) siedzi pod /api/gdpr/cleanup.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: "CRON_SECRET nie jest ustawiony — trasa wylaczona" },
      { status: 503 },
    );
  }

  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const result = await runRetentionCleanup();
  await audit(null, "GDPR_CLEANUP", "retention", null, result);
  return Response.json(result);
}
