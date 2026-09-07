import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, ok, fail } from "@/server/api";
import { userCreateSchema } from "@/server/validators/schemas";
import { redactMany } from "@/lib/redact";
import { audit } from "@/server/services/audit";

export const GET = withAuth("admin", async (user) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      position: true,
      fte: true,
      hourlyRate: true,
      lastLoginAt: true,
      createdAt: true,
      _count: { select: { ownedProjects: true, tasks: true } },
    },
    orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
  });
  return ok(redactMany("user", user.role, users));
});

export const POST = withAuth("admin", async (user, req) => {
  const data = await parseBody(req, userCreateSchema);

  const email = data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return fail(409, "Konto o tym adresie już istnieje");

  const created = await prisma.user.create({
    data: {
      email,
      fullName: data.fullName,
      role: data.role,
      passwordHash: await bcrypt.hash(data.password, 12),
      position: data.position,
      fte: data.fte,
      hourlyRate: data.hourlyRate,
    },
    select: { id: true, email: true, fullName: true, role: true, isActive: true },
  });

  await audit(user.id, "CREATE", "user", created.id, { email, role: created.role });
  return ok(created, 201);
});
