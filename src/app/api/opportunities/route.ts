import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { opportunityCreateSchema } from "@/server/validators/schemas";
import { redactMany, redact } from "@/lib/redact";
import { audit } from "@/server/services/audit";

export const GET = withAuth("crm", async (user, req) => {
  const url = new URL(req.url);
  const stage = url.searchParams.get("stage");
  const status = url.searchParams.get("status");
  const clientId = url.searchParams.get("clientId");

  const opportunities = await prisma.opportunity.findMany({
    where: {
      ...(stage ? { stage } : {}),
      ...(status ? { status } : {}),
      ...(clientId ? { clientId } : {}),
    },
    include: {
      client: { select: { id: true, name: true, segment: true } },
      owner: { select: { id: true, fullName: true } },
    },
    orderBy: [{ expectedCloseDate: "asc" }, { createdAt: "desc" }],
  });

  return ok(redactMany("opportunity", user.role, opportunities));
});

export const POST = withAuth("crm", async (user, req) => {
  const data = await parseBody(req, opportunityCreateSchema);

  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) return fail(422, "Wskazany klient nie istnieje");

  const opportunity = await prisma.opportunity.create({
    data: { ...data, ownerId: data.ownerId ?? user.id, serviceType: data.serviceType ?? null },
  });

  await audit(user.id, "CREATE", "opportunity", opportunity.id, { title: opportunity.title });
  return ok(redact("opportunity", user.role, opportunity), 201);
});
