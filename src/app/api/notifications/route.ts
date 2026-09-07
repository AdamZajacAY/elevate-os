import { prisma } from "@/lib/prisma";
import { withAuth, ok } from "@/server/api";

export const GET = withAuth("dashboard", async (user, req) => {
  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "1";

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id, ...(unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unread = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });

  return ok({ notifications, unread });
});

/** Oznaczenie jako przeczytane — pojedynczo albo wszystkich naraz. */
export const PATCH = withAuth("dashboard", async (user, req) => {
  const body = (await req.json().catch(() => ({}))) as { id?: string; all?: boolean };

  // `userId` w warunku, zeby nikt nie odczytal cudzej skrzynki podajac obce id.
  const updated = await prisma.notification.updateMany({
    where: {
      userId: user.id,
      readAt: null,
      ...(body.all ? {} : body.id ? { id: body.id } : { id: "__brak__" }),
    },
    data: { readAt: new Date() },
  });

  return ok({ marked: updated.count });
});
