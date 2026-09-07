import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { projectMemberUpdateSchema } from "@/server/validators/schemas";
import { canManageTasksIn } from "@/server/access";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

async function loadMember(id: string) {
  return prisma.projectMember.findUnique({ where: { id }, select: { projectId: true } });
}

export const PATCH = withAuth<Ctx>("projects", async (user, req, ctx) => {
  const { id } = await ctx.params;
  const member = await loadMember(id);
  if (!member) return fail(404, "Członek zespołu nie istnieje");
  if (!(await canManageTasksIn(user.id, user.role, member.projectId))) {
    return fail(403, "Brak uprawnien do tego projektu");
  }

  const data = await parseBody(req, projectMemberUpdateSchema);
  const updated = await prisma.projectMember.update({ where: { id }, data });
  await audit(user.id, "UPDATE", "projectMember", id, data);
  return ok(updated);
});

export const DELETE = withAuth<Ctx>("projects", async (user, _req, ctx) => {
  const { id } = await ctx.params;
  const member = await loadMember(id);
  if (!member) return fail(404, "Członek zespołu nie istnieje");
  if (!(await canManageTasksIn(user.id, user.role, member.projectId))) {
    return fail(403, "Brak uprawnien do tego projektu");
  }

  // Usuniecie ze skladu nie rusza zadan ani wpisow czasu tej osoby —
  // historia pracy zostaje przy projekcie.
  await prisma.projectMember.delete({ where: { id } });
  await audit(user.id, "DELETE", "projectMember", id);
  return ok({ deleted: true });
});
