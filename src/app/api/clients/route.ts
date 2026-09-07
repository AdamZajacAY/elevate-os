import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { clientCreateSchema } from "@/server/validators/schemas";
import { audit } from "@/server/services/audit";

export const GET = withAuth("crm", async (_user, req) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q")?.trim();

  const clients = await prisma.client.findMany({
    where: {
      ...(status ? { status } : {}),
      // `mode: "insensitive"` jawnie — w Postgresie `contains` domyslnie
      // rozroznia wielkosc liter, wiec bez tego szukanie "acme" nie znajdzie "ACME".
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { nip: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { contacts: true, projects: true, opportunities: true } },
    },
    orderBy: { name: "asc" },
  });

  return ok(clients);
});

export const POST = withAuth("crm", async (user, req) => {
  const data = await parseBody(req, clientCreateSchema);

  // NIP jest opcjonalny, ale jesli podany — musi byc unikalny, inaczej ten sam
  // klient wchodzi do bazy dwa razy pod nieco innymi nazwami.
  if (data.nip) {
    const duplicate = await prisma.client.findFirst({ where: { nip: data.nip } });
    if (duplicate) return fail(409, `Klient o tym NIP już istnieje: ${duplicate.name}`);
  }

  const client = await prisma.client.create({
    data: { ...data, nip: data.nip || null },
  });
  await audit(user.id, "CREATE", "client", client.id, { name: client.name });
  return ok(client, 201);
});
