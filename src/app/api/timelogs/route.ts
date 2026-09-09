import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { timeLogCreateSchema } from "@/server/validators/schemas";
import { audit } from "@/server/services/audit";
import { canManageTasksIn } from "@/server/access";
import { redact } from "@/lib/redact";

/**
 * Rejestracja godziny na zadaniu — jedyne zrodlo kosztu rzeczywistego,
 * z ktorego liczy sie rentownosc na dashboardzie (spec 02).
 */
export const POST = withAuth("tasks", async (user, req) => {
  const data = await parseBody(req, timeLogCreateSchema);

  if (!(await canManageTasksIn(user.id, user.role, data.projectId))) {
    return fail(403, "Brak uprawnien do rejestrowania czasu w tym projekcie");
  }

  if (data.taskId) {
    const task = await prisma.task.findUnique({
      where: { id: data.taskId },
      select: { projectId: true },
    });
    if (!task) return fail(422, "Wskazane zadanie nie istnieje");
    if (task.projectId !== data.projectId) {
      return fail(422, "Zadanie nalezy do innego projektu");
    }
  }

  // Stawka zamrozona w chwili zapisu — pozniejsza podwyzka nie przepisuje historii.
  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { hourlyRate: true },
  });

  const log = await prisma.$transaction(async (tx) => {
    const created = await tx.timeLog.create({
      data: {
        taskId: data.taskId ?? null,
        projectId: data.projectId,
        userId: user.id,
        hours: data.hours,
        workDate: data.workDate,
        note: data.note,
        rateSnapshot: me?.hourlyRate ?? null,
      },
    });
    if (data.taskId) {
      await tx.task.update({
        where: { id: data.taskId },
        data: { actualHours: { increment: data.hours } },
      });
    }
    return created;
  });

  await audit(user.id, "CREATE", "timeLog", log.id, { hours: data.hours });
  // Redakcja przez wspolny helper — recznie wpisane `rateSnapshot: null` bylo
  // czwarta rownolegla implementacja tej reguly, nie znalo mapy pol finansowych
  // i zerowalo stawke takze rolom, ktore maja prawo ja widziec.
  return ok(redact("timeLog", user.role, log), 201);
});
