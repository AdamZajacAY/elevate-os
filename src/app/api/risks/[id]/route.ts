import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { riskUpdateSchema } from "@/server/validators/schemas";
import { canManageTasksIn } from "@/server/access";
import { refreshRag } from "@/server/services/rag";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withAuth<Ctx>("projects", async (user, req, ctx) => {
  const { id } = await ctx.params;
  const risk = await prisma.risk.findUnique({ where: { id }, select: { projectId: true } });
  if (!risk) return fail(404, "Ryzyko nie istnieje");
  if (!(await canManageTasksIn(user.id, user.role, risk.projectId))) {
    return fail(403, "Brak uprawnien do tego projektu");
  }

  const data = await parseBody(req, riskUpdateSchema);
  const updated = await prisma.risk.update({ where: { id }, data });

  await refreshRag(risk.projectId);
  await audit(user.id, "UPDATE", "risk", id, data);
  return ok(updated);
});

export const DELETE = withAuth<Ctx>("projects", async (user, _req, ctx) => {
  const { id } = await ctx.params;
  const risk = await prisma.risk.findUnique({ where: { id }, select: { projectId: true } });
  if (!risk) return fail(404, "Ryzyko nie istnieje");
  if (!(await canManageTasksIn(user.id, user.role, risk.projectId))) {
    return fail(403, "Brak uprawnien do tego projektu");
  }

  await prisma.risk.delete({ where: { id } });
  await refreshRag(risk.projectId);
  await audit(user.id, "DELETE", "risk", id);
  return ok({ deleted: true });
});
