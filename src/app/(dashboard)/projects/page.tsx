import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/server/session";
import { projectScopeWhere, canSeeFinancials } from "@/lib/rbac";
import { Card, RedactedValue } from "@/components/ui/Card";
import { Pill, ragTone } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  PHASE_LABEL,
  SERVICE_TYPE_LABEL,
  labelOf,
} from "@/lib/domain";
import { formatMoney, formatDate } from "@/lib/format";
import { ProjectFilters } from "@/components/ProjectFilters";

export const metadata = { title: "Projekty — ELEVATE OS" };
export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; faza?: string }>;
}) {
  const user = await requireModule("projects");
  const { status, faza } = await searchParams;

  const projects = await prisma.project.findMany({
    where: {
      ...projectScopeWhere(user.role, user.id),
      ...(status ? { status } : {}),
      ...(faza ? { phase: faza } : {}),
    },
    include: {
      client: { select: { id: true, name: true } },
      owner: { select: { id: true, fullName: true } },
      _count: { select: { tasks: true, risks: true } },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });

  const showMoney = canSeeFinancials(user.role);
  const canCreate = user.role !== "CONSULTANT";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-accent">
            Praca projektowa
          </p>
          <h1 className="mt-1 font-display text-[28px] font-black tracking-tight text-ink">
            Projekty
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            {user.role === "CONSULTANT"
              ? "Projekty, w których prowadzisz prace lub jesteś opiekunem."
              : "Cały portfel projektów doradczych."}
          </p>
        </div>
        {canCreate && (
          <Link
            href="/projects/new"
            className="rounded-lg bg-accent-deep px-4 py-2 text-[13.5px] font-bold text-white hover:opacity-90"
          >
            Nowy projekt
          </Link>
        )}
      </header>

      <ProjectFilters status={status} phase={faza} />

      {projects.length === 0 ? (
        <EmptyState
          title="Brak projektów w tym widoku"
          hint={canCreate ? "Zmień filtry albo załóż nowy projekt." : "Zmień filtry."}
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left font-mono text-[10.5px] uppercase tracking-wider text-muted">
                <th className="px-4 py-3">Kod</th>
                <th className="px-4 py-3">Projekt</th>
                <th className="px-4 py-3">Klient</th>
                <th className="px-4 py-3">Typ usługi</th>
                <th className="px-4 py-3">Faza</th>
                <th className="px-4 py-3">RAG</th>
                <th className="px-4 py-3">Opiekun</th>
                <th className="px-4 py-3">Termin</th>
                <th className="px-4 py-3 text-right">Wartość umowy</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                  <td className="px-4 py-3 font-mono text-[11.5px] text-accent">
                    <Link href={`/projects/${p.id}`}>{p.code}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="font-medium text-ink">
                      {p.name}
                    </Link>
                    <span className="ml-2 font-mono text-[10.5px] text-muted">
                      {p._count.tasks} zad.
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{p.client.name}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {labelOf(SERVICE_TYPE_LABEL, p.serviceType)}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{labelOf(PHASE_LABEL, p.phase)}</td>
                  <td className="px-4 py-3">
                    <Pill tone={ragTone(p.ragStatus)} dot>
                      {p.ragStatus}
                    </Pill>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{p.owner?.fullName ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-[11.5px] text-muted">
                    {formatDate(p.endDate)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[12px] text-ink">
                    {showMoney ? (formatMoney(p.contractValue) ?? "—") : <RedactedValue />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {!showMoney && (
        <p className="text-[12px] text-muted">
          Pola finansowe są zredagowane dla Twojej roli — serwer nie zwraca tych wartości.
        </p>
      )}
    </div>
  );
}
