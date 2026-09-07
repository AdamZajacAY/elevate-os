import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { scanForNotifications } from "@/server/services/notifications";
import { sendEmail, buildDigest } from "@/server/services/email";
import { syncToGoogleCalendar, recordSyncError } from "@/server/services/googleCalendar";
import { googleCalendarConfigured } from "@/server/services/googleOAuth";
import type { Role } from "@/lib/domain";
import { audit } from "@/server/services/audit";

/**
 * Skan proaktywny uruchamiany przez harmonogram (spec 11, Faza 5).
 *
 * Chroniony sekretem `CRON_SECRET` w nagłówku, nie sesją — scheduler nie ma
 * ciasteczka. Bez ustawionego sekretu trasa odmawia zawsze, żeby nie została
 * publicznym przyciskiem do generowania powiadomień.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: "CRON_SECRET nie jest ustawiony — trasa wyłączona" },
      { status: 503 },
    );
  }

  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  // Porownanie stałoczasowe — zwykle `!==` konczy sie na pierwszej roznicy
  // i wycieka dlugosc wspolnego prefiksu przez czas odpowiedzi.
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const result = await scanForNotifications();

  // Podsumowanie mailowe — jeden mail na osobę, nie jeden na powiadomienie.
  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3002";
  const recipients = await prisma.user.findMany({
    where: { isActive: true, notifications: { some: { readAt: null } } },
    select: {
      email: true,
      fullName: true,
      notifications: {
        where: { readAt: null },
        select: { title: true, body: true, link: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  // Wysylki sa niezalezne — szeregowe czekanie mnozylo latencje dostawcy
  // przez liczbe odbiorcow.
  const sendResults = await Promise.all(
    recipients.map((u) =>
      sendEmail({
        to: u.email,
        subject: `ELEVATE OS — ${u.notifications.length} nieprzeczytanych powiadomień`,
        text: buildDigest({ fullName: u.fullName, items: u.notifications, baseUrl }),
      }),
    ),
  );
  const emailsSent = sendResults.filter((r) => r.sent).length;

  // Synchronizacja kalendarzy Google — jedno konto po drugim, bo awaria u jednego
  // uzytkownika nie moze zablokowac reszty harmonogramu.
  let calendarsSynced = 0;
  let calendarsFailed = 0;

  if (googleCalendarConfigured()) {
    const linked = await prisma.googleCalendarLink.findMany({
      select: { userId: true, user: { select: { role: true, isActive: true } } },
    });

    for (const link of linked) {
      if (!link.user.isActive) continue;
      try {
        await syncToGoogleCalendar(link.userId, link.user.role as Role);
        calendarsSynced += 1;
      } catch (err) {
        calendarsFailed += 1;
        await recordSyncError(
          link.userId,
          err instanceof Error ? err.message : "Nieznany błąd synchronizacji",
        );
      }
    }
  }

  const summary = { ...result, emailsSent, calendarsSynced, calendarsFailed };
  await audit(null, "CRON_SCAN", "notification", null, summary);
  return Response.json(summary);
}
