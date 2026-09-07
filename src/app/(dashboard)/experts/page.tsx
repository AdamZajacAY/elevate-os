import { prisma } from "@/lib/prisma";
import { requireModule } from "@/server/session";
import { canSeeFinancials } from "@/lib/rbac";
import { ExpertsClient } from "@/components/experts/ExpertsClient";

export const metadata = { title: "Eksperci — ELEVATE OS" };
export const dynamic = "force-dynamic";

export default async function ExpertsPage() {
  const user = await requireModule("experts");
  const showMoney = canSeeFinancials(user.role);

  const [experts, projects] = await Promise.all([
    prisma.externalExpert.findMany({
      include: {
        assignments: {
          include: { project: { select: { id: true, code: true, name: true, status: true } } },
        },
        _count: { select: { tasks: true } },
      },
      orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
    }),
    prisma.project.findMany({
      where: { status: { not: "CLOSED" } },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <ExpertsClient
      canManage={user.role !== "CONSULTANT"}
      showMoney={showMoney}
      projects={projects}
      experts={experts.map((e) => ({
        id: e.id,
        fullName: e.fullName,
        specialty: e.specialty,
        company: e.company,
        email: e.email,
        phone: e.phone,
        hourlyRate: showMoney ? e.hourlyRate : null,
        availability: e.availability,
        rating: e.rating,
        isActive: e.isActive,
        openTasks: e._count.tasks,
        assignments: e.assignments.map((a) => ({
          id: a.id,
          scope: a.scope,
          contractValue: showMoney ? a.contractValue : null,
          projectId: a.project.id,
          projectCode: a.project.code,
          projectName: a.project.name,
          projectStatus: a.project.status,
        })),
      }))}
    />
  );
}
