import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { meetingNoteUpdateSchema } from "@/server/validators/schemas";
import { isAdmin } from "@/lib/rbac";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withAuth<Ctx>("projects", async (user, req, ctx) => {
  const { id } = await ctx.params;
  const note = await prisma.meetingNote.findUnique({ where: { id } });
  if (!note) return fail(404, "Notatka nie istnieje");
  if (!isAdmin(user.role) && note.authorId !== user.id) {
    return fail(403, "Notatkę edytuje jej autor");
  }

  const data = await parseBody(req, meetingNoteUpdateSchema);
  const updated = await prisma.meetingNote.update({
    where: { id },
    data: { ...data, meetingDate: data.meetingDate ?? note.meetingDate },
  });
  await audit(user.id, "UPDATE", "meetingNote", id, data);
  return ok(updated);
});

export const DELETE = withAuth<Ctx>("projects", async (user, _req, ctx) => {
  const { id } = await ctx.params;
  const note = await prisma.meetingNote.findUnique({ where: { id } });
  if (!note) return fail(404, "Notatka nie istnieje");
  if (!isAdmin(user.role) && note.authorId !== user.id) {
    return fail(403, "Notatkę usuwa jej autor");
  }

  // Punkty znikaja razem z notatka, ale zadania z nich powstale zostaja —
  // `MeetingNoteItem.task` ma onDelete: SetNull po stronie zadania.
  await prisma.meetingNote.delete({ where: { id } });
  await audit(user.id, "DELETE", "meetingNote", id);
  return ok({ deleted: true });
});
