import { prisma } from "@/lib/prisma";

/**
 * Numeracja kodow (PRJ-0001, ZAD-0042) — inkrement w transakcji,
 * zeby dwa rownolegle zapisy nie dostaly tego samego numeru.
 */
export async function nextCode(prefix: string, key = prefix): Promise<string> {
  const counter = await prisma.$transaction(async (tx) => {
    const existing = await tx.counter.findUnique({ where: { key } });
    if (!existing) return tx.counter.create({ data: { key, value: 1 } });
    return tx.counter.update({ where: { key }, data: { value: { increment: 1 } } });
  });
  return `${prefix}-${String(counter.value).padStart(4, "0")}`;
}
