import { withAuth, ok } from "@/server/api";
import { ensureCalendarToken, rotateCalendarToken } from "@/server/services/calendarToken";
import { audit } from "@/server/services/audit";

/** Adres subskrypcji własnego kalendarza — token dotyczy zawsze konta z sesji. */
export const GET = withAuth("dashboard", async (user) => {
  return ok({ token: await ensureCalendarToken(user.id) });
});

/** Unieważnienie starego adresu i wydanie nowego. */
export const POST = withAuth("dashboard", async (user) => {
  const token = await rotateCalendarToken(user.id);
  await audit(user.id, "ROTATE", "calendarToken", user.id);
  return ok({ token });
});
