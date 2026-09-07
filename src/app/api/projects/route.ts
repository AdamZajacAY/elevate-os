import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { projectCreateSchema } from "@/server/validators/schemas";
import { redactMany, redact } from "@/lib/redact";
import { projectScopeWhere } from "@/lib/rbac";
import { nextCode } from "@/server/services/counter";
import { instantiateChecklist } from "@/server/services/checklist";
import { audit } from "@/server/services/audit";

export const GET = withAuth("projects", async (user, req) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const phase = url.searchParams.get("phase");
  const clientId = url.searchParams.get("clientId");

  const projects = await prisma.project.findMany({
    where: {
      ...projectScopeWhere(user.role, user.id),
      ...(status ? { status } : {}),
      ...(phase ? { phase } : {}),
      ...(clientId ? { clientId } : {}),
    },
    include: {
      client: { select: { id: true, name: true } },
      owner: { select: { id: true, fullName: true } },
      _count: { select: { tasks: true, risks: true, milestones: true } },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });

  return ok(redactMany("project", user.role, projects));
});

export const POST = withAuth("projects", async (user, req) => {
  // Zakladanie projektu: Administrator i Partner. Konsultant tylko realizuje.
  if (user.role === "CONSULTANT") return fail(403, "Brak uprawnien do zakladania projektow");

  const data = await parseBody(req, projectCreateSchema);
  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) return fail(422, "Wskazany klient nie istnieje");

  // Rola bez uprawnien finansowych nie dochodzi tutaj — POST jest zablokowany
  // dla konsultanta wyzej, wiec pola finansowe moga isc wprost.
  const code = await nextCode("PRJ");
  // Przekazujemy zwalidowane dane w calosci, a nie przepisana recznie liste pol:
  // przy recznej liscie kazde nowe pole schematu bylo po cichu gubione przy zapisie.
  const project = await prisma.project.create({
    data: { ...data, code, ownerId: data.ownerId ?? user.id },
  });

  // Checklista instancjonowana automatycznie z szablonu typu uslugi (spec 03).
  const checklistItems = await instantiateChecklist(project.id, project.serviceType);
  await audit(user.id, "CREATE", "project", project.id, { code, checklistItems });

  return ok({ ...redact("project", user.role, project), checklistItems }, 201);
});
