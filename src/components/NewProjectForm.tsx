"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PHASES,
  PHASE_LABEL,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  SERVICE_TYPES,
  SERVICE_TYPE_LABEL,
} from "@/lib/domain";
import { DateField } from "@/components/ui/DateField";

type Option = { id: string; name?: string; fullName?: string };

const field =
  "mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2 text-[14px] text-ink outline-none focus:border-accent";
const labelClass = "font-mono text-[10.5px] uppercase tracking-wider text-muted";

export function NewProjectForm({
  clients,
  owners,
  defaultOwnerId,
  showFinancials,
}: {
  clients: Option[];
  owners: Option[];
  defaultOwnerId: string;
  showFinancials: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const num = (key: string) => {
      const raw = String(form.get(key) ?? "").trim();
      return raw === "" ? null : Number(raw.replace(",", "."));
    };

    const payload = {
      name: String(form.get("name") ?? ""),
      clientId: String(form.get("clientId") ?? ""),
      serviceType: String(form.get("serviceType") ?? ""),
      ownerId: String(form.get("ownerId") ?? "") || null,
      phase: String(form.get("phase") ?? "EXPLORE"),
      status: String(form.get("status") ?? "ACTIVE"),
      description: String(form.get("description") ?? ""),
      startDate: String(form.get("startDate") ?? "") || null,
      endDate: String(form.get("endDate") ?? "") || null,
      ...(showFinancials
        ? {
            budget: num("budget"),
            contractValue: num("contractValue"),
            quotedValue: num("quotedValue"),
          }
        : {}),
    };

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = Array.isArray(body.details)
        ? body.details.map((d: { message: string }) => d.message).join(", ")
        : null;
      setError(detail ?? body.error ?? "Nie udało się zapisać projektu.");
      setPending(false);
      return;
    }

    const project = await res.json();
    router.push(`/projects/${project.id}`);
    router.refresh();
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-2xl border border-warn bg-warn-soft px-5 py-4 text-[13.5px] text-warn">
        Nie ma jeszcze żadnego klienta. Projekt dziedziczy klienta z CRM — dodaj klienta, zanim
        założysz projekt.
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-card"
    >
      <label className="block">
        <span className={labelClass}>Nazwa projektu</span>
        <input name="name" required minLength={3} className={field} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Klient</span>
          <select name="clientId" required className={field} defaultValue="">
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
          <span className={labelClass}>Typ usługi</span>
          <select name="serviceType" required className={field} defaultValue={SERVICE_TYPES[0]}>
            {SERVICE_TYPES.map((s) => (
              <option key={s} value={s}>
                {SERVICE_TYPE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelClass}>Opiekun projektu</span>
          <select name="ownerId" className={field} defaultValue={defaultOwnerId}>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.fullName}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelClass}>Faza Elevate</span>
          <select name="phase" className={field} defaultValue="EXPLORE">
            {PHASES.map((p) => (
              <option key={p} value={p}>
                {PHASE_LABEL[p]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelClass}>Status</span>
          <select name="status" className={field} defaultValue="ACTIVE">
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>

        <div />

        <label className="block">
          <span className={labelClass}>Start</span>
          <DateField  name="startDate" className={field} />
        </label>

        <label className="block">
          <span className={labelClass}>Planowany koniec</span>
          <DateField  name="endDate" className={field} />
        </label>
      </div>

      {showFinancials && (
        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-2 font-mono text-[10.5px] uppercase tracking-wider text-accent">
            Finanse
          </legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className={labelClass}>Wycena (PLN)</span>
              <input name="quotedValue" inputMode="decimal" className={field} />
            </label>
            <label className="block">
              <span className={labelClass}>Wartość umowy (PLN)</span>
              <input name="contractValue" inputMode="decimal" className={field} />
            </label>
            <label className="block">
              <span className={labelClass}>Budżet kosztowy (PLN)</span>
              <input name="budget" inputMode="decimal" className={field} />
            </label>
          </div>
        </fieldset>
      )}

      <label className="block">
        <span className={labelClass}>Opis / zakres</span>
        <textarea name="description" rows={4} className={field} />
      </label>

      {error && (
        <p className="rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[13px] text-crit">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent-deep px-5 py-2.5 text-[14px] font-bold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Zapisywanie…" : "Załóż projekt"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-border px-5 py-2.5 text-[14px] font-semibold text-ink-soft hover:bg-surface-2"
        >
          Anuluj
        </button>
      </div>
    </form>
  );
}
