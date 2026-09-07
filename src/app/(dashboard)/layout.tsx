import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/session";
import { Sidebar } from "@/components/Sidebar";
import { ThemeScript } from "@/components/ThemeScript";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });

  return (
    <div className="min-h-screen bg-bg">
      <ThemeScript theme={user.theme} />
      <div className="mx-auto flex max-w-[1500px]">
        <Sidebar
          user={{ fullName: user.fullName, role: user.role, email: user.email }}
          unreadCount={unreadCount}
        />
        <main className="min-w-0 flex-1 px-6 py-7 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
