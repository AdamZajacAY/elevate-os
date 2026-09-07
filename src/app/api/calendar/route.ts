import type { Role } from "@/lib/domain";
import { buildCalendar } from "@/server/services/calendar";
import { userByCalendarToken } from "@/server/services/calendarToken";
import { getCurrentUser } from "@/server/session";

/**
 * Feed iCal (spec 09). Ta trasa jest wyłączona z middleware, bo aplikacja
 * kalendarza nie obsłuży przekierowania na /login — autoryzuje się tokenem
 * w adresie. Zalogowany użytkownik może pobrać feed także bez tokenu.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");

  const owner = token
    ? await userByCalendarToken(token)
    : await getCurrentUser().then((u) => (u ? { id: u.id, role: u.role } : null));

  if (!owner) {
    return new Response("Nieprawidłowy token subskrypcji", { status: 401 });
  }

  const ics = await buildCalendar(owner.id, owner.role as Role);

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="elevate-os.ics"',
      // Kalendarze odpytują cyklicznie — krótki cache zdejmuje szczyt bez opóźnień.
      "Cache-Control": "private, max-age=300",
    },
  });
}
