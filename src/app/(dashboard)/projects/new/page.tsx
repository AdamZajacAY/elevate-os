import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/server/session";
import { canSeeFinancials } from "@/lib/rbac";
import { NewProjectForm } from "@/components/NewProjectForm";

export const metadata = { title: "Nowy projekt — ELEVATE OS" };
export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const user = await requireModule("projects");
  if (user.role === "CONSULTANT") redirect("/projects");

  const [clients, owners] = await Promise.all([
    prisma.client.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-[760px] space-y-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-wider text-accent">
          Praca projektowa
        </p>
        <h1 className="mt-1 font-display text-[28px] font-black tracking-tight text-ink">
          Nowy projekt
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-soft">
          Checklista zostanie utworzona automatycznie z szablonu wybranego typu usługi.
        </p>
      </header>

      <NewProjectForm
        clients={clients}
        owners={owners}
        defaultOwnerId={user.id}
        showFinancials={canSeeFinancials(user.role)}
      />
    </div>
  );
}
