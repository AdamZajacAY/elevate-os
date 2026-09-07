"use client";

import { useRef, useState } from "react";
import { Dialog, dialogField, dialogLabel, readError } from "@/components/crm/Dialog";
import { RegistryLookup } from "@/components/crm/RegistryLookup";
import type { RegistryResult } from "@/lib/registry";
import {
  CLIENT_SEGMENTS,
  CLIENT_SEGMENT_LABEL,
  CLIENT_STATUSES,
  CLIENT_STATUS_LABEL,
} from "@/lib/domain";

export type ClientFormValues = {
  id: string;
  name: string;
  industry: string | null;
  segment: string;
  status: string;
  nip: string | null;
  city: string | null;
  website: string | null;
  notes: string | null;
};

/**
 * Okno klienta — jedno dla dodawania i edycji.
 *
 * Osobne komponenty na "nowy" i "edytuj" znaczyłyby dwa zestawy tych samych pól,
 * które rozjeżdżają się przy pierwszej zmianie w formularzu. Tryb wynika
 * z obecności `client`: jest — edytujemy (PATCH), nie ma — tworzymy (POST).
 */
export function ClientDialog({
  client,
  onClose,
  onSaved,
}: {
  client?: ClientFormValues;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!client;
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /** Wynik z rejestru wpisuje się do pól — bez ręcznego przepisywania. */
  function fillFromRegistry(data: RegistryResult) {
    const form = formRef.current;
    if (!form) return;
    const set = (name: string, value: string | null) => {
      const input = form.elements.namedItem(name);
      if (input instanceof HTMLInputElement && value) input.value = value;
    };
    set("name", data.name);
    set("nip", data.nip);
    set("city", data.city);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();

    const res = await fetch(isEdit ? `/api/clients/${client.id}` : "/api/clients", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: text("name"),
        industry: text("industry"),
        segment: text("segment"),
        status: text("status"),
        nip: text("nip"),
        city: text("city"),
        website: text("website"),
        notes: text("notes"),
      }),
    });

    if (!res.ok) {
      setError(await readError(res, "Nie udało się zapisać klienta."));
      setPending(false);
      return;
    }
    onSaved();
  }

  return (
    <Dialog title={isEdit ? `Edycja: ${client.name}` : "Nowy klient"} onClose={onClose}>
      <form ref={formRef} onSubmit={onSubmit} className="mt-5 space-y-4">
        {/* Przy edycji rejestr też się przydaje — dane firmowe się zmieniają. */}
        <RegistryLookup onResult={fillFromRegistry} />

        <label className="block">
          <span className={dialogLabel}>Nazwa firmy</span>
          <input
            name="name"
            required
            minLength={2}
            defaultValue={client?.name ?? ""}
            className={dialogField}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={dialogLabel}>Branża</span>
            <input name="industry" defaultValue={client?.industry ?? ""} className={dialogField} />
          </label>
          <label className="block">
            <span className={dialogLabel}>Miasto</span>
            <input name="city" defaultValue={client?.city ?? ""} className={dialogField} />
          </label>
          <label className="block">
            <span className={dialogLabel}>Segment</span>
            <select
              name="segment"
              className={dialogField}
              defaultValue={client?.segment ?? "STANDARDOWY"}
            >
              {CLIENT_SEGMENTS.map((s) => (
                <option key={s} value={s}>
                  {CLIENT_SEGMENT_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={dialogLabel}>Status współpracy</span>
            <select
              name="status"
              className={dialogField}
              defaultValue={client?.status ?? "PROSPEKT"}
            >
              {CLIENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CLIENT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={dialogLabel}>NIP</span>
            <input
              name="nip"
              inputMode="numeric"
              pattern="\d{10}"
              defaultValue={client?.nip ?? ""}
              className={dialogField}
            />
          </label>
          <label className="block">
            <span className={dialogLabel}>Strona www</span>
            <input name="website" defaultValue={client?.website ?? ""} className={dialogField} />
          </label>
        </div>

        <label className="block">
          <span className={dialogLabel}>Notatka</span>
          <textarea
            name="notes"
            rows={3}
            defaultValue={client?.notes ?? ""}
            className={dialogField}
          />
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
            {pending ? "Zapisywanie…" : isEdit ? "Zapisz zmiany" : "Dodaj klienta"}
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
