import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { contactUpdateSchema } from "@/server/validators/schemas";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withAuth<Ctx>("crm", async (user, req, ctx) => {
  const { id } = await ctx.params;
  const existing = await prisma.clientContact.findUnique({ where: { id } });
  if (!existing) return fail(404, "Kontakt nie istnieje");

  const data = await parseBody(req, contactUpdateSchema);

  const contact = await prisma.$transaction(async (tx) => {
    if (data.isPrimary) {
      await tx.clientContact.updateMany({
        where: { clientId: existing.clientId, isPrimary: true, id: { not: id } },
        data: { isPrimary: false },
      });
    }
    return tx.clientContact.update({
      where: { id },
      data: { ...data, ...(data.email !== undefined ? { email: data.email || null } : {}) },
    });
  });

  await audit(user.id, "UPDATE", "contact", id, data);
  return ok(contact);
});

export const DELETE = withAuth<Ctx>("crm", async (user, _req, ctx) => {
  const { id } = await ctx.params;
  const contact = await prisma.clientContact.findUnique({ where: { id }, select: { id: true } });
  if (!contact) return fail(404, "Kontakt nie istnieje");

  await prisma.clientContact.delete({ where: { id } });
  await audit(user.id, "DELETE", "contact", id);
  return ok({ deleted: true });
});
