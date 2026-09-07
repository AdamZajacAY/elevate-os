import { prisma } from "@/lib/prisma";
import { withAuth, ok, fail } from "@/server/api";
import { isAdmin } from "@/lib/rbac";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = withAuth<Ctx>("tasks", async (user, _req, ctx) => {
  const { id } = await ctx.params;
  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) return fail(404, "Komentarz nie istnieje");
  // Komentarz kasuje autor albo Administrator — cudzej wypowiedzi nikt inny nie ruszy.
  if (!isAdmin(user.role) && comment.authorId !== user.id) {
    return fail(403, "Możesz usunąć tylko własny komentarz");
  }

  await prisma.comment.delete({ where: { id } });
  await audit(user.id, "DELETE", "comment", id);
  return ok({ deleted: true });
});
