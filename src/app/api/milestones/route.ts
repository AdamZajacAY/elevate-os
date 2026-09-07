import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { milestoneCreateSchema } from "@/server/validators/schemas";
import { canManageTasksIn } from "@/server/access";
import { refreshRag } from "@/server/services/rag";
import { audit } from "@/server/services/audit";

/**
 * Kamienie milowe. Do tej pory istniały wyłącznie w modelu danych i w seedzie —
 * były wyświetlane na karcie projektu i zasilały status RAG, ale nie było jak
 * ich wprowadzić, więc RAG liczył się z niepełnych danych.
 */
export const POST = withAuth("projects", async (user, req) => {
  const data = await parseBody(req, milestoneCreateSchema);

  if (!(await canManageTasksIn(user.id, user.role, data.projectId))) {
    return fail(403, "Brak uprawnien do tego projektu");
  }

  const milestone = await prisma.milestone.create({ data });
  // Kamień po terminie przestawia RAG na amber.
  await refreshRag(data.projectId);
  await audit(user.id, "CREATE", "milestone", milestone.id, { name: milestone.name });
  return ok(milestone, 201);
});
