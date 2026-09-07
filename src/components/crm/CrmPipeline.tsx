"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pill } from "@/components/ui/Pill";
import {
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_LABEL,
  OPPORTUNITY_STAGE_HINT,
  SERVICE_TYPE_LABEL,
  OPPORTUNITY_STAGE_COLOR,
  isTerminalStage,
  WIN_FACTOR_LABEL,
  LOSS_FACTOR_LABEL,
  type OpportunityStage,
  labelOf,
} from "@/lib/domain";
import { formatMoney, formatDate } from "@/lib/format";
import { NewOpportunityDialog } from "@/components/crm/NewOpportunityDialog";
import { ConvertDialog } from "@/components/crm/ConvertDialog";
import { CloseOpportunityDialog } from "@/components/crm/CloseOpportunityDialog";

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
  winFactors: string[];
  lossFactors: string[];
  decisionNote: string | null;
  clientId: string;
  clientName: string;
  ownerName: string | null;
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
  const [closing, setClosing] = useState<OpportunityRow | null>(null);
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

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {OPPORTUNITY_STAGES.map((stage) => {
          // Etapy koncowe zbieraja szanse zamkniete; pozostale — otwarte.
          const stageRows = isTerminalStage(stage)
            ? rows.filter((o) => o.stage === stage)
            : open.filter((o) => o.stage === stage);
          const stageValue = stageRows.reduce((sum, o) => sum + (o.value ?? 0), 0);

          return (
            <div key={stage} className="min-w-0">
              <div
                style={{ borderTopColor: OPPORTUNITY_STAGE_COLOR[stage] }}
                className="mb-2 rounded-xl border-t-[3px] bg-surface px-3 py-2.5 shadow-card"
              >
                <p className="font-display text-[13.5px] font-bold text-ink">
                  {OPPORTUNITY_STAGE_LABEL[stage]}
                </p>
                <p className="mt-0.5 text-[11px] text-muted">{OPPORTUNITY_STAGE_HINT[stage]}</p>
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

                    {!isTerminalStage(stage) && (
                      <select
                        value={o.stage}
                        onChange={(e) => moveStage(o.id, e.target.value as OpportunityStage)}
                        aria-label={`Zmień etap szansy ${o.title}`}
                        className="mt-2.5 w-full rounded-lg border border-border bg-bg px-2 py-1 text-[11.5px] text-ink-soft outline-none focus:border-accent"
                      >
                        {/* Do etapow koncowych wchodzi sie wylacznie przez rozstrzygniecie
                            z czynnikami — dlatego nie ma ich na liscie. */}
                        {OPPORTUNITY_STAGES.filter((x) => !isTerminalStage(x)).map((x) => (
                          <option key={x} value={x}>
                            {OPPORTUNITY_STAGE_LABEL[x]}
                          </option>
                        ))}
                      </select>
                    )}

                    {isTerminalStage(stage) ? (
                      <>
                        {(o.winFactors.length > 0 || o.lossFactors.length > 0) && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {[...o.winFactors, ...o.lossFactors].map((f) => (
                              <span
                                key={f}
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  stage === "ZAKUP"
                                    ? "bg-good-soft text-good"
                                    : "bg-crit-soft text-crit"
                                }`}
                              >
                                {labelOf(
                                  stage === "ZAKUP"
                                    ? (WIN_FACTOR_LABEL as Record<string, string>)
                                    : (LOSS_FACTOR_LABEL as Record<string, string>),
                                  f,
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                        {canConvert && stage === "ZAKUP" && !o.convertedProjectId && (
                          <button
                            onClick={() => setConverting(o)}
                            className="mt-2 w-full rounded-lg bg-accent-soft px-2 py-1.5 text-[11.5px] font-bold text-accent hover:opacity-80"
                          >
                            Konwertuj w projekt →
                          </button>
                        )}
                        {o.convertedProjectId && (
                          <Link
                            href={`/projects/${o.convertedProjectId}`}
                            className="mt-2 block text-center font-mono text-[11px] text-accent hover:underline"
                          >
                            → projekt
                          </Link>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => setClosing(o)}
                        className="mt-2 w-full rounded-lg bg-accent-deep px-2 py-1.5 text-[11.5px] font-bold text-white hover:opacity-90"
                      >
                        Rozstrzygnij
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

      {closing && (
        <CloseOpportunityDialog
          opportunity={closing}
          showMoney={showMoney}
          onClose={() => setClosing(null)}
          onClosed={() => {
            setClosing(null);
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
