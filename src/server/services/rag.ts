import { prisma } from "@/lib/prisma";
import type { RagStatus } from "@/lib/domain";

/**
 * Status RAG liczony automatycznie z terminowosci i ryzyk otwartych (spec 03).
 *
 * RED   — projekt po terminie koncowym, zadanie przeterminowane > 7 dni,
 *         albo otwarte ryzyko o wysokim wplywie i wysokim prawdopodobienstwie.
 * AMBER — jakiekolwiek zadanie/kamien milowy po terminie, albo otwarte ryzyko wysokiego wplywu.
 * GREEN — reszta.
 */
export async function computeRag(projectId: string): Promise<RagStatus> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [project, overdueTasks, badlyOverdueTasks, overdueMilestones, risks] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { endDate: true, status: true, ragStatus: true },
    }),
    prisma.task.count({
      where: { projectId, status: { not: "DONE" }, dueDate: { lt: now } },
    }),
    prisma.task.count({
      where: { projectId, status: { not: "DONE" }, dueDate: { lt: sevenDaysAgo } },
    }),
    prisma.milestone.count({
      where: { projectId, completedAt: null, dueDate: { lt: now } },
    }),
    prisma.risk.findMany({
      where: { projectId, status: "OPEN" },
      select: { impact: true, probability: true },
    }),
  ]);

  if (!project || project.status === "CLOSED") return "GREEN";

  const criticalRisk = risks.some((r) => r.impact === "WYSOKI" && r.probability === "WYSOKI");
  const highImpactRisk = risks.some((r) => r.impact === "WYSOKI");
  const pastEndDate = !!project.endDate && project.endDate < now;

  if (criticalRisk || badlyOverdueTasks > 0 || pastEndDate) return "RED";
  if (highImpactRisk || overdueTasks > 0 || overdueMilestones > 0) return "AMBER";
  return "GREEN";
}

/** Przelicza RAG i zapisuje na karcie projektu. Wolane po zmianie zadan/ryzyk/terminow. */
export async function refreshRag(projectId: string): Promise<RagStatus> {
  const rag = await computeRag(projectId);

  // Zapis tylko przy faktycznej zmianie. RAG zmienia sie rzadko, a `refreshRag`
  // leci po kazdej mutacji zadania — bez tego warunku kazde przeciagniecie karty
  // na kanbanie generowaloby zbedny UPDATE i wpis do WAL.
  const current = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ragStatus: true },
  });
  if (current?.ragStatus === rag) return rag;

  await prisma.project.update({ where: { id: projectId }, data: { ragStatus: rag } });
  return rag;
}
