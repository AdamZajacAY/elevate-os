import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { taskCreateSchema } from "@/server/validators/schemas";
import { canReadAllProjects } from "@/lib/rbac";
import { canManageTasksIn } from "@/server/access";
import { nextCode } from "@/server/services/counter";
import { refreshRag } from "@/server/services/rag";
import { audit } from "@/server/services/audit";

export const GET = withAuth("tasks", async (user, req) => {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const status = url.searchParams.get("status");
  const mine = url.searchParams.get("mine") === "1";

  // Konsultant widzi zadania z projektow, w ktorych uczestniczy.
  const scope = canReadAllProjects(user.role)
    ? {}
    : { project: { OR: [{ ownerId: user.id }, { tasks: { some: { assigneeId: user.id } } }] } };

  const tasks = await prisma.task.findMany({
    where: {
      ...scope,
      ...(projectId ? { projectId } : {}),
      ...(status ? { status } : {}),
      ...(mine ? { assigneeId: user.id } : {}),
    },
    include: {
      project: { select: { id: true, code: true, name: true, phase: true } },
      assignee: { select: { id: true, fullName: true } },
      expert: { select: { id: true, fullName: true } },
      _count: { select: { comments: true } },
    },
    orderBy: [{ dueDate: "asc" }, { position: "asc" }],
  });

  return ok(tasks);
});

export const POST = withAuth("tasks", async (user, req) => {
  const data = await parseBody(req, taskCreateSchema);

  // Samo istnienie projektu nie wystarcza: bez tego sprawdzenia konsultant
  // zakladal zadanie w cudzym projekcie i — przez `projectScopeWhere`, ktory
  // przyznaje odczyt wykonawcom zadan — zyskiwal tym samym dostep do calego projektu.
  if (!(await canManageTasksIn(user.id, user.role, data.projectId))) {
    return fail(403, "Brak uprawnien do zakladania zadan w tym projekcie");
  }

  const code = await nextCode("ZAD");
  const task = await prisma.task.create({
    data: {
      code,
      projectId: data.projectId,
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      assigneeId: data.assigneeId ?? null,
      expertId: data.expertId ?? null,
      stageId: data.stageId ?? null,
      estimatedHours: data.estimatedHours ?? null,
      dueDate: data.dueDate,
    },
  });

  await refreshRag(data.projectId);
  await audit(user.id, "CREATE", "task", task.id, { code });
  return ok(task, 201);
});
