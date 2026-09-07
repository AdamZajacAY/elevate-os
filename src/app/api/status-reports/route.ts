import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { statusReportCreateSchema } from "@/server/validators/schemas";
import { canWriteProject } from "@/lib/rbac";
import { canViewProject } from "@/server/access";
import { computeRag } from "@/server/services/rag";
import { audit } from "@/server/services/audit";

export const GET = withAuth("projects", async (user, req) => {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) return fail(422, "Wymagany parametr projectId");

  // `budgetNote` to uwaga budzetowa — bez tego sprawdzenia konsultant czytal
  // historie RAG i budzet dowolnego projektu, podajac jego id.
  if (!(await canViewProject(user.id, user.role, projectId))) {
    return fail(404, "Projekt nie istnieje");
  }

  const reports = await prisma.statusReport.findMany({
    where: { projectId },
    include: { author: { select: { fullName: true } } },
    orderBy: { reportDate: "desc" },
  });
  return ok(reports);
});

/**
 * Raport statusowy — migawka zdrowia projektu w czasie (spec 08).
 * RAG proponowany jest wyliczany automatycznie, ale autor moze go nadpisac:
 * czasem opiekun wie o czyms, czego terminy jeszcze nie pokazuja.
 */
export const POST = withAuth("projects", async (user, req) => {
  const data = await parseBody(req, statusReportCreateSchema);

  const project = await prisma.project.findUnique({
    where: { id: data.projectId },
    select: { id: true, ownerId: true },
  });
  if (!project) return fail(422, "Wskazany projekt nie istnieje");
  if (!canWriteProject(user.role, user.id, project)) {
    return fail(403, "Raport statusowy tworzy opiekun projektu albo Administrator");
  }

  const report = await prisma.statusReport.create({
    data: { ...data, authorId: user.id },
  });

  // Rozjazd miedzy ocena autora a wyliczeniem jest sam w sobie informacja —
  // trafia do dziennika audytu, zeby dalo sie go pozniej przesledzic.
  const computed = await computeRag(data.projectId);
  await audit(user.id, "CREATE", "statusReport", report.id, {
    declaredRag: data.ragStatus,
    computedRag: computed,
    override: data.ragStatus !== computed,
  });

  return ok({ ...report, computedRag: computed }, 201);
});
