import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { noteItemConvertSchema } from "@/server/validators/schemas";
import { nextCode } from "@/server/services/counter";
import { refreshRag } from "@/server/services/rag";
import { notify } from "@/server/services/notifications";
import { audit } from "@/server/services/audit";
import { canManageTasksIn } from "@/server/access";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Konwersja punktu notatki na zadanie jednym klikniecim (spec 03) —
 * "bez opuszczania widoku notatki".
 */
export const POST = withAuth<Ctx>("tasks", async (user, req, ctx) => {
  const { id } = await ctx.params;

  const item = await prisma.meetingNoteItem.findUnique({
    where: { id },
    include: { note: { select: { projectId: true, title: true } } },
  });
  if (!item) return fail(404, "Punkt notatki nie istnieje");
  if (item.taskId) return fail(409, "Ten punkt został już zamieniony na zadanie");

  const data = await parseBody(req, noteItemConvertSchema);

  // Notatka klienta nie ma projektu — wtedy projekt trzeba wskazac wprost.
  const projectId = data.projectId ?? item.note.projectId;
  if (!projectId) return fail(422, "Wskaż projekt, do którego ma trafić zadanie");

  if (!(await canManageTasksIn(user.id, user.role, projectId))) {
    return fail(403, "Brak uprawnien do zakladania zadan w tym projekcie");
  }

  const code = await nextCode("ZAD");
  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        code,
        projectId,
        // Punkt notatki bywa dluzszy niz tytul zadania — nadmiar ladują w opisie,
        // zeby nic z ustalenia nie zginelo.
        title: item.content.length > 120 ? `${item.content.slice(0, 117)}…` : item.content,
        description:
          item.content.length > 120
            ? `Z notatki „${item.note.title}”:\n\n${item.content}`
            : `Z notatki „${item.note.title}”`,
        priority: data.priority,
        assigneeId: data.assigneeId ?? null,
        dueDate: data.dueDate,
      },
    });
    await tx.meetingNoteItem.update({ where: { id }, data: { taskId: created.id } });
    return created;
  });

  await refreshRag(projectId);

  if (task.assigneeId && task.assigneeId !== user.id) {
    await notify({
      userId: task.assigneeId,
      kind: "PRZYPISANIE",
      title: `Nowe zadanie: ${task.code}`,
      body: task.title,
      link: `/tasks/${task.id}`,
    });
  }

  await audit(user.id, "CONVERT", "meetingNoteItem", id, { taskId: task.id, code });
  return ok(task, 201);
});
