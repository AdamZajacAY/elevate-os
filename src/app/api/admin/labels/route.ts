import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok } from "@/server/api";
import { z } from "zod";
import { audit } from "@/server/services/audit";

const labelSchema = z.object({
  kind: z.string().trim().min(2).max(40),
  value: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(120),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Kolor w formacie #RRGGBB")
    .default("#194A99"),
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const GET = withAuth("admin", async () => {
  const labels = await prisma.configLabel.findMany({
    orderBy: [{ kind: "asc" }, { position: "asc" }],
  });
  return ok(labels);
});

/** Slownik konfiguracyjny — upsert po parze (kind, value), zeby edycja nie duplikowala wpisow. */
export const POST = withAuth("admin", async (user, req) => {
  const data = await parseBody(req, labelSchema);
  const label = await prisma.configLabel.upsert({
    where: { kind_value: { kind: data.kind, value: data.value } },
    update: { label: data.label, color: data.color, position: data.position, isActive: data.isActive },
    create: data,
  });
  await audit(user.id, "UPSERT", "configLabel", label.id, { kind: data.kind, value: data.value });
  return ok(label);
});
