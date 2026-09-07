import { prisma } from "@/lib/prisma";
import { withAuth, ok, fail } from "@/server/api";
import { isAdmin } from "@/lib/rbac";
import { anonymizeUser, anonymizeClient, logGdprRequest } from "@/server/services/gdpr";
import { audit } from "@/server/services/audit";

/**
 * Prawo do usuniecia (RODO art. 17) realizowane przez anonimizacje.
 *
 * Operacja jest **nieodwracalna** i zarezerwowana dla Administratora — dane
 * osobowe znikaja, rekordy finansowe zostaja bez mozliwosci powiazania z osoba.
 */
export const POST = withAuth("admin", async (user, req) => {
  if (!isAdmin(user.role)) return fail(403, "Anonimizacje prowadzi Administrator");

  const body = (await req.json().catch(() => ({}))) as { subject?: string; id?: string };
  if (!body.id) return fail(422, "Wymagane id podmiotu");

  try {
    if (body.subject === "USER") {
      // Ostatnie konto administracyjne nie moze zniknac razem z dostepem do platformy.
      const target = await prisma.user.findUnique({
        where: { id: body.id },
        select: { email: true, role: true, isActive: true },
      });
      if (!target) return fail(404, "Konto nie istnieje");
      if (body.id === user.id) return fail(409, "Nie mozna zanonimizowac wlasnego konta");

      if (target.role === "ADMIN" && target.isActive) {
        const admins = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
        if (admins <= 1) return fail(409, "To ostatnie aktywne konto administracyjne");
      }

      await anonymizeUser(body.id);
      await logGdprRequest({
        kind: "ERASURE",
        subjectType: "USER",
        subjectId: body.id,
        subjectLabel: target.email,
        requestedById: user.id,
      });
      await audit(user.id, "GDPR_ERASURE", "user", body.id);
      return ok({ anonymized: true });
    }

    if (body.subject === "CLIENT") {
      const target = await prisma.client.findUnique({
        where: { id: body.id },
        select: { name: true },
      });
      if (!target) return fail(404, "Klient nie istnieje");

      const result = await anonymizeClient(body.id);
      await logGdprRequest({
        kind: "ERASURE",
        subjectType: "CLIENT",
        subjectId: body.id,
        subjectLabel: target.name,
        requestedById: user.id,
        note: `Zanonimizowano ${result.contacts} kontaktow`,
      });
      await audit(user.id, "GDPR_ERASURE", "client", body.id, result);
      return ok({ anonymized: true, ...result });
    }

    return fail(422, "Nieznany rodzaj podmiotu");
  } catch (err) {
    return fail(409, err instanceof Error ? err.message : "Anonimizacja nieudana");
  }
});
