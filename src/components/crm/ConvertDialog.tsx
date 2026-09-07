"use client";

import { useState } from "react";
import { Dialog, dialogField, dialogLabel, readError } from "@/components/crm/Dialog";
import { SERVICE_TYPES, SERVICE_TYPE_LABEL } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import type { OpportunityRow } from "@/components/crm/CrmPipeline";
import { DateField } from "@/components/ui/DateField";

/**
 * Konwersja szansy w projekt (spec 05). Formularz nie prosi o klienta, kontakty
 * ani wycene — projekt dziedziczy je z karty CRM. Do uzupelnienia zostaje tylko to,
 * czego szansa nie niesie: typ uslugi i ramy czasowe.
 */
export function ConvertDialog({
  opportunity,
  owners,
  onClose,
  onConverted,
}: {
  opportunity: OpportunityRow;
  owners: { id: string; fullName: string }[];
  onClose: () => void;
  onConverted: (projectId: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();

    const res = await fetch(`/api/opportunities/${opportunity.id}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceType: text("serviceType"),
        ownerId: text("ownerId") || undefined,
        startDate: text("startDate") || undefined,
        endDate: text("endDate") || undefined,
      }),
    });

    if (!res.ok) {
      setError(await readError(res, "Nie udało się przekonwertować szansy."));
      setPending(false);
      return;
    }
    const project = await res.json();
    onConverted(project.id);
  }

  return (
    <Dialog title="Konwersja szansy w projekt" onClose={onClose}>
      <div className="mt-4 rounded-xl border border-border bg-surface-2 px-4 py-3">
        <p className="text-[13.5px] font-semibold text-ink">{opportunity.title}</p>
        <p className="mt-0.5 text-[12.5px] text-muted">
          {opportunity.clientName}
          {opportunity.value !== null ? ` · ${formatMoney(opportunity.value)}` : ""}
        </p>
        <p className="mt-2 text-[12px] text-ink-soft">
          Projekt odziedziczy klienta, kontakty i wycenę z karty CRM. Checklista powstanie
          automatycznie z szablonu typu usługi.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <label className="block">
          <span className={dialogLabel}>Typ usługi</span>
          <select
            name="serviceType"
            required
            className={dialogField}
            defaultValue={opportunity.serviceType ?? ""}
          >
            <option value="" disabled>
              Wybierz typ usługi…
            </option>
            {SERVICE_TYPES.map((s) => (
              <option key={s} value={s}>
                {SERVICE_TYPE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={dialogLabel}>Opiekun projektu</span>
            <select name="ownerId" className={dialogField} defaultValue="">
              <option value="">opiekun szansy</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.fullName}
                </option>
              ))}
            </select>
          </label>
          <div />
          <label className="block">
            <span className={dialogLabel}>Start</span>
            <DateField  name="startDate" className={dialogField} />
          </label>
          <label className="block">
            <span className={dialogLabel}>Planowany koniec</span>
            <DateField
              
              name="endDate"
              defaultValue={opportunity.expectedCloseDate?.slice(0, 10) ?? ""}
              className={dialogField}
            />
          </label>
        </div>

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
            {pending ? "Konwertowanie…" : "Utwórz projekt"}
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
