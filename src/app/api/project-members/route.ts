import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { projectMemberCreateSchema } from "@/server/validators/schemas";
import { canManageTasksIn } from "@/server/access";
import { audit } from "@/server/services/audit";

/**
 * Sklad zespolu projektowego. Do tej pory przynaleznosc do projektu wynikala
 * wylacznie z przypisan zadan — osoba bez zadania nie istniala w projekcie.
 */
export const POST = withAuth("projects", async (user, req) => {
  const data = await parseBody(req, projectMemberCreateSchema);

  if (!(await canManageTasksIn(user.id, user.role, data.projectId))) {
    return fail(403, "Brak uprawnien do tego projektu");
  }

  const target = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { id: true, isActive: true, fullName: true },
  });
  if (!target?.isActive) return fail(422, "Konto nie istnieje albo jest nieaktywne");

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: data.projectId, userId: data.userId } },
  });
  if (existing) return fail(409, `${target.fullName} jest już w zespole tego projektu`);

  const member = await prisma.projectMember.create({ data });
  await audit(user.id, "CREATE", "projectMember", member.id, {
    projectId: data.projectId,
    userId: data.userId,
    role: data.role,
  });
  return ok(member, 201);
});
