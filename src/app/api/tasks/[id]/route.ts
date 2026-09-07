import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { taskUpdateSchema } from "@/server/validators/schemas";
import { canReadAllProjects, isAdmin } from "@/lib/rbac";
import { refreshRag } from "@/server/services/rag";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withAuth<Ctx>("tasks", async (user, req, ctx) => {
  const { id } = await ctx.params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: { project: { select: { id: true, ownerId: true } } },
  });
  if (!task) return fail(404, "Zadanie nie istnieje");

  // Konsultant edytuje wylacznie zadania przypisane do siebie albo na wlasnym projekcie.
  const mayWrite =
    canReadAllProjects(user.role) ||
    task.assigneeId === user.id ||
    task.project.ownerId === user.id;
  if (!mayWrite) return fail(403, "Brak uprawnien do zapisu zadania");

  const data = await parseBody(req, taskUpdateSchema);
  const completedAt =
    data.status === "DONE" ? task.completedAt ?? new Date() : data.status ? null : task.completedAt;

  const updated = await prisma.task.update({
    where: { id },
    data: { ...data, completedAt },
  });

  await refreshRag(task.projectId);
  await audit(user.id, "UPDATE", "task", id, data);
  return ok(updated);
});

export const DELETE = withAuth<Ctx>("tasks", async (user, _req, ctx) => {
  const { id } = await ctx.params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: { project: { select: { ownerId: true } } },
  });
  if (!task) return fail(404, "Zadanie nie istnieje");
  if (!isAdmin(user.role) && task.project.ownerId !== user.id) {
    return fail(403, "Usuwac moze Administrator albo opiekun projektu");
  }

  await prisma.task.delete({ where: { id } });
  await refreshRag(task.projectId);
  await audit(user.id, "DELETE", "task", id);
  return ok({ deleted: true });
});
