import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { clientUpdateSchema } from "@/server/validators/schemas";
import { redactMany } from "@/lib/redact";
import { isAdmin } from "@/lib/rbac";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth<Ctx>("crm", async (user, _req, ctx) => {
  const { id } = await ctx.params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { fullName: "asc" }] },
      opportunities: {
        include: { owner: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
      },
      projects: {
        select: {
          id: true,
          code: true,
          name: true,
          phase: true,
          status: true,
          ragStatus: true,
          contractValue: true,
          startDate: true,
          endDate: true,
        },
        orderBy: { createdAt: "desc" },
      },
      meetingNotes: { orderBy: { meetingDate: "desc" }, take: 10 },
    },
  });
  if (!client) return fail(404, "Klient nie istnieje");

  return ok({
    ...client,
    projects: redactMany("project", user.role, client.projects),
    opportunities: redactMany("opportunity", user.role, client.opportunities),
  });
});

export const PATCH = withAuth<Ctx>("crm", async (user, req, ctx) => {
  const { id } = await ctx.params;
  const data = await parseBody(req, clientUpdateSchema);

  if (data.nip) {
    const duplicate = await prisma.client.findFirst({
      where: { nip: data.nip, id: { not: id } },
    });
    if (duplicate) return fail(409, `Klient o tym NIP już istnieje: ${duplicate.name}`);
  }

  const client = await prisma.client.update({
    where: { id },
    data: { ...data, ...(data.nip !== undefined ? { nip: data.nip || null } : {}) },
  });
  await audit(user.id, "UPDATE", "client", id, data);
  return ok(client);
});

export const DELETE = withAuth<Ctx>("crm", async (user, _req, ctx) => {
  const { id } = await ctx.params;
  if (!isAdmin(user.role)) return fail(403, "Usuwanie klientów tylko dla Administratora");

  // Klient z projektami zostaje — historia współpracy jest wartościowa sama w sobie.
  const projects = await prisma.project.count({ where: { clientId: id } });
  if (projects > 0) {
    return fail(409, `Klient ma ${projects} projektów — oznacz go jako UTRACONY zamiast usuwać`);
  }

  await prisma.client.delete({ where: { id } });
  await audit(user.id, "DELETE", "client", id);
  return ok({ deleted: true });
});
