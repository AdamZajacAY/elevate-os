import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { opportunityCloseSchema } from "@/server/validators/schemas";
import { redact } from "@/lib/redact";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Zamkniecie szansy sprzedazowej — wygrana albo przegrana, wraz z czynnikami decyzji.
 *
 * Osobna trasa, a nie zwykly PATCH, bo to operacja o innym ciezarze: wymaga
 * podania powodu i ustawia znacznik czasu. Dzieki temu odpowiedz na pytanie
 * "co domyka nasze oferty, a co je przewraca" opiera sie na danych, ktore
 * ktos musial swiadomie wpisac, a nie na pustym polu tekstowym.
 */
export const POST = withAuth<Ctx>("crm", async (user, req, ctx) => {
  const { id } = await ctx.params;

  const opportunity = await prisma.opportunity.findUnique({
    where: { id },
    select: { id: true, title: true, status: true, convertedProjectId: true },
  });
  if (!opportunity) return fail(404, "Szansa nie istnieje");
  if (opportunity.status !== "OPEN") {
    return fail(409, "Ta szansa jest już zamknięta");
  }

  const data = await parseBody(req, opportunityCloseSchema);

  const closed = await prisma.opportunity.update({
    where: { id },
    data: {
      status: data.status,
      // Czynniki trzymamy rozdzielnie: wygrana ma powody wygranej i nic wiecej.
      winFactors: data.status === "WON" ? data.winFactors : [],
      lossFactors: data.status === "LOST" ? data.lossFactors : [],
      decisionNote: data.decisionNote,
      closedAt: new Date(),
      // Ostatni etap jest rozstrzygajacy — po zamknieciu szansa tam zostaje.
      stage: "ZAKUP_LUB_ODMOWA",
    },
  });

  await audit(user.id, "CLOSE", "opportunity", id, {
    status: data.status,
    factors: data.status === "WON" ? data.winFactors : data.lossFactors,
  });

  return ok(redact("opportunity", user.role, closed));
});
