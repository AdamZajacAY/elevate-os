import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { milestoneUpdateSchema } from "@/server/validators/schemas";
import { canManageTasksIn } from "@/server/access";
import { refreshRag } from "@/server/services/rag";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withAuth<Ctx>("projects", async (user, req, ctx) => {
  const { id } = await ctx.params;
  const milestone = await prisma.milestone.findUnique({
    where: { id },
    select: { projectId: true },
  });
  if (!milestone) return fail(404, "Kamień milowy nie istnieje");
  if (!(await canManageTasksIn(user.id, user.role, milestone.projectId))) {
    return fail(403, "Brak uprawnien do tego projektu");
  }

  const data = await parseBody(req, milestoneUpdateSchema);
  const updated = await prisma.milestone.update({ where: { id }, data });

  await refreshRag(milestone.projectId);
  await audit(user.id, "UPDATE", "milestone", id, data);
  return ok(updated);
});

export const DELETE = withAuth<Ctx>("projects", async (user, _req, ctx) => {
  const { id } = await ctx.params;
  const milestone = await prisma.milestone.findUnique({
    where: { id },
    select: { projectId: true },
  });
  if (!milestone) return fail(404, "Kamień milowy nie istnieje");
  if (!(await canManageTasksIn(user.id, user.role, milestone.projectId))) {
    return fail(403, "Brak uprawnien do tego projektu");
  }

  await prisma.milestone.delete({ where: { id } });
  await refreshRag(milestone.projectId);
  await audit(user.id, "DELETE", "milestone", id);
  return ok({ deleted: true });
});
