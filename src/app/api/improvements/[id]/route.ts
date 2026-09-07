import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { improvementUpdateSchema } from "@/server/validators/schemas";
import { isAdmin } from "@/lib/rbac";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

/** Rozpatrywanie zgloszen nalezy do Administratora (spec 06). */
export const PATCH = withAuth<Ctx>("improvements", async (user, req, ctx) => {
  const { id } = await ctx.params;
  if (!isAdmin(user.role)) return fail(403, "Zgłoszenia rozpatruje Administrator");

  const data = await parseBody(req, improvementUpdateSchema);
  const improvement = await prisma.improvement.update({ where: { id }, data });
  await audit(user.id, "UPDATE", "improvement", id, data);
  return ok(improvement);
});

export const DELETE = withAuth<Ctx>("improvements", async (user, _req, ctx) => {
  const { id } = await ctx.params;
  const improvement = await prisma.improvement.findUnique({ where: { id } });
  if (!improvement) return fail(404, "Zgłoszenie nie istnieje");
  // Autor moze wycofac wlasne zgloszenie, Administrator kazde.
  if (!isAdmin(user.role) && improvement.authorId !== user.id) {
    return fail(403, "Możesz wycofać tylko własne zgłoszenie");
  }

  await prisma.improvement.delete({ where: { id } });
  await audit(user.id, "DELETE", "improvement", id);
  return ok({ deleted: true });
});
