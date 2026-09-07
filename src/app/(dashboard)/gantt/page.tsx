import { prisma } from "@/lib/prisma";
import { requireModule } from "@/server/session";
import { projectScopeWhere } from "@/lib/rbac";
import { GanttChart } from "@/components/GanttChart";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Harmonogram — ELEVATE OS" };
export const dynamic = "force-dynamic";

export default async function GanttPage() {
  const user = await requireModule("gantt");

  // Zakres liczony raz; oba zapytania sa niezalezne, wiec ida rownolegle.
  const scope = { ...projectScopeWhere(user.role, user.id), status: { not: "CLOSED" } };

  const [stages, milestones] = await Promise.all([
    prisma.projectStage.findMany({
      where: { project: scope },
      include: { project: { select: { id: true, code: true, name: true, ragStatus: true } } },
      orderBy: [{ startDate: "asc" }],
    }),
    prisma.milestone.findMany({
      where: { project: scope },
      select: { id: true, name: true, dueDate: true, completedAt: true, projectId: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-wider text-accent">
          Praca projektowa
        </p>
        <h1 className="mt-1 font-display text-[28px] font-black tracking-tight text-ink">
          Harmonogram
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-soft">
          Etapy wszystkich projektów na wspólnej osi czasu. Romb oznacza kamień milowy.
        </p>
      </header>

      {stages.length === 0 ? (
        <EmptyState
          title="Brak etapów do pokazania"
          hint="Dodaj etapy harmonogramu na kartach projektów."
        />
      ) : (
        <GanttChart
          stages={stages.map((s) => ({
            id: s.id,
            name: s.name,
            phase: s.phase,
            progress: s.progress,
            startDate: s.startDate.toISOString(),
            endDate: s.endDate.toISOString(),
            projectId: s.project.id,
            projectCode: s.project.code,
            projectName: s.project.name,
            ragStatus: s.project.ragStatus,
          }))}
          milestones={milestones.map((m) => ({
            id: m.id,
            name: m.name,
            dueDate: m.dueDate.toISOString(),
            done: !!m.completedAt,
            projectId: m.projectId,
          }))}
        />
      )}
    </div>
  );
}
