import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { userUpdateSchema } from "@/server/validators/schemas";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Ochrona przed odcieciem sie od platformy (spec 06): ostatnie aktywne konto
 * administracyjne nie da sie zdegradowac ani dezaktywowac.
 */
async function wouldRemoveLastAdmin(
  targetId: string,
  patch: { role?: string; isActive?: boolean },
): Promise<boolean> {
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { role: true, isActive: true },
  });
  if (!target || target.role !== "ADMIN" || !target.isActive) return false;

  const losesAdmin = (patch.role !== undefined && patch.role !== "ADMIN") || patch.isActive === false;
  if (!losesAdmin) return false;

  const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
  return activeAdmins <= 1;
}

export const PATCH = withAuth<Ctx>("admin", async (user, req, ctx) => {
  const { id } = await ctx.params;
  const data = await parseBody(req, userUpdateSchema);

  if (await wouldRemoveLastAdmin(id, data)) {
    return fail(409, "To ostatnie aktywne konto administracyjne — nie można go wyłączyć ani zdegradować");
  }

  const { password, ...rest } = data;
  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...rest,
      ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
    },
    select: { id: true, email: true, fullName: true, role: true, isActive: true },
  });

  // Haslo nigdy nie trafia do dziennika audytu.
  await audit(user.id, "UPDATE", "user", id, { ...rest, passwordChanged: !!password });
  return ok(updated);
});

export const DELETE = withAuth<Ctx>("admin", async (user, _req, ctx) => {
  const { id } = await ctx.params;
  if (id === user.id) return fail(409, "Nie można usunąć własnego konta");
  if (await wouldRemoveLastAdmin(id, { isActive: false })) {
    return fail(409, "To ostatnie aktywne konto administracyjne");
  }

  // Konto z historia pracy zostaje — dezaktywacja zamiast usuniecia, inaczej
  // rentownosc i autorstwo zadan straciłyby powiazanie.
  const [projects, tasks, logs] = await Promise.all([
    prisma.project.count({ where: { ownerId: id } }),
    prisma.task.count({ where: { assigneeId: id } }),
    prisma.timeLog.count({ where: { userId: id } }),
  ]);

  if (projects + tasks + logs > 0) {
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    await audit(user.id, "DEACTIVATE", "user", id, { projects, tasks, logs });
    return ok({ deactivated: true });
  }

  await prisma.user.delete({ where: { id } });
  await audit(user.id, "DELETE", "user", id);
  return ok({ deleted: true });
});
