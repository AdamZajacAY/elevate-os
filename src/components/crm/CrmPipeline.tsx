"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pill } from "@/components/ui/Pill";
import {
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_LABEL,
  SERVICE_TYPE_LABEL,
  type OpportunityStage,
  labelOf,
} from "@/lib/domain";
import { formatMoney, formatDate } from "@/lib/format";
import { NewOpportunityDialog } from "@/components/crm/NewOpportunityDialog";
import { ConvertDialog } from "@/components/crm/ConvertDialog";

export type OpportunityRow = {
  id: string;
  title: string;
  stage: string;
  status: string;
  serviceType: string | null;
  value: number | null;
  probability: number;
  expectedCloseDate: string | null;
  convertedProjectId: string | null;
  clientId: string;
  clientName: string;
  ownerName: string | null;
};

/** Opis kroku pipeline'u — pipeline stoi na metodzie Elevate, nie na lead/opportunity/won. */
const STAGE_HINT: Record<OpportunityStage, string> = {
  LEAD_OFERTA: "Pierwszy kontakt i propozycja współpracy",
  EXPLORE: "Podpisany audyt lub diagnoza",
  ENGINEER_EXECUTE: "Strategia i wdrożenie",
  ELEVATE_OPIEKA: "Monitoring, iteracje, odnowienie",
};

export function CrmPipeline({
  opportunities,
  clients,
  owners,
  canConvert,
  showMoney,
}: {
  opportunities: OpportunityRow[];
  clients: { id: string; name: string }[];
  owners: { id: string; fullName: string }[];
  canConvert: boolean;
  showMoney: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(opportunities);

  // Stan kliencki musi nadazac za odswiezeniem serwera — inaczej nowa szansa
  // nie pojawia sie na tablicy po zamknieciu okna.
  useEffect(() => setRows(opportunities), [opportunities]);
  const [newOpen, setNewOpen] = useState(false);
  const [converting, setConverting] = useState<OpportunityRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Przesuniecie szansy na kolejny etap — optymistycznie, z cofnieciem przy odmowie. */
  async function moveStage(id: string, stage: OpportunityStage) {
    const before = rows;
    setRows((prev) => prev.map((o) => (o.id === id ? { ...o, stage } : o)));
    setError(null);

    const res = await fetch(`/api/opportunities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    if (!res.ok) {
      setRows(before);
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Nie udało się przesunąć szansy.");
      return;
    }
    router.refresh();
  }

  const open = rows.filter((o) => o.status === "OPEN");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted">
          Pipeline uporządkowany według etapów metody Elevate — jeden klient może przejść przez
          wszystkie cztery w czasie.
        </p>
        <button
          onClick={() => setNewOpen(true)}
          disabled={clients.length === 0}
          className="rounded-lg bg-accent-deep px-4 py-2 text-[13.5px] font-bold text-white hover:opacity-90 disabled:opacity-40"
        >
          Nowa szansa
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[13px] text-crit">
          {error}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {OPPORTUNITY_STAGES.map((stage) => {
          const stageRows = open.filter((o) => o.stage === stage);
          const stageValue = stageRows.reduce((sum, o) => sum + (o.value ?? 0), 0);

          return (
            <div key={stage} className="min-w-0">
              <div className="mb-2 rounded-xl border-t-[3px] border-t-accent bg-surface px-3 py-2.5 shadow-card">
                <p className="font-display text-[13.5px] font-bold text-ink">
                  {OPPORTUNITY_STAGE_LABEL[stage]}
                </p>
                <p className="mt-0.5 text-[11px] text-muted">{STAGE_HINT[stage]}</p>
                <p className="mt-1.5 flex items-center justify-between font-mono text-[11px]">
                  <span className="text-muted">{stageRows.length} szans</span>
                  {showMoney && stageValue > 0 && (
                    <span className="text-accent">{formatMoney(stageValue)}</span>
                  )}
                </p>
              </div>

              <div className="space-y-2">
                {stageRows.map((o) => (
                  <div
                    key={o.id}
                    className="rounded-xl border border-border bg-surface p-3 shadow-card"
                  >
                    <Link
                      href={`/crm/clients/${o.clientId}`}
                      className="font-mono text-[10px] text-accent hover:underline"
                    >
                      {o.clientName}
                    </Link>
                    <p className="mt-1 text-[13px] font-medium leading-snug text-ink">{o.title}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {o.serviceType && (
                        <Pill tone="neutral">{labelOf(SERVICE_TYPE_LABEL, o.serviceType)}</Pill>
                      )}
                      <Pill tone={o.probability >= 60 ? "good" : "warn"}>{o.probability}%</Pill>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="font-mono text-ink">
                        {showMoney ? (formatMoney(o.value) ?? "—") : "——"}
                      </span>
                      <span className="font-mono text-muted">
                        {formatDate(o.expectedCloseDate)}
                      </span>
                    </div>

                    <select
                      value={o.stage}
                      onChange={(e) => moveStage(o.id, e.target.value as OpportunityStage)}
                      aria-label={`Zmień etap szansy ${o.title}`}
                      className="mt-2.5 w-full rounded-lg border border-border bg-bg px-2 py-1 text-[11.5px] text-ink-soft outline-none focus:border-accent"
                    >
                      {OPPORTUNITY_STAGES.map((s) => (
                        <option key={s} value={s}>
                          {OPPORTUNITY_STAGE_LABEL[s]}
                        </option>
                      ))}
                    </select>

                    {canConvert && (
                      <button
                        onClick={() => setConverting(o)}
                        className="mt-2 w-full rounded-lg bg-accent-soft px-2 py-1.5 text-[11.5px] font-bold text-accent hover:opacity-80"
                      >
                        Konwertuj w projekt →
                      </button>
                    )}
                  </div>
                ))}

                {stageRows.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-[12px] text-muted">
                    pusto
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Szanse zamkniete — wygrane z linkiem do projektu, przegrane z powodem */}
      {rows.some((o) => o.status !== "OPEN") && (
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <p className="font-mono text-[10.5px] uppercase tracking-wider text-muted">
            Zamknięte szanse
          </p>
          <ul className="mt-2 space-y-1">
            {rows
              .filter((o) => o.status !== "OPEN")
              .map((o) => (
                <li key={o.id} className="flex items-center gap-3 text-[13px]">
                  <Pill tone={o.status === "WON" ? "good" : "crit"}>
                    {o.status === "WON" ? "Wygrana" : "Przegrana"}
                  </Pill>
                  <span className="min-w-0 flex-1 truncate text-ink">{o.title}</span>
                  <span className="shrink-0 text-[11.5px] text-muted">{o.clientName}</span>
                  {o.convertedProjectId && (
                    <Link
                      href={`/projects/${o.convertedProjectId}`}
                      className="shrink-0 font-mono text-[11px] text-accent"
                    >
                      projekt →
                    </Link>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}

      {newOpen && (
        <NewOpportunityDialog
          clients={clients}
          owners={owners}
          showMoney={showMoney}
          onClose={() => setNewOpen(false)}
          onCreated={() => {
            setNewOpen(false);
            router.refresh();
          }}
        />
      )}

      {converting && (
        <ConvertDialog
          opportunity={converting}
          owners={owners}
          onClose={() => setConverting(null)}
          onConverted={(projectId) => {
            setConverting(null);
            router.push(`/projects/${projectId}`);
          }}
        />
      )}
    </div>
  );
}
