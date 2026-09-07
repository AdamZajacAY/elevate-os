import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { expertCreateSchema } from "@/server/validators/schemas";
import { redactMany, redact } from "@/lib/redact";
import { audit } from "@/server/services/audit";

export const GET = withAuth("experts", async (user) => {
  const experts = await prisma.externalExpert.findMany({
    include: {
      assignments: {
        include: { project: { select: { id: true, code: true, name: true, status: true } } },
      },
      _count: { select: { tasks: true } },
    },
    orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
  });

  // Stawka eksperta i wartosci umow to pola finansowe — konsultant widzi
  // kartotekę i dostępność, nie widzi cen.
  return ok(
    redactMany("expert", user.role, experts).map((e) => ({
      ...e,
      assignments: redactMany("projectExpert", user.role, e.assignments),
    })),
  );
});

export const POST = withAuth("experts", async (user, req) => {
  if (user.role === "CONSULTANT") return fail(403, "Kartotekę ekspertów prowadzi Partner albo Administrator");

  const data = await parseBody(req, expertCreateSchema);
  const expert = await prisma.externalExpert.create({
    data: { ...data, email: data.email || null },
  });
  await audit(user.id, "CREATE", "expert", expert.id, { fullName: expert.fullName });
  return ok(redact("expert", user.role, expert), 201);
});
