import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { expertUpdateSchema } from "@/server/validators/schemas";
import { redact } from "@/lib/redact";
import { canSeeFinancials, isAdmin } from "@/lib/rbac";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withAuth<Ctx>("experts", async (user, req, ctx) => {
  const { id } = await ctx.params;
  if (user.role === "CONSULTANT") return fail(403, "Brak uprawnien do edycji kartoteki");

  const data = await parseBody(req, expertUpdateSchema);
  if (!canSeeFinancials(user.role)) delete (data as Record<string, unknown>).hourlyRate;

  const expert = await prisma.externalExpert.update({
    where: { id },
    data: { ...data, ...(data.email !== undefined ? { email: data.email || null } : {}) },
  });
  await audit(user.id, "UPDATE", "expert", id, data);
  return ok(redact("expert", user.role, expert));
});

export const DELETE = withAuth<Ctx>("experts", async (user, _req, ctx) => {
  const { id } = await ctx.params;
  if (!isAdmin(user.role)) return fail(403, "Usuwanie ekspertów tylko dla Administratora");

  // Ekspert z historia przypisan zostaje — dezaktywacja zamiast usuniecia,
  // inaczej rentownosc zamknietych projektow straciłaby koszt podwykonawcy.
  const assignments = await prisma.projectExpert.count({ where: { expertId: id } });
  if (assignments > 0) {
    const expert = await prisma.externalExpert.update({
      where: { id },
      data: { isActive: false },
    });
    await audit(user.id, "DEACTIVATE", "expert", id);
    return ok({ deactivated: true, expert: redact("expert", user.role, expert) });
  }

  await prisma.externalExpert.delete({ where: { id } });
  await audit(user.id, "DELETE", "expert", id);
  return ok({ deleted: true });
});
