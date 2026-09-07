import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { meetingNoteCreateSchema } from "@/server/validators/schemas";
import { canViewProject, canViewClient } from "@/server/access";
import { canReadAllProjects, projectScopeWhere } from "@/lib/rbac";
import { audit } from "@/server/services/audit";

export const GET = withAuth("projects", async (user, req) => {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const clientId = url.searchParams.get("clientId");

  // Filtr po id nie moze zdejmowac zawezenia rolą — wczesniej podanie
  // `?projectId=` albo `?clientId=` omijalo je calkowicie i oddawalo notatki
  // z projektow i klientow, ktorych uzytkownik nie widzi.
  if (projectId && !(await canViewProject(user.id, user.role, projectId))) {
    return fail(404, "Projekt nie istnieje");
  }
  if (clientId && !(await canViewClient(user.role, clientId))) {
    return fail(404, "Klient nie istnieje");
  }

  const notes = await prisma.meetingNote.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      ...(clientId ? { clientId } : {}),
      // Bez jawnego filtra ograniczamy sie do projektow w zakresie roli; notatki
      // klienta (bez projektu) sa czescia CRM, wiec widzi je tylko rola z dostepem do CRM.
      ...(projectId || clientId
        ? {}
        : {
            OR: [
              { project: projectScopeWhere(user.role, user.id) },
              ...(canReadAllProjects(user.role) ? [{ projectId: null }] : []),
            ],
          }),
    },
    include: {
      author: { select: { fullName: true } },
      project: { select: { id: true, code: true, name: true } },
      client: { select: { id: true, name: true } },
      items: { orderBy: { position: "asc" }, include: { task: { select: { id: true, code: true } } } },
    },
    orderBy: { meetingDate: "desc" },
  });

  return ok(notes);
});

export const POST = withAuth("projects", async (user, req) => {
  const data = await parseBody(req, meetingNoteCreateSchema);

  if (data.projectId) {
    const project = await prisma.project.findUnique({ where: { id: data.projectId } });
    if (!project) return fail(422, "Wskazany projekt nie istnieje");
  }
  if (data.clientId) {
    const client = await prisma.client.findUnique({ where: { id: data.clientId } });
    if (!client) return fail(422, "Wskazany klient nie istnieje");
  }

  const note = await prisma.$transaction(async (tx) => {
    const created = await tx.meetingNote.create({
      data: {
        title: data.title,
        meetingDate: data.meetingDate,
        projectId: data.projectId ?? null,
        clientId: data.clientId ?? null,
        content: data.content,
        attendees: data.attendees,
        authorId: user.id,
        items: {
          create: data.items.map((content, index) => ({ content, position: index })),
        },
      },
      include: { items: { orderBy: { position: "asc" } } },
    });

    // Spotkanie z klientem to kontakt — data ostatniego kontaktu przesuwa sie sama,
    // inaczej przypomnienie o ciszy odpalaloby mimo odbytej rozmowy.
    if (data.clientId) {
      await tx.client.update({
        where: { id: data.clientId },
        data: { lastContactAt: data.meetingDate },
      });
    }

    return created;
  });

  await audit(user.id, "CREATE", "meetingNote", note.id, { items: note.items.length });
  return ok(note, 201);
});
