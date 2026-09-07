import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { commentCreateSchema } from "@/server/validators/schemas";
import { canReadAllProjects } from "@/lib/rbac";
import { canViewTask } from "@/server/access";
import { notifyMentions } from "@/server/services/notifications";
import { audit } from "@/server/services/audit";

export const GET = withAuth("tasks", async (user, req) => {
  const url = new URL(req.url);
  const taskId = url.searchParams.get("taskId");
  if (!taskId) return fail(422, "Wymagany parametr taskId");

  // Bez tego sprawdzenia dowolne id zadania oddawalo caly watek komentarzy
  // razem z autorami — takze z projektu, ktorego uzytkownik nie widzi.
  if (!(await canViewTask(user.id, user.role, taskId))) {
    return fail(404, "Zadanie nie istnieje");
  }

  const comments = await prisma.comment.findMany({
    where: { taskId },
    include: { author: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: "asc" },
  });
  return ok(comments);
});

export const POST = withAuth("tasks", async (user, req) => {
  const data = await parseBody(req, commentCreateSchema);

  const task = await prisma.task.findUnique({
    where: { id: data.taskId },
    include: { project: { select: { id: true, ownerId: true } } },
  });
  if (!task) return fail(404, "Zadanie nie istnieje");

  // Komentowac moze ten, kto widzi zadanie.
  const mayComment =
    canReadAllProjects(user.role) ||
    task.assigneeId === user.id ||
    task.project.ownerId === user.id;
  if (!mayComment) return fail(403, "Brak dostępu do tego zadania");

  const comment = await prisma.comment.create({
    data: {
      taskId: data.taskId,
      authorId: user.id,
      body: data.body,
      // Wzmianki trzymane jako lista id po przecinku — SQLite nie ma tablic.
      mentions: data.mentions.length > 0 ? data.mentions.join(",") : null,
    },
    include: { author: { select: { id: true, fullName: true } } },
  });

  const notified = await notifyMentions({
    mentionedIds: data.mentions,
    authorId: user.id,
    authorName: user.fullName,
    taskId: task.id,
    taskCode: task.code,
    taskTitle: task.title,
    projectId: task.projectId,
    excerpt: data.body.slice(0, 120),
  });

  await audit(user.id, "CREATE", "comment", comment.id, { taskId: task.id, notified });
  return ok(comment, 201);
});
