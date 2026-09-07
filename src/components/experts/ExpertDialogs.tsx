"use client";

import { useState } from "react";
import { Dialog, dialogField, dialogLabel, readError } from "@/components/crm/Dialog";
import type { ExpertRow } from "@/components/experts/ExpertsClient";
import { DateField } from "@/components/ui/DateField";

const AVAILABILITY = [
  ["DOSTEPNY", "Dostępny"],
  ["OGRANICZONA", "Ograniczona dostępność"],
  ["NIEDOSTEPNY", "Niedostępny"],
] as const;

/**
 * Okno eksperta — jedno dla dodawania i edycji. Tryb wynika z obecności `expert`.
 * Ekspert z historią przypisań nie jest usuwany, tylko dezaktywowany: inaczej
 * rentowność zamkniętych projektów straciłaby koszt podwykonawcy.
 */
export function ExpertDialog({
  expert,
  showMoney,
  onClose,
  onSaved,
}: {
  expert?: ExpertRow;
  showMoney: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!expert;
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function toggleActive() {
    if (!expert) return;
    setPending(true);
    const res = await fetch(`/api/experts/${expert.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !expert.isActive }),
    });
    if (!res.ok) {
      setError(await readError(res, "Nie udało się zmienić statusu."));
      setPending(false);
      return;
    }
    onSaved();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const rate = text("hourlyRate");
    const rating = text("rating");

    const res = await fetch(isEdit ? `/api/experts/${expert.id}` : "/api/experts", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: text("fullName"),
        specialty: text("specialty"),
        company: text("company"),
        email: text("email"),
        phone: text("phone"),
        availability: text("availability"),
        rating: rating === "" ? null : Number(rating),
        notes: text("notes"),
        ...(showMoney ? { hourlyRate: rate === "" ? null : Number(rate.replace(",", ".")) } : {}),
      }),
    });

    if (!res.ok) {
      setError(await readError(res, "Nie udało się zapisać eksperta."));
      setPending(false);
      return;
    }
    onSaved();
  }

  return (
    <Dialog
      title={isEdit ? `Edycja: ${expert.fullName}` : "Nowy ekspert zewnętrzny"}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={dialogLabel}>Imię i nazwisko</span>
            <input name="fullName" required minLength={3} defaultValue={expert?.fullName ?? ""} className={dialogField} />
          </label>
          <label className="block">
            <span className={dialogLabel}>Specjalizacja</span>
            <input name="specialty" required minLength={2} defaultValue={expert?.specialty ?? ""} className={dialogField} />
          </label>
          <label className="block">
            <span className={dialogLabel}>Firma</span>
            <input name="company" defaultValue={expert?.company ?? ""} className={dialogField} />
          </label>
          <label className="block">
            <span className={dialogLabel}>Dostępność</span>
            <select
              name="availability"
              className={dialogField}
              defaultValue={expert?.availability ?? "DOSTEPNY"}
            >
              {AVAILABILITY.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={dialogLabel}>E-mail</span>
            <input type="email" name="email" defaultValue={expert?.email ?? ""} className={dialogField} />
          </label>
          <label className="block">
            <span className={dialogLabel}>Telefon</span>
            <input name="phone" defaultValue={expert?.phone ?? ""} className={dialogField} />
          </label>
          {showMoney && (
            <label className="block">
              <span className={dialogLabel}>Stawka godzinowa (PLN)</span>
              <input name="hourlyRate" inputMode="decimal" defaultValue={expert?.hourlyRate ?? ""} className={dialogField} />
            </label>
          )}
          <label className="block">
            <span className={dialogLabel}>Ocena współpracy (1–5)</span>
            <input name="rating" type="number" min={1} max={5} defaultValue={expert?.rating ?? ""} className={dialogField} />
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

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <DialogActions
            pending={pending}
            submitLabel={isEdit ? "Zapisz zmiany" : "Dodaj eksperta"}
            onClose={onClose}
          />
          {isEdit && (
            <button
              type="button"
              onClick={toggleActive}
              disabled={pending}
              className="ml-auto rounded-lg px-4 py-2.5 text-[13px] font-semibold text-muted hover:text-crit"
            >
              {expert.isActive ? "Dezaktywuj" : "Aktywuj ponownie"}
            </button>
          )}
        </div>
      </form>
    </Dialog>
  );
}

export function AssignExpertDialog({
  expert,
  projects,
  showMoney,
  onClose,
  onAssigned,
}: {
  expert: ExpertRow;
  projects: { id: string; code: string; name: string }[];
  showMoney: boolean;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Projekty, do ktorych ekspert nie jest jeszcze przypisany.
  const assignedIds = new Set(expert.assignments.map((a) => a.projectId));
  const available = projects.filter((p) => !assignedIds.has(p.id));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const value = text("contractValue");

    const res = await fetch("/api/experts/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: text("projectId"),
        expertId: expert.id,
        scope: text("scope"),
        startDate: text("startDate") || null,
        endDate: text("endDate") || null,
        ...(showMoney
          ? { contractValue: value === "" ? null : Number(value.replace(",", ".")) }
          : {}),
      }),
    });

    if (!res.ok) {
      setError(await readError(res, "Nie udało się przypisać eksperta."));
      setPending(false);
      return;
    }
    onAssigned();
  }

  return (
    <Dialog title={`Przypisz: ${expert.fullName}`} onClose={onClose}>
      {available.length === 0 ? (
        <div className="mt-5">
          <p className="text-[13.5px] text-ink-soft">
            Ekspert jest już przypisany do wszystkich aktywnych projektów.
          </p>
          <button
            onClick={onClose}
            className="mt-4 rounded-lg border border-border px-5 py-2.5 text-[14px] font-semibold text-ink-soft hover:bg-surface-2"
          >
            Zamknij
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <label className="block">
            <span className={dialogLabel}>Projekt</span>
            <select name="projectId" required className={dialogField} defaultValue="">
              <option value="" disabled>
                Wybierz projekt…
              </option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={dialogLabel}>Zakres prac</span>
            <textarea name="scope" required minLength={3} rows={2} className={dialogField} />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            {showMoney && (
              <label className="block">
                <span className={dialogLabel}>Wartość umowy (PLN)</span>
                <input name="contractValue" inputMode="decimal" className={dialogField} />
              </label>
            )}
            <div />
            <label className="block">
              <span className={dialogLabel}>Start</span>
              <DateField  name="startDate" className={dialogField} />
            </label>
            <label className="block">
              <span className={dialogLabel}>Koniec</span>
              <DateField  name="endDate" className={dialogField} />
            </label>
          </div>

          {showMoney && (
            <p className="text-[12px] text-muted">
              Wartość umowy podwykonawcy wchodzi do kosztu projektu na dashboardzie finansowym.
            </p>
          )}

          {error && (
            <p className="rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[13px] text-crit">
              {error}
            </p>
          )}

          <DialogActions pending={pending} submitLabel="Przypisz" onClose={onClose} />
        </form>
      )}
    </Dialog>
  );
}

function DialogActions({
  pending,
  submitLabel,
  onClose,
}: {
  pending: boolean;
  submitLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="flex gap-3 pt-1">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent-deep px-5 py-2.5 text-[14px] font-bold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Zapisywanie…" : submitLabel}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg border border-border px-5 py-2.5 text-[14px] font-semibold text-ink-soft hover:bg-surface-2"
      >
        Anuluj
      </button>
    </div>
  );
}
