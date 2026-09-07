import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok } from "@/server/api";
import { improvementCreateSchema } from "@/server/validators/schemas";
import { isAdmin } from "@/lib/rbac";
import { audit } from "@/server/services/audit";

export const GET = withAuth("improvements", async (user) => {
  // Administrator widzi skrzynke wszystkich zgloszen; pozostali — swoje.
  const improvements = await prisma.improvement.findMany({
    where: isAdmin(user.role) ? {} : { authorId: user.id },
    include: { author: { select: { id: true, fullName: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return ok(improvements);
});

export const POST = withAuth("improvements", async (user, req) => {
  const data = await parseBody(req, improvementCreateSchema);
  const improvement = await prisma.improvement.create({
    data: { ...data, authorId: user.id },
  });
  await audit(user.id, "CREATE", "improvement", improvement.id, { title: improvement.title });
  return ok(improvement, 201);
});
