import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { riskCreateSchema } from "@/server/validators/schemas";
import { canManageTasksIn } from "@/server/access";
import { refreshRag } from "@/server/services/rag";
import { audit } from "@/server/services/audit";

/**
 * Rejestr ryzyk i problemów. Podobnie jak kamienie milowe — istniał w modelu
 * i zasilał RAG, ale nie było trasy zapisu.
 */
export const POST = withAuth("projects", async (user, req) => {
  const data = await parseBody(req, riskCreateSchema);

  if (!(await canManageTasksIn(user.id, user.role, data.projectId))) {
    return fail(403, "Brak uprawnien do tego projektu");
  }

  const risk = await prisma.risk.create({ data });
  // Otwarte ryzyko wysokiego wpływu przestawia RAG.
  await refreshRag(data.projectId);
  await audit(user.id, "CREATE", "risk", risk.id, { title: risk.title, impact: risk.impact });
  return ok(risk, 201);
});
