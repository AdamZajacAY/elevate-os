import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { stageCreateSchema } from "@/server/validators/schemas";
import { projectScopeWhere } from "@/lib/rbac";
import { audit } from "@/server/services/audit";

export const GET = withAuth("gantt", async (user, req) => {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");

  // Harmonogram wieloprojektowy: etapy wszystkich widocznych projektow na wspolnej osi.
  const stages = await prisma.projectStage.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      project: projectScopeWhere(user.role, user.id),
    },
    include: {
      project: { select: { id: true, code: true, name: true, ragStatus: true, phase: true } },
    },
    orderBy: [{ startDate: "asc" }],
  });

  return ok(stages);
});

export const POST = withAuth("gantt", async (user, req) => {
  const data = await parseBody(req, stageCreateSchema);
  const project = await prisma.project.findUnique({
    where: { id: data.projectId },
    select: { ownerId: true },
  });
  if (!project) return fail(422, "Wskazany projekt nie istnieje");
  if (user.role === "CONSULTANT" && project.ownerId !== user.id) {
    return fail(403, "Harmonogram prowadzi opiekun projektu");
  }

  const last = await prisma.projectStage.findFirst({
    where: { projectId: data.projectId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const stage = await prisma.projectStage.create({
    data: { ...data, position: (last?.position ?? -1) + 1 },
  });
  await audit(user.id, "CREATE", "stage", stage.id);
  return ok(stage, 201);
});
