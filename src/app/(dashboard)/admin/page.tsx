import { prisma } from "@/lib/prisma";
import { requireModule } from "@/server/session";
import { AdminClient } from "@/components/admin/AdminClient";
import { listBackups } from "@/server/services/backup";

export const metadata = { title: "Administracja — ELEVATE OS" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireModule("admin");

  const [users, labels, auditLog, backups, clients, gdprRequests] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        anonymizedAt: true,
        position: true,
        fte: true,
        hourlyRate: true,
        lastLoginAt: true,
        _count: { select: { ownedProjects: true, tasks: true } },
      },
      orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
    }),
    prisma.configLabel.findMany({ orderBy: [{ kind: "asc" }, { position: "asc" }] }),
    prisma.auditLog.findMany({
      include: { user: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    listBackups(),
    prisma.client.findMany({
      select: { id: true, name: true, anonymizedAt: true },
      orderBy: { name: "asc" },
    }),
    prisma.gdprRequest.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  return (
    <AdminClient
      currentUserId={user.id}
      users={users.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        isActive: u.isActive,
        anonymized: !!u.anonymizedAt,
        position: u.position,
        fte: u.fte,
        hourlyRate: u.hourlyRate,
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
        ownedProjects: u._count.ownedProjects,
        tasks: u._count.tasks,
      }))}
      labels={labels}
      backups={backups}
      gdprClients={clients.map((c) => ({
        id: c.id,
        label: c.name,
        anonymized: !!c.anonymizedAt,
      }))}
      gdprRequests={gdprRequests.map((r) => ({
        id: r.id,
        kind: r.kind,
        subjectType: r.subjectType,
        subjectId: r.subjectId,
        subjectLabel: r.subjectLabel,
        status: r.status,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
      }))}
      auditLog={auditLog.map((a) => ({
        id: a.id,
        action: a.action,
        entity: a.entity,
        entityId: a.entityId,
        userName: a.user?.fullName ?? "system",
        createdAt: a.createdAt.toISOString(),
      }))}
    />
  );
}
