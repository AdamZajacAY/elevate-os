import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { contactCreateSchema } from "@/server/validators/schemas";
import { audit } from "@/server/services/audit";

export const POST = withAuth("crm", async (user, req) => {
  const data = await parseBody(req, contactCreateSchema);

  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) return fail(422, "Wskazany klient nie istnieje");

  const contact = await prisma.$transaction(async (tx) => {
    // Kontakt glowny jest jeden — ustawienie nowego zdejmuje flage z poprzedniego.
    if (data.isPrimary) {
      await tx.clientContact.updateMany({
        where: { clientId: data.clientId, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    return tx.clientContact.create({
      data: { ...data, email: data.email || null },
    });
  });

  await audit(user.id, "CREATE", "contact", contact.id);
  return ok(contact, 201);
});
