import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { opportunityUpdateSchema } from "@/server/validators/schemas";
import { redact } from "@/lib/redact";
import { canSeeFinancials, isAdmin } from "@/lib/rbac";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withAuth<Ctx>("crm", async (user, req, ctx) => {
  const { id } = await ctx.params;
  const existing = await prisma.opportunity.findUnique({ where: { id } });
  if (!existing) return fail(404, "Szansa nie istnieje");

  const data = await parseBody(req, opportunityUpdateSchema);

  // Wartosc szansy zapisuje tylko rola z uprawnieniem finansowym.
  if (!canSeeFinancials(user.role)) delete (data as Record<string, unknown>).value;

  // Przegrana bez powodu nie uczy niczego przy nastepnej ofercie.
  if (data.status === "LOST" && !data.lostReason && !existing.lostReason) {
    return fail(422, "Podaj powód przegranej szansy");
  }

  const opportunity = await prisma.opportunity.update({ where: { id }, data });
  await audit(user.id, "UPDATE", "opportunity", id, data);
  return ok(redact("opportunity", user.role, opportunity));
});

export const DELETE = withAuth<Ctx>("crm", async (user, _req, ctx) => {
  const { id } = await ctx.params;
  if (!isAdmin(user.role)) return fail(403, "Usuwanie szans tylko dla Administratora");
  await prisma.opportunity.delete({ where: { id } });
  await audit(user.id, "DELETE", "opportunity", id);
  return ok({ deleted: true });
});
