"use client";

import { useState } from "react";
import { Dialog, dialogField, dialogLabel, readError } from "@/components/crm/Dialog";
import {
  WIN_FACTORS,
  WIN_FACTOR_LABEL,
  LOSS_FACTORS,
  LOSS_FACTOR_LABEL,
} from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import type { OpportunityRow } from "@/components/crm/CrmPipeline";

/**
 * Zamkniecie szansy. Czynnik jest wymagany — bez niego zostaje wiedza w glowie
 * osoby, ktora prowadzila rozmowe, i za pol roku nikt nie odpowie, dlaczego
 * przegrywamy oferty.
 */
export function CloseOpportunityDialog({
  opportunity,
  showMoney,
  onClose,
  onClosed,
}: {
  opportunity: OpportunityRow;
  showMoney: boolean;
  onClose: () => void;
  onClosed: () => void;
}) {
  const [outcome, setOutcome] = useState<"WON" | "LOST" | null>(null);
  const [factors, setFactors] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function pickOutcome(next: "WON" | "LOST") {
    setOutcome(next);
    setFactors([]); // czynniki wygranej nie maja sensu przy przegranej i odwrotnie
    setError(null);
  }

  function toggle(code: string) {
    setFactors((prev) =>
      prev.includes(code) ? prev.filter((f) => f !== code) : [...prev, code],
    );
  }

  async function submit() {
    if (!outcome) return;
    if (factors.length === 0) {
      setError("Wskaż co najmniej jeden czynnik decyzji.");
      return;
    }
    setPending(true);
    setError(null);

    const res = await fetch(`/api/opportunities/${opportunity.id}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: outcome,
        winFactors: outcome === "WON" ? factors : [],
        lossFactors: outcome === "LOST" ? factors : [],
        decisionNote: note.trim(),
      }),
    });

    if (!res.ok) {
      setError(await readError(res, "Nie udało się zamknąć szansy."));
      setPending(false);
      return;
    }
    onClosed();
  }

  const list = outcome === "WON" ? WIN_FACTORS : LOSS_FACTORS;
  const labels: Record<string, string> =
    outcome === "WON" ? WIN_FACTOR_LABEL : LOSS_FACTOR_LABEL;

  return (
    <Dialog title="Zamknięcie szansy" onClose={onClose}>
      <div className="mt-4 rounded-xl border border-border bg-surface-2 px-4 py-3">
        <p className="text-[13.5px] font-semibold text-ink">{opportunity.title}</p>
        <p className="mt-0.5 text-[12.5px] text-muted">
          {opportunity.clientName}
          {showMoney && opportunity.value !== null ? ` · ${formatMoney(opportunity.value)}` : ""}
        </p>
      </div>

      <div className="mt-5">
        <span className={dialogLabel}>Rozstrzygnięcie</span>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => pickOutcome("WON")}
            className={`rounded-xl border px-4 py-3 text-[14px] font-bold transition-colors ${
              outcome === "WON"
                ? "border-good bg-good-soft text-good"
                : "border-border text-ink-soft hover:bg-surface-2"
            }`}
          >
            Zakup
          </button>
          <button
            type="button"
            onClick={() => pickOutcome("LOST")}
            className={`rounded-xl border px-4 py-3 text-[14px] font-bold transition-colors ${
              outcome === "LOST"
                ? "border-crit bg-crit-soft text-crit"
                : "border-border text-ink-soft hover:bg-surface-2"
            }`}
          >
            Odmowa
          </button>
        </div>
      </div>

      {outcome && (
        <div className="mt-5">
          <span className={dialogLabel}>
            {outcome === "WON" ? "Czynniki sprzedaży" : "Czynniki odmowy"} — zaznacz wszystkie, które zadziałały
          </span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {list.map((code) => {
              const active = factors.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => toggle(code)}
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    active
                      ? outcome === "WON"
                        ? "border-good bg-good-soft text-good"
                        : "border-crit bg-crit-soft text-crit"
                      : "border-border text-muted hover:text-ink"
                  }`}
                >
                  {labels[code]}
                </button>
              );
            })}
          </div>

          <label className="mt-4 block">
            <span className={dialogLabel}>Komentarz (opcjonalny)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={
                outcome === "WON"
                  ? "Co przeważyło, czego klient nie znalazł u konkurencji…"
                  : "Szczegóły odmowy, czy warto wrócić za jakiś czas…"
              }
              className={dialogField}
            />
          </label>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[13px] text-crit">
          {error}
        </p>
      )}

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !outcome}
          className="rounded-lg bg-accent-deep px-5 py-2.5 text-[14px] font-bold text-white hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "Zapisywanie…" : "Zamknij szansę"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border px-5 py-2.5 text-[14px] font-semibold text-ink-soft hover:bg-surface-2"
        >
          Anuluj
        </button>
      </div>
    </Dialog>
  );
}
