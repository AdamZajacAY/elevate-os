"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/crm/Dialog";
import { OPPORTUNITY_STAGE_LABEL, PHASE_LABEL, labelOf } from "@/lib/domain";
import { formatMoney, formatHours, formatDate } from "@/lib/format";

type Report = {
  generatedAt: string;
  totals: {
    activeProjects: number;
    revenue: number;
    cost: number;
    margin: number;
    marginPct: number | null;
    hours: number;
    pipelineWeighted: number;
  };
  projects: {
    code: string;
    name: string;
    clientName: string;
    phase: string;
    status: string;
    ragStatus: string;
    revenue: number | null;
    totalCost: number;
    margin: number | null;
    marginPct: number | null;
    hours: number;
  }[];
  clients: { clientName: string; projects: number; revenue: number; cost: number; margin: number }[];
  team: { fullName: string; hours: number; capacityHours: number; utilizationPct: number }[];
  timeliness: { tasksPct: number | null; milestonesPct: number | null; overdueTasks: number };
  pipeline: { stage: string; count: number; value: number; weightedValue: number }[];
};

/**
 * Raport executive na zadanie (spec 04) — z zywego stanu danych, nie z migawki.
 * Eksport: CSV budowany po stronie klienta i pobierany przez blob, oraz wydruk
 * do PDF przez okno drukowania przegladarki (bez doktadania biblioteki PDF).
 */
export function ExecutiveReport({ onClose }: { onClose: () => void }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/finances/report")
      .then(async (res) => {
        if (!res.ok) throw new Error("Nie udało się wygenerować raportu.");
        return res.json();
      })
      .then(setReport)
      .catch((e: Error) => setError(e.message));
  }, []);

  function exportCsv() {
    if (!report) return;
    const rows = [
      // "Przychód", nie "Wartość umowy": dla abonamentu bezterminowego wartosc
      // umowy jest pusta z definicji, wiec marza w wierszu nie dawala sie sprawdzic.
      ["Kod", "Projekt", "Klient", "Faza", "Status", "RAG", "Godziny", "Koszt", "Przychód", "Marża", "Marża %"],
      ...report.projects.map((p) => [
        p.code,
        p.name,
        p.clientName,
        labelOf(PHASE_LABEL, p.phase),
        p.status,
        p.ragStatus,
        String(p.hours),
        String(Math.round(p.totalCost)),
        p.revenue === null ? "" : String(Math.round(p.revenue)),
        p.margin === null ? "" : String(Math.round(p.margin)),
        p.marginPct === null ? "" : String(p.marginPct),
      ]),
    ];
    // Komorka zaczynajaca sie od =, +, - albo @ jest przez Excela i Arkusze Google
    // traktowana jak formula — nazwa projektu w rodzaju "=1+1" wykonalaby sie
    // u odbiorcy raportu. Apostrof z przodu wymusza interpretacje jako tekst.
    const escapeCell = (cell: string) => {
      const safe = /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
      return `"${safe.replace(/"/g, '""')}"`;
    };

    // Separator srednikiem + BOM — Excel w polskiej lokalizacji tak czyta CSV.
    const csv = rows.map((r) => r.map(escapeCell).join(";")).join("\r\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `elevate-raport-${new Date().toISOString().slice(0, 10)}.csv`;
    // Link musi byc w dokumencie, a zwolnienie adresu odlozone — synchroniczne
    // revokeObjectURL po click() przerywa pobieranie w czesci przegladarek.
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  return (
    <Dialog title="Raport executive" onClose={onClose}>
      {error && (
        <p className="mt-4 rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[13px] text-crit">
          {error}
        </p>
      )}

      {!report && !error && <p className="mt-4 text-[13.5px] text-muted">Generowanie…</p>}

      {report && (
        <div id="executive-report" className="mt-4 space-y-5">
          <p className="font-mono text-[10.5px] text-muted">
            Stan na {formatDate(report.generatedAt)} · {report.totals.activeProjects} projektów
            w realizacji
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Metric label="Przychód" value={formatMoney(report.totals.revenue) ?? "—"} />
            <Metric label="Koszt" value={formatMoney(report.totals.cost) ?? "—"} />
            <Metric
              label="Marża"
              value={`${formatMoney(report.totals.margin) ?? "—"}${
                report.totals.marginPct !== null ? ` · ${report.totals.marginPct}%` : ""
              }`}
            />
            <Metric
              label="Pipeline ważony"
              value={formatMoney(report.totals.pipelineWeighted) ?? "—"}
            />
          </div>

          <Section title="Projekty">
            <table className="w-full text-[12px]">
              <tbody>
                {report.projects.map((p) => (
                  <tr key={p.code} className="border-b border-border last:border-0">
                    <td className="py-1.5 font-mono text-[10.5px] text-accent">{p.code}</td>
                    <td className="py-1.5 text-ink">{p.name}</td>
                    <td className="py-1.5 text-right font-mono text-ink-soft">
                      {formatHours(p.hours)}
                    </td>
                    <td className="py-1.5 text-right font-mono text-ink">
                      {p.margin === null ? "—" : formatMoney(p.margin)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Obciążenie zespołu">
            <table className="w-full text-[12px]">
              <tbody>
                {report.team.map((m) => (
                  <tr key={m.fullName} className="border-b border-border last:border-0">
                    <td className="py-1.5 text-ink">{m.fullName}</td>
                    <td className="py-1.5 text-right font-mono text-ink-soft">
                      {formatHours(m.hours)} / {formatHours(m.capacityHours)}
                    </td>
                    <td className="py-1.5 w-[54px] text-right font-mono text-ink">
                      {m.utilizationPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Pipeline">
            <table className="w-full text-[12px]">
              <tbody>
                {report.pipeline.map((row) => (
                  <tr key={row.stage} className="border-b border-border last:border-0">
                    <td className="py-1.5 text-ink">
                      {labelOf(OPPORTUNITY_STAGE_LABEL, row.stage)}
                    </td>
                    <td className="py-1.5 text-right font-mono text-ink-soft">{row.count} szans</td>
                    <td className="py-1.5 text-right font-mono text-ink">
                      {formatMoney(row.weightedValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Terminowość">
            <p className="text-[12.5px] text-ink-soft">
              Zadania na czas:{" "}
              <strong className="text-ink">
                {report.timeliness.tasksPct === null ? "—" : `${report.timeliness.tasksPct}%`}
              </strong>{" "}
              · kamienie milowe:{" "}
              <strong className="text-ink">
                {report.timeliness.milestonesPct === null
                  ? "—"
                  : `${report.timeliness.milestonesPct}%`}
              </strong>{" "}
              · zadania po terminie:{" "}
              <strong className={report.timeliness.overdueTasks > 0 ? "text-crit" : "text-good"}>
                {report.timeliness.overdueTasks}
              </strong>
            </p>
          </Section>

          <div className="no-print flex flex-wrap gap-3 pt-1">
            <button
              onClick={exportCsv}
              className="rounded-lg bg-accent-deep px-5 py-2.5 text-[14px] font-bold text-white hover:opacity-90"
            >
              Eksport CSV
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-lg border border-border px-5 py-2.5 text-[14px] font-semibold text-ink-soft hover:bg-surface-2"
            >
              Drukuj / PDF
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-border px-5 py-2.5 text-[14px] font-semibold text-ink-soft hover:bg-surface-2"
            >
              Zamknij
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 px-3.5 py-2.5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-0.5 font-display text-[17px] font-bold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-accent">{title}</p>
      {children}
    </div>
  );
}
