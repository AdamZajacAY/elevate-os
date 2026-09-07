import { prisma } from "@/lib/prisma";
import { withAuth, ok, fail } from "@/server/api";
import { canReadAllProjects } from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };

/** Odhaczenie pozycji checklisty — odwracalne, z zapisem kto i kiedy. */
export const PATCH = withAuth<Ctx>("projects", async (user, req, ctx) => {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { isDone?: boolean };
  if (typeof body.isDone !== "boolean") return fail(422, "Pole isDone musi byc logiczne");

  const item = await prisma.projectChecklistItem.findUnique({
    where: { id },
    include: { project: { select: { ownerId: true, tasks: { select: { assigneeId: true } } } } },
  });
  if (!item) return fail(404, "Pozycja checklisty nie istnieje");

  const mayWrite =
    canReadAllProjects(user.role) ||
    item.project.ownerId === user.id ||
    item.project.tasks.some((t) => t.assigneeId === user.id);
  if (!mayWrite) return fail(403, "Brak uprawnien do zapisu");

  const updated = await prisma.projectChecklistItem.update({
    where: { id },
    data: {
      isDone: body.isDone,
      doneAt: body.isDone ? new Date() : null,
      doneById: body.isDone ? user.id : null,
    },
  });
  return ok(updated);
});
