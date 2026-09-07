import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { stageUpdateSchema } from "@/server/validators/schemas";
import { isAdmin } from "@/lib/rbac";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withAuth<Ctx>("gantt", async (user, req, ctx) => {
  const { id } = await ctx.params;
  const stage = await prisma.projectStage.findUnique({
    where: { id },
    include: { project: { select: { ownerId: true } } },
  });
  if (!stage) return fail(404, "Etap nie istnieje");
  if (user.role === "CONSULTANT" && stage.project.ownerId !== user.id) {
    return fail(403, "Harmonogram prowadzi opiekun projektu");
  }

  const data = await parseBody(req, stageUpdateSchema);
  const startDate = data.startDate ?? stage.startDate;
  const endDate = data.endDate ?? stage.endDate;
  if (endDate < startDate) return fail(422, "Data konca etapu nie moze byc wczesniejsza niz start");

  const updated = await prisma.projectStage.update({
    where: { id },
    data: { ...data, startDate, endDate },
  });
  await audit(user.id, "UPDATE", "stage", id, data);
  return ok(updated);
});

export const DELETE = withAuth<Ctx>("gantt", async (user, _req, ctx) => {
  const { id } = await ctx.params;
  const stage = await prisma.projectStage.findUnique({
    where: { id },
    include: { project: { select: { ownerId: true } } },
  });
  if (!stage) return fail(404, "Etap nie istnieje");
  if (!isAdmin(user.role) && stage.project.ownerId !== user.id) {
    return fail(403, "Brak uprawnien do usuniecia etapu");
  }
  await prisma.projectStage.delete({ where: { id } });
  await audit(user.id, "DELETE", "stage", id);
  return ok({ deleted: true });
});
