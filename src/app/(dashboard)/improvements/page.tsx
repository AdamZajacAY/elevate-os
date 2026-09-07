import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/server/session";
import { isAdmin } from "@/lib/rbac";
import { ImprovementsClient } from "@/components/improvements/ImprovementsClient";

export const metadata = { title: "Panel Usprawnień — ELEVATE OS" };
export const dynamic = "force-dynamic";

export default async function ImprovementsPage() {
  const user = await requireModule("improvements");
  const admin = isAdmin(user.role);

  const improvements = await prisma.improvement.findMany({
    where: admin ? {} : { authorId: user.id },
    include: { author: { select: { id: true, fullName: true } } },
    orderBy: [{ createdAt: "desc" }],
  });

  return (
    <Suspense>
      <ImprovementsClient
      isAdmin={admin}
      currentUserId={user.id}
      preferences={{
        theme: user.theme,
        defaultView: user.defaultView,
        urgentDays: user.urgentDays,
      }}
      improvements={improvements.map((i) => ({
        id: i.id,
        title: i.title,
        body: i.body,
        status: i.status,
        adminNote: i.adminNote,
        authorId: i.author.id,
        authorName: i.author.fullName,
        createdAt: i.createdAt.toISOString(),
        }))}
      />
    </Suspense>
  );
}
