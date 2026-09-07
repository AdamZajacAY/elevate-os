import { prisma } from "@/lib/prisma";
import { withAuth, ok, fail } from "@/server/api";
import { redact } from "@/lib/redact";
import { nextCode } from "@/server/services/counter";
import { instantiateChecklist } from "@/server/services/checklist";
import { audit } from "@/server/services/audit";
import { SERVICE_TYPES } from "@/lib/domain";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Konwersja szansy sprzedazowej w projekt (spec 05).
 *
 * "Po podpisaniu umowy szansa jednym dzialaniem staje sie projektem — dziedziczy
 * klienta, kontakty i wycene z karty CRM. Nie ma etapu recznego zakladania karty
 * projektu od zera."
 *
 * Kontakty nie sa kopiowane: projekt wskazuje na klienta, a kontakty wisza przy
 * kliencie — przepisanie ich zrobiloby drugie zrodlo prawdy.
 */
export const POST = withAuth<Ctx>("crm", async (user, req, ctx) => {
  const { id } = await ctx.params;
  if (user.role === "CONSULTANT") return fail(403, "Konwersję prowadzi Partner albo Administrator");

  const opportunity = await prisma.opportunity.findUnique({
    where: { id },
    include: { client: { select: { id: true, name: true, status: true } } },
  });
  if (!opportunity) return fail(404, "Szansa nie istnieje");
  if (opportunity.convertedProjectId) {
    return fail(409, "Ta szansa została już przekonwertowana na projekt");
  }

  const body = (await req.json().catch(() => ({}))) as {
    serviceType?: string;
    ownerId?: string;
    startDate?: string;
    endDate?: string;
  };

  // Typ uslugi z ciala zadania, w razie braku — z karty szansy.
  const serviceType = body.serviceType ?? opportunity.serviceType;
  if (!serviceType || !(SERVICE_TYPES as readonly string[]).includes(serviceType)) {
    return fail(422, "Wskaż typ usługi dla nowego projektu");
  }

  const code = await nextCode("PRJ");
  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        code,
        name: opportunity.title,
        clientId: opportunity.clientId,
        serviceType,
        ownerId: body.ownerId ?? opportunity.ownerId ?? user.id,
        // Etap pipeline'u przeklada sie na faze projektu — Lead/Oferta i Explore
        // startuja w Explore, opieka cykliczna wchodzi wprost w Elevate.
        phase:
          opportunity.stage === "ELEVATE_OPIEKA"
            ? "ELEVATE"
            : opportunity.stage === "ENGINEER_EXECUTE"
              ? "ENGINEER"
              : "EXPLORE",
        status: "ACTIVE",
        description: opportunity.notes,
        startDate: body.startDate ? new Date(body.startDate) : new Date(),
        endDate: body.endDate ? new Date(body.endDate) : opportunity.expectedCloseDate,
        // Wycena z karty CRM staje sie wycena i wartoscia umowy projektu.
        quotedValue: opportunity.value,
        contractValue: opportunity.value,
      },
    });

    await tx.opportunity.update({
      where: { id },
      data: { status: "WON", convertedProjectId: created.id },
    });

    // Prospekt, ktory podpisal umowe, przestaje byc prospektem.
    if (opportunity.client.status === "PROSPEKT") {
      await tx.client.update({
        where: { id: opportunity.clientId },
        data: { status: "AKTYWNY" },
      });
    }

    return created;
  });

  const checklistItems = await instantiateChecklist(project.id, serviceType);
  await audit(user.id, "CONVERT", "opportunity", id, { projectId: project.id, code, checklistItems });

  return ok({ ...redact("project", user.role, project), checklistItems }, 201);
});
