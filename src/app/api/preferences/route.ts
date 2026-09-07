import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok } from "@/server/api";
import { preferencesSchema } from "@/server/validators/schemas";

/**
 * Personalizacja wlasnych ustawien (spec 06). Uzytkownik zapisuje wylacznie
 * swoje preferencje — id bierze sie z sesji, nie z ciala zadania.
 */
export const PATCH = withAuth("improvements", async (user, req) => {
  const data = await parseBody(req, preferencesSchema);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: { theme: true, defaultView: true, urgentDays: true },
  });
  return ok(updated);
});
