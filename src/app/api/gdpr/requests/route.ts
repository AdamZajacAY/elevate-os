import { prisma } from "@/lib/prisma";
import { withAuth, ok, fail } from "@/server/api";
import { isAdmin } from "@/lib/rbac";

/** Rejestr zadan podmiotow danych — dowod realizacji obowiazkow (art. 12 ust. 3). */
export const GET = withAuth("admin", async (user) => {
  if (!isAdmin(user.role)) return fail(403, "Rejestr prowadzi Administrator");

  const requests = await prisma.gdprRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return ok({ requests });
});
