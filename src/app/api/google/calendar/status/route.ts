import { prisma } from "@/lib/prisma";
import { withAuth, ok } from "@/server/api";
import { googleCalendarConfigured } from "@/server/services/googleOAuth";

/** Metadane połączenia. Tokeny nie są tu selektowane — nigdy nie wychodzą na klienta. */
export const GET = withAuth("dashboard", async (user) => {
  const link = await prisma.googleCalendarLink.findUnique({
    where: { userId: user.id },
    select: {
      googleEmail: true,
      calendarId: true,
      lastSyncAt: true,
      lastSyncCount: true,
      lastSyncError: true,
      createdAt: true,
    },
  });

  return ok({ configured: googleCalendarConfigured(), link });
});
