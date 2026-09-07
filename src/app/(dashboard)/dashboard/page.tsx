import Link from "next/link";
import { requireUser } from "@/server/session";
import { getDashboardData, getOnTimeRatio } from "@/server/services/portfolio";
import { canSeeFinancials } from "@/lib/rbac";
import { Card, CardHeader, StatTile } from "@/components/ui/Card";
import { Pill, ragTone, priorityTone } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import { PHASES, PHASE_LABEL, PHASE_DESC, PRIORITY_LABEL } from "@/lib/domain";
import { formatMoney, formatDate, daysUntil } from "@/lib/format";

export const metadata = { title: "Pulpit — ELEVATE OS" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const [data, onTime] = await Promise.all([
    getDashboardData(user.id, user.role),
    getOnTimeRatio(user.id, user.role),
  ]);

  const activeCount = data.projects.length;
  const showMoney = canSeeFinancials(user.role);

  return (
    <div className="space-y-7">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-wider text-accent">Pulpit</p>
        <h1 className="mt-1 font-display text-[28px] font-black tracking-tight text-ink">
          Dzień dobry, {user.fullName.split(" ")[0]}
        </h1>
        <p className="mt-1 text-[14px] text-ink-soft">
          {activeCount === 0
            ? "Nie masz jeszcze aktywnych projektów."
            : `${activeCount} ${activeCount === 1 ? "aktywny projekt" : "aktywnych projektów"} w Twoim zakresie widoczności.`}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatTile label="Projekty aktywne" value={String(activeCount)} />
        <StatTile
          label="Status portfela"
          value={`${data.byRag.GREEN}/${data.byRag.AMBER}/${data.byRag.RED}`}
          hint="Green / Amber / Red"
          tone={data.byRag.RED > 0 ? "crit" : data.byRag.AMBER > 0 ? "warn" : "good"}
        />
        <StatTile
          label="Moje zadania po terminie"
          value={String(data.overdueTasks)}
          tone={data.overdueTasks > 0 ? "crit" : "good"}
        />
        {showMoney ? (
          <StatTile
            label="Wartość umów"
            value={formatMoney(data.contractTotal) ?? "—"}
            hint="Projekty w realizacji"
            tone="accent"
          />
        ) : (
          <StatTile
            label="Terminowość"
            value={onTime === null ? "—" : `${onTime}%`}
            hint="Zadania zamknięte w terminie"
            tone={onTime !== null && onTime < 70 ? "warn" : "good"}
          />
        )}
      </div>

      {/* Rozklad portfela wg faz metody Elevate (spec 07) */}
      <Card>
        <CardHeader title="Portfel wg faz Elevate" subtitle="Gdzie stoją projekty w metodzie" />
        <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
          {PHASES.map((phase) => (
            <div key={phase} className="bg-surface px-5 py-4">
              <p className="font-display text-[15px] font-bold text-ink">{PHASE_LABEL[phase]}</p>
              <p className="mt-0.5 text-[12px] text-muted">{PHASE_DESC[phase]}</p>
              <p className="mt-2 font-display text-[26px] font-black tabular-nums text-accent">
                {data.byPhase[phase] ?? 0}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Moje zadania"
            subtitle="Najbliższe terminy"
            action={
              <Link href="/tasks?widok=moje" className="text-[12.5px] font-semibold text-accent">
                Wszystkie →
              </Link>
            }
          />
          <div className="p-3">
            {data.myTasks.length === 0 ? (
              <EmptyState title="Brak otwartych zadań" hint="Nic nie czeka na Twoje działanie." />
            ) : (
              <ul className="space-y-1">
                {data.myTasks.map((task) => {
                  const days = daysUntil(task.dueDate);
                  return (
                    <li key={task.id}>
                      <Link
                        href={`/tasks/${task.id}`}
                        className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-surface-2"
                      >
                        <span className="font-mono text-[10.5px] text-muted">{task.code}</span>
                        <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                          {task.title}
                        </span>
                        <Pill tone={priorityTone(task.priority)}>
                          {PRIORITY_LABEL[task.priority as keyof typeof PRIORITY_LABEL]}
                        </Pill>
                        <span
                          className={`w-[74px] shrink-0 text-right font-mono text-[11px] ${
                            days !== null && days < 0
                              ? "text-crit"
                              : days !== null && days <= 3
                                ? "text-warn"
                                : "text-muted"
                          }`}
                        >
                          {task.dueDate ? formatDate(task.dueDate) : "bez terminu"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Kamienie milowe"
            subtitle="Najbliższe 14 dni"
            action={
              data.openRisks > 0 ? (
                <Pill tone="warn">{data.openRisks} otwartych ryzyk</Pill>
              ) : undefined
            }
          />
          <div className="p-3">
            {data.upcomingMilestones.length === 0 ? (
              <EmptyState
                title="Brak nadchodzących kamieni milowych"
                hint="Nic nie wypada w ciągu dwóch tygodni."
              />
            ) : (
              <ul className="space-y-1">
                {data.upcomingMilestones.map((ms) => (
                  <li key={ms.id}>
                    <Link
                      href={`/projects/${ms.project.id}`}
                      className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-surface-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] text-ink">{ms.name}</span>
                        <span className="block truncate text-[11.5px] text-muted">
                          {ms.project.name}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-accent">
                        {formatDate(ms.dueDate)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Projekty"
          subtitle="Aktywny portfel"
          action={
            <Link href="/projects" className="text-[12.5px] font-semibold text-accent">
              Pełna lista →
            </Link>
          }
        />
        <div className="overflow-x-auto">
          {data.projects.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Brak projektów" hint="Załóż pierwszy projekt w module Projekty." />
            </div>
          ) : (
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left font-mono text-[10.5px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-2.5">Kod</th>
                  <th className="px-4 py-2.5">Projekt</th>
                  <th className="px-4 py-2.5">Klient</th>
                  <th className="px-4 py-2.5">Faza</th>
                  <th className="px-4 py-2.5">RAG</th>
                  <th className="px-4 py-2.5">Termin</th>
                </tr>
              </thead>
              <tbody>
                {data.projects.slice(0, 8).map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                    <td className="px-4 py-2.5 font-mono text-[11.5px] text-accent">
                      <Link href={`/projects/${p.id}`}>{p.code}</Link>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-ink">
                      <Link href={`/projects/${p.id}`}>{p.name}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">{p.client.name}</td>
                    <td className="px-4 py-2.5 text-ink-soft">
                      {PHASE_LABEL[p.phase as keyof typeof PHASE_LABEL]}
                    </td>
                    <td className="px-4 py-2.5">
                      <Pill tone={ragTone(p.ragStatus)} dot>
                        {p.ragStatus}
                      </Pill>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11.5px] text-muted">
                      {formatDate(p.endDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
