"use client";

import { useState } from "react";
import { Dialog, dialogField, dialogLabel, readError } from "@/components/crm/Dialog";
import {
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_LABEL,
  SERVICE_TYPES,
  SERVICE_TYPE_LABEL,
} from "@/lib/domain";

export function NewOpportunityDialog({
  clients,
  owners,
  showMoney,
  onClose,
  onCreated,
}: {
  clients: { id: string; name: string }[];
  owners: { id: string; fullName: string }[];
  showMoney: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const value = text("value");

    const res = await fetch("/api/opportunities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: text("clientId"),
        title: text("title"),
        stage: text("stage"),
        serviceType: text("serviceType") || null,
        probability: Number(text("probability") || 30),
        expectedCloseDate: text("expectedCloseDate") || null,
        ownerId: text("ownerId") || null,
        notes: text("notes"),
        ...(showMoney ? { value: value === "" ? null : Number(value.replace(",", ".")) } : {}),
      }),
    });

    if (!res.ok) {
      setError(await readError(res, "Nie udało się zapisać szansy."));
      setPending(false);
      return;
    }
    onCreated();
  }

  return (
    <Dialog title="Nowa szansa sprzedażowa" onClose={onClose}>
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <label className="block">
          <span className={dialogLabel}>Klient</span>
          <select name="clientId" required className={dialogField} defaultValue="">
            <option value="" disabled>
              Wybierz klienta…
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={dialogLabel}>Tytuł szansy</span>
          <input name="title" required minLength={3} className={dialogField} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={dialogLabel}>Etap pipeline&apos;u</span>
            <select name="stage" className={dialogField} defaultValue="LEAD_OFERTA">
              {OPPORTUNITY_STAGES.map((s) => (
                <option key={s} value={s}>
                  {OPPORTUNITY_STAGE_LABEL[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={dialogLabel}>Typ usługi</span>
            <select name="serviceType" className={dialogField} defaultValue="">
              <option value="">nieokreślony</option>
              {SERVICE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {SERVICE_TYPE_LABEL[s]}
                </option>
              ))}
            </select>
          </label>

          {showMoney && (
            <label className="block">
              <span className={dialogLabel}>Wartość (PLN)</span>
              <input name="value" inputMode="decimal" className={dialogField} />
            </label>
          )}

          <label className="block">
            <span className={dialogLabel}>Prawdopodobieństwo (%)</span>
            <input
              name="probability"
              type="number"
              min={0}
              max={100}
              defaultValue={30}
              className={dialogField}
            />
          </label>

          <label className="block">
            <span className={dialogLabel}>Spodziewane zamknięcie</span>
            <input type="date" name="expectedCloseDate" className={dialogField} />
          </label>

          <label className="block">
            <span className={dialogLabel}>Opiekun</span>
            <select name="ownerId" className={dialogField} defaultValue="">
              <option value="">ja</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.fullName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className={dialogLabel}>Ustalenia</span>
          <textarea name="notes" rows={3} className={dialogField} />
        </label>

        {error && (
          <p className="rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[13px] text-crit">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent-deep px-5 py-2.5 text-[14px] font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Zapisywanie…" : "Dodaj szansę"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-5 py-2.5 text-[14px] font-semibold text-ink-soft hover:bg-surface-2"
          >
            Anuluj
          </button>
        </div>
      </form>
    </Dialog>
  );
}
