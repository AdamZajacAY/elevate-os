import { prisma } from "@/lib/prisma";

/** Slad audytowy operacji zapisu — nie blokuje odpowiedzi, gdy zapis dziennika padnie. */
export async function audit(
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  meta?: unknown,
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId: entityId ?? null,
        meta: meta === undefined ? null : JSON.stringify(meta),
      },
    });
  } catch (err) {
    console.error("[audit] nie zapisano wpisu", err);
  }
}
