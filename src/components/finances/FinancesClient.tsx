"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, StatTile } from "@/components/ui/Card";
import { Pill, ragTone } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  OPPORTUNITY_STAGE_LABEL,
  BILLING_PERIOD_LABEL,
  PHASE_LABEL,
  CLIENT_SEGMENT_LABEL,
  ROLE_LABEL,
  labelOf,
  type Role,
} from "@/lib/domain";
import { formatMoney, formatHours } from "@/lib/format";
import { ExecutiveReport } from "@/components/finances/ExecutiveReport";
import type {
  ProjectFinance,
  ClientFinance,
  ConsultantLoad,
  Timeliness,
  PipelineValue,
} from "@/server/services/finance";

type Tab = "rentownosc" | "zespol" | "pipeline";

const TAB_LABEL: Record<Tab, string> = {
  rentownosc: "Rentowność",
  zespol: "Obciążenie zespołu",
  pipeline: "Pipeline wartości",
};

/** Ton marzy: ponizej 20% projekt doradczy przestaje sie spinac. */
function marginTone(pct: number | null): "good" | "warn" | "crit" | "ink" {
  if (pct === null) return "ink";
  if (pct < 0) return "crit";
  if (pct < 20) return "warn";
  return "good";
}

export function FinancesClient({
  projects,
  clients,
  team,
  timeliness,
  pipeline,
}: {
  projects: ProjectFinance[];
  clients: ClientFinance[];
  team: ConsultantLoad[];
  timeliness: Timeliness;
  pipeline: PipelineValue[];
}) {
  const [tab, setTab] = useState<Tab>("rentownosc");
  const [reportOpen, setReportOpen] = useState(false);

  const active = projects.filter((p) => p.status !== "CLOSED");
  const revenue = active.reduce((sum, p) => sum + (p.contractValue ?? 0), 0);
  const cost = active.reduce((sum, p) => sum + p.totalCost, 0);
  const margin = revenue - cost;
  const marginPct = revenue === 0 ? null : Math.round((margin / revenue) * 100);
  const pipelineWeighted = pipeline.reduce((sum, s) => sum + s.weightedValue, 0);
  // Przychód powtarzalny — to, co firma ma co miesiąc bez nowej sprzedaży.
  const mrr = active.reduce((sum, p) => sum + p.mrr, 0);
  const recurringCount = active.filter((p) => p.billingModel === "ABONAMENT").length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-accent">
            Dashboard finansowy
          </p>
          <h1 className="mt-1 font-display text-[28px] font-black tracking-tight text-ink">
            Finanse
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            Rentowność liczona z godzin zarejestrowanych na zadaniach i kosztów podwykonawców.
          </p>
        </div>
        <button
          onClick={() => setReportOpen(true)}
          className="rounded-lg bg-accent-deep px-4 py-2 text-[13.5px] font-bold text-white hover:opacity-90"
        >
          Raport executive
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-5">
        <StatTile
          label="Przychód"
          value={formatMoney(revenue) ?? "—"}
          hint={`${active.length} projektów w realizacji`}
        />
        <StatTile label="Koszt rzeczywisty" value={formatMoney(cost) ?? "—"} hint="praca + podwykonawcy" />
        <StatTile
          label="Marża"
          value={`${formatMoney(margin) ?? "—"}${marginPct !== null ? ` · ${marginPct}%` : ""}`}
          tone={marginTone(marginPct)}
        />
        <StatTile
          label="Przychód powtarzalny"
          value={formatMoney(mrr) ?? "—"}
          hint={`miesięcznie · ${recurringCount} ${recurringCount === 1 ? "abonament" : "abonamentów"}`}
          tone={mrr > 0 ? "good" : "ink"}
        />
        <StatTile
          label="Pipeline ważony"
          value={formatMoney(pipelineWeighted) ?? "—"}
          hint="prognoza z otwartych szans"
          tone="accent"
        />
      </div>

      {/* Terminowosc — osobny pas, bo dotyczy operacji, nie pieniedzy */}
      <Card>
        <CardHeader title="Terminowość" subtitle="Udział pozycji zrealizowanych na czas" />
        <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
          <div className="bg-surface px-5 py-4">
            <p className="font-mono text-[10.5px] uppercase tracking-wider text-muted">Zadania</p>
            <p
              className={`mt-1 font-display text-[26px] font-black tabular-nums ${
                timeliness.tasksPct !== null && timeliness.tasksPct < 70 ? "text-warn" : "text-good"
              }`}
            >
              {timeliness.tasksPct === null ? "—" : `${timeliness.tasksPct}%`}
            </p>
            <p className="text-[12px] text-muted">
              {timeliness.tasksOnTime} z {timeliness.tasksTotal} zamkniętych
            </p>
          </div>
          <div className="bg-surface px-5 py-4">
            <p className="font-mono text-[10.5px] uppercase tracking-wider text-muted">
              Kamienie milowe
            </p>
            <p className="mt-1 font-display text-[26px] font-black tabular-nums text-ink">
              {timeliness.milestonesPct === null ? "—" : `${timeliness.milestonesPct}%`}
            </p>
            <p className="text-[12px] text-muted">
              {timeliness.milestonesOnTime} z {timeliness.milestonesTotal}
            </p>
          </div>
          <div className="bg-surface px-5 py-4">
            <p className="font-mono text-[10.5px] uppercase tracking-wider text-muted">
              Zadania po terminie
            </p>
            <p
              className={`mt-1 font-display text-[26px] font-black tabular-nums ${
                timeliness.overdueTasks > 0 ? "text-crit" : "text-good"
              }`}
            >
              {timeliness.overdueTasks}
            </p>
            <p className="text-[12px] text-muted">otwarte, przekroczony termin</p>
          </div>
          <div className="bg-surface px-5 py-4">
            <p className="font-mono text-[10.5px] uppercase tracking-wider text-muted">
              Kamienie po terminie
            </p>
            <p
              className={`mt-1 font-display text-[26px] font-black tabular-nums ${
                timeliness.overdueMilestones > 0 ? "text-crit" : "text-good"
              }`}
            >
              {timeliness.overdueMilestones}
            </p>
            <p className="text-[12px] text-muted">niezrealizowane</p>
          </div>
        </div>
      </Card>

      <div className="flex rounded-lg border border-border bg-surface p-0.5 w-fit">
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-[6px] px-4 py-1.5 text-[13px] font-semibold transition-colors ${
              tab === t ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === "rentownosc" && (
        <div className="space-y-5">
          <Card className="overflow-x-auto">
            <CardHeader title="Rentowność per projekt" subtitle="Wycena vs. koszt rzeczywisty" />
            <table className="w-full min-w-[900px] text-[13px]">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left font-mono text-[10.5px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">Kod</th>
                  <th className="px-4 py-3">Projekt</th>
                  <th className="px-4 py-3">Faza</th>
                  <th className="px-4 py-3">RAG</th>
                  <th className="px-4 py-3 text-right">Godziny</th>
                  <th className="px-4 py-3 text-right">Koszt pracy</th>
                  <th className="px-4 py-3 text-right">Podwykonawcy</th>
                  <th className="px-4 py-3">Rozliczenie</th>
                  <th className="px-4 py-3 text-right">Przychód</th>
                  <th className="px-4 py-3 text-right">Marża</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                    <td className="px-4 py-2.5 font-mono text-[11.5px] text-accent">
                      <Link href={`/projects/${p.id}`}>{p.code}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="block text-ink">{p.name}</span>
                      <span className="block text-[11.5px] text-muted">{p.clientName}</span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">{labelOf(PHASE_LABEL, p.phase)}</td>
                    <td className="px-4 py-2.5">
                      <Pill tone={ragTone(p.ragStatus)} dot>
                        {p.ragStatus}
                      </Pill>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[11.5px] text-ink-soft">
                      {formatHours(p.hours)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[11.5px] text-ink-soft">
                      {formatMoney(p.laborCost)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[11.5px] text-ink-soft">
                      {p.subcontractorCost > 0 ? formatMoney(p.subcontractorCost) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[11.5px] text-ink-soft">
                      {p.billingModel === "ABONAMENT" ? (
                        <>
                          {formatMoney(p.recurringAmount)} /{" "}
                          {labelOf(BILLING_PERIOD_LABEL, p.billingPeriod ?? "").toLowerCase()}
                          {p.isOpenEnded && (
                            <span className="ml-1 text-muted">· bezterminowo</span>
                          )}
                        </>
                      ) : (
                        "jednorazowo"
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] text-ink">
                      {formatMoney(p.revenue) ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={`font-mono text-[12px] font-semibold ${
                          {
                            good: "text-good",
                            warn: "text-warn",
                            crit: "text-crit",
                            ink: "text-muted",
                          }[marginTone(p.marginPct)]
                        }`}
                      >
                        {p.margin === null ? "—" : formatMoney(p.margin)}
                        {p.marginPct !== null && (
                          <span className="ml-1.5 text-[10.5px]">{p.marginPct}%</span>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="overflow-x-auto">
            <CardHeader title="Rentowność per klient" subtitle="Agregat po projektach" />
            {clients.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Brak danych" />
              </div>
            ) : (
              <table className="w-full min-w-[640px] text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-surface-2 text-left font-mono text-[10.5px] uppercase tracking-wider text-muted">
                    <th className="px-4 py-3">Klient</th>
                    <th className="px-4 py-3">Segment</th>
                    <th className="px-4 py-3 text-right">Projekty</th>
                    <th className="px-4 py-3 text-right">Przychód</th>
                    <th className="px-4 py-3 text-right">Koszt</th>
                    <th className="px-4 py-3 text-right">Marża</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => {
                    const pct = c.revenue === 0 ? null : Math.round((c.margin / c.revenue) * 100);
                    return (
                      <tr
                        key={c.clientId}
                        className="border-b border-border last:border-0 hover:bg-surface-2"
                      >
                        <td className="px-4 py-2.5">
                          <Link href={`/crm/clients/${c.clientId}`} className="text-ink hover:text-accent">
                            {c.clientName}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-ink-soft">
                          {labelOf(CLIENT_SEGMENT_LABEL, c.segment)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[12px] text-ink-soft">
                          {c.projects}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[12px] text-ink">
                          {formatMoney(c.revenue)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[12px] text-ink-soft">
                          {formatMoney(c.cost)}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-mono text-[12px] font-semibold ${
                            {
                              good: "text-good",
                              warn: "text-warn",
                              crit: "text-crit",
                              ink: "text-muted",
                            }[marginTone(pct)]
                          }`}
                        >
                          {formatMoney(c.margin)}
                          {pct !== null && <span className="ml-1.5 text-[10.5px]">{pct}%</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {tab === "zespol" && (
        <Card>
          <CardHeader
            title="Obciążenie zespołu"
            subtitle="Ostatnie 30 dni — kto ma wolne moce na nowy projekt"
          />
          <div className="space-y-3 p-5">
            {team.map((member) => {
              const bar = Math.min(member.utilizationPct, 130);
              const tone =
                member.utilizationPct > 100
                  ? "bg-crit"
                  : member.utilizationPct >= 70
                    ? "bg-good"
                    : "bg-warn";
              return (
                <div key={member.userId}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                      {member.fullName}
                      <span className="ml-2 text-[11.5px] text-muted">
                        {member.position ?? labelOf(ROLE_LABEL, member.role as Role)}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[11.5px] text-muted">
                      {formatHours(member.hours)} / {formatHours(member.capacityHours)} ·{" "}
                      {member.fte} FTE
                    </span>
                    <span
                      className={`w-[46px] shrink-0 text-right font-mono text-[12px] font-semibold ${
                        member.utilizationPct > 100
                          ? "text-crit"
                          : member.utilizationPct >= 70
                            ? "text-good"
                            : "text-warn"
                      }`}
                    >
                      {member.utilizationPct}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      style={{ width: `${(bar / 130) * 100}%` }}
                      className={`h-full rounded-full ${tone}`}
                    />
                  </div>
                  <p className="mt-1 text-[11.5px] text-muted">
                    {member.projects} {member.projects === 1 ? "projekt" : "projektów"} · koszt pracy{" "}
                    {formatMoney(member.cost)}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {tab === "pipeline" && (
        <Card className="overflow-x-auto">
          <CardHeader
            title="Pipeline wartości"
            subtitle="Prognozowany przychód z otwartych szans, ważony prawdopodobieństwem"
          />
          {pipeline.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Brak otwartych szans" />
            </div>
          ) : (
            <table className="w-full min-w-[560px] text-[13px]">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left font-mono text-[10.5px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">Etap</th>
                  <th className="px-4 py-3 text-right">Szanse</th>
                  <th className="px-4 py-3 text-right">Wartość nominalna</th>
                  <th className="px-4 py-3 text-right">Wartość ważona</th>
                </tr>
              </thead>
              <tbody>
                {pipeline.map((row) => (
                  <tr key={row.stage} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-ink">
                      {labelOf(OPPORTUNITY_STAGE_LABEL, row.stage)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] text-ink-soft">
                      {row.count}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] text-ink-soft">
                      {formatMoney(row.value)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] font-semibold text-accent">
                      {formatMoney(row.weightedValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {reportOpen && <ExecutiveReport onClose={() => setReportOpen(false)} />}
    </div>
  );
}
