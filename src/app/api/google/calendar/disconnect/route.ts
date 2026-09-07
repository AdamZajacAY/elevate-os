import { prisma } from "@/lib/prisma";
import { withAuth, ok } from "@/server/api";
import { revokeToken } from "@/server/services/googleOAuth";
import { audit } from "@/server/services/audit";
import { decryptSecret } from "@/server/services/crypto";

/**
 * Rozłączenie. Cofamy zgodę po stronie Google, zanim skasujemy tokeny u siebie —
 * inaczej token żyłby dalej, mimo że użytkownik uważa integrację za wyłączoną.
 * Kalendarz „ELEVATE OS" zostaje w koncie Google; użytkownik decyduje, czy go usunąć.
 */
export const POST = withAuth("dashboard", async (user) => {
  const link = await prisma.googleCalendarLink.findUnique({
    where: { userId: user.id },
    select: { refreshToken: true },
  });
  if (!link) return ok({ disconnected: false, reason: "brak-polaczenia" });

  await revokeToken(decryptSecret(link.refreshToken));
  await prisma.googleCalendarLink.delete({ where: { userId: user.id } });
  await audit(user.id, "DISCONNECT", "googleCalendar", user.id);

  return ok({ disconnected: true });
});
