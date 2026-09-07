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

export function NewClientDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  /** Wynik z rejestru wpisuje sie do pol formularza — bez recznego przepisywania. */
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

    const res = await fetch("/api/clients", {
      method: "POST",
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
    onCreated();
  }

  return (
    <Dialog title="Nowy klient" onClose={onClose}>
      <form ref={formRef} onSubmit={onSubmit} className="mt-5 space-y-4">
        <RegistryLookup onResult={fillFromRegistry} />

        <label className="block">
          <span className={dialogLabel}>Nazwa firmy</span>
          <input name="name" required minLength={2} className={dialogField} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={dialogLabel}>Branża</span>
            <input name="industry" className={dialogField} />
          </label>
          <label className="block">
            <span className={dialogLabel}>Miasto</span>
            <input name="city" className={dialogField} />
          </label>
          <label className="block">
            <span className={dialogLabel}>Segment</span>
            <select name="segment" className={dialogField} defaultValue="STANDARDOWY">
              {CLIENT_SEGMENTS.map((s) => (
                <option key={s} value={s}>
                  {CLIENT_SEGMENT_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={dialogLabel}>Status współpracy</span>
            <select name="status" className={dialogField} defaultValue="PROSPEKT">
              {CLIENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CLIENT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={dialogLabel}>NIP</span>
            <input name="nip" inputMode="numeric" pattern="\d{10}" className={dialogField} />
          </label>
          <label className="block">
            <span className={dialogLabel}>Strona www</span>
            <input name="website" className={dialogField} />
          </label>
        </div>

        <label className="block">
          <span className={dialogLabel}>Notatka</span>
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
            {pending ? "Zapisywanie…" : "Dodaj klienta"}
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
