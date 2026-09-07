import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { projectUpdateSchema } from "@/server/validators/schemas";
import { redact, redactProjectTree } from "@/lib/redact";
import { canReadAllProjects, canWriteProject, isAdmin } from "@/lib/rbac";
import { refreshRag } from "@/server/services/rag";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

/** Czy uzytkownik widzi ten projekt — opiekun, wykonawca zadania albo pelny odczyt. */
async function assertVisible(userId: string, role: string, projectId: string) {
  if (canReadAllProjects(role as never)) return true;
  const hit = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [{ ownerId: userId }, { tasks: { some: { assigneeId: userId } } }],
    },
    select: { id: true },
  });
  return !!hit;
}

export const GET = withAuth<Ctx>("projects", async (user, _req, ctx) => {
  const { id } = await ctx.params;
  if (!(await assertVisible(user.id, user.role, id))) return fail(404, "Projekt nie istnieje");

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, industry: true, segment: true } },
      owner: { select: { id: true, fullName: true, email: true } },
      stages: { orderBy: { startDate: "asc" } },
      tasks: {
        include: {
          assignee: { select: { id: true, fullName: true } },
          expert: { select: { id: true, fullName: true } },
        },
        orderBy: [{ status: "asc" }, { position: "asc" }],
      },
      checklist: { orderBy: [{ phase: "asc" }, { position: "asc" }] },
      risks: { include: { owner: { select: { id: true, fullName: true } } }, orderBy: { createdAt: "desc" } },
      milestones: { orderBy: { dueDate: "asc" } },
      experts: { include: { expert: { select: { id: true, fullName: true, specialty: true } } } },
    },
  });
  if (!project) return fail(404, "Projekt nie istnieje");

  return ok(redactProjectTree(user.role, project));
});

export const PATCH = withAuth<Ctx>("projects", async (user, req, ctx) => {
  const { id } = await ctx.params;
  const existing = await prisma.project.findUnique({ where: { id }, select: { ownerId: true } });
  if (!existing) return fail(404, "Projekt nie istnieje");
  if (!canWriteProject(user.role, user.id, existing)) return fail(403, "Brak uprawnien do zapisu");

  const data = await parseBody(req, projectUpdateSchema);

  // Pola finansowe zapisuje wylacznie rola z uprawnieniem finansowym —
  // inaczej konsultant-opiekun mogl by nadpisac budzet, ktorego nie widzi.
  if (user.role === "CONSULTANT") {
    delete (data as Record<string, unknown>).budget;
    delete (data as Record<string, unknown>).contractValue;
    delete (data as Record<string, unknown>).quotedValue;
  }

  const project = await prisma.project.update({ where: { id }, data });
  // Zmiana terminow moze przestawic status zdrowia projektu.
  await refreshRag(id);
  await audit(user.id, "UPDATE", "project", id, data);

  // Odpowiedz przechodzi przez redakcje tak samo jak GET — inaczej konsultant
  // bedacy opiekunem odczytywal budzet z ciala odpowiedzi na wlasny PATCH.
  return ok(redact("project", user.role, project));
});

export const DELETE = withAuth<Ctx>("projects", async (user, _req, ctx) => {
  const { id } = await ctx.params;
  if (!isAdmin(user.role)) return fail(403, "Usuwanie projektow tylko dla Administratora");
  await prisma.project.delete({ where: { id } });
  await audit(user.id, "DELETE", "project", id);
  return ok({ deleted: true });
});
