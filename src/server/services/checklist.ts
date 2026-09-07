import { prisma } from "@/lib/prisma";

/**
 * Instancjonowanie checklisty przy zakladaniu projektu (spec 03).
 * "To nie jest lista do wypelnienia recznie: powstaje sama, gotowa do odhaczania."
 * Brak szablonu dla typu uslugi nie jest bledem — projekt powstaje bez checklisty.
 */
export async function instantiateChecklist(projectId: string, serviceType: string): Promise<number> {
  const template = await prisma.checklistTemplate.findUnique({
    where: { serviceType },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!template || !template.isActive || template.items.length === 0) return 0;

  await prisma.projectChecklistItem.createMany({
    data: template.items.map((item) => ({
      projectId,
      label: item.label,
      phase: item.phase,
      position: item.position,
    })),
  });
  return template.items.length;
}
