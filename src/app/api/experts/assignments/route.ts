import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { expertAssignmentSchema } from "@/server/validators/schemas";
import { redact } from "@/lib/redact";
import { canSeeFinancials } from "@/lib/rbac";
import { audit } from "@/server/services/audit";

/** Przypisanie eksperta do projektu — koszt wchodzi do rentownosci (spec 03/04). */
export const POST = withAuth("experts", async (user, req) => {
  if (user.role === "CONSULTANT") return fail(403, "Przypisania prowadzi Partner albo Administrator");

  const data = await parseBody(req, expertAssignmentSchema);
  if (!canSeeFinancials(user.role)) delete (data as Record<string, unknown>).contractValue;

  const [project, expert] = await Promise.all([
    prisma.project.findUnique({ where: { id: data.projectId }, select: { id: true } }),
    prisma.externalExpert.findUnique({ where: { id: data.expertId }, select: { id: true } }),
  ]);
  if (!project) return fail(422, "Wskazany projekt nie istnieje");
  if (!expert) return fail(422, "Wskazany ekspert nie istnieje");

  const existing = await prisma.projectExpert.findUnique({
    where: { projectId_expertId: { projectId: data.projectId, expertId: data.expertId } },
  });
  if (existing) return fail(409, "Ten ekspert jest już przypisany do tego projektu");

  const assignment = await prisma.projectExpert.create({ data });
  await audit(user.id, "CREATE", "projectExpert", assignment.id, {
    projectId: data.projectId,
    expertId: data.expertId,
  });
  return ok(redact("projectExpert", user.role, assignment), 201);
});
