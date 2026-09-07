import { prisma } from "@/lib/prisma";
import { requireModule } from "@/server/session";
import { canReadAllProjects } from "@/lib/rbac";
import { TasksView } from "@/components/TasksView";

export const metadata = { title: "Zadania — ELEVATE OS" };
export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ widok?: string; projekt?: string }>;
}) {
  const user = await requireModule("tasks");
  const { widok, projekt } = await searchParams;

  // Konsultant widzi zadania z projektow, w ktorych uczestniczy.
  const projectScope = canReadAllProjects(user.role)
    ? {}
    : { OR: [{ ownerId: user.id }, { tasks: { some: { assigneeId: user.id } } }] };

  const [tasks, projects, assignees] = await Promise.all([
    prisma.task.findMany({
      where: {
        project: projectScope,
        ...(projekt ? { projectId: projekt } : {}),
      },
      // `select` zamiast `include`: widok nie uzywa `description`, a to pole
      // tekstowe bez limitu dlugosci na kazdym wierszu.
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        estimatedHours: true,
        actualHours: true,
        assigneeId: true,
        project: { select: { id: true, code: true, name: true } },
        assignee: { select: { id: true, fullName: true } },
        expert: { select: { id: true, fullName: true } },
      },
      orderBy: [{ position: "asc" }, { dueDate: "asc" }],
      take: 500,
    }),
    prisma.project.findMany({
      where: { ...projectScope, status: { not: "CLOSED" } },
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  return (
    <TasksView
      tasks={tasks.map((t) => ({
        id: t.id,
        code: t.code,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        estimatedHours: t.estimatedHours,
        actualHours: t.actualHours,
        assigneeId: t.assigneeId,
        assigneeName: t.assignee?.fullName ?? t.expert?.fullName ?? null,
        projectId: t.project.id,
        projectCode: t.project.code,
        projectName: t.project.name,
      }))}
      projects={projects}
      assignees={assignees}
      currentUserId={user.id}
      initialView={widok === "moje" ? "moje" : widok === "lista" ? "lista" : "kanban"}
      initialProjectId={projekt ?? ""}
    />
  );
}
