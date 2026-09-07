import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/session";
import { NotificationsClient } from "@/components/notifications/NotificationsClient";

export const metadata = { title: "Powiadomienia — ELEVATE OS" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireUser();

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  return (
    <NotificationsClient
      isAdmin={user.role === "ADMIN"}
      urgentDays={user.urgentDays}
      notifications={notifications.map((n) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        link: n.link,
        readAt: n.readAt ? n.readAt.toISOString() : null,
        createdAt: n.createdAt.toISOString(),
      }))}
    />
  );
}
