"use client";

import { useState } from "react";
import { Dialog, dialogField, dialogLabel, readError } from "@/components/crm/Dialog";
import { ROLES, ROLE_LABEL } from "@/lib/domain";

export function NewUserDialog({
  onClose,
  onCreated,
}: {
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
    const rate = text("hourlyRate");

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: text("email"),
        fullName: text("fullName"),
        role: text("role"),
        password: text("password"),
        position: text("position"),
        fte: Number(text("fte") || 1),
        hourlyRate: rate === "" ? null : Number(rate.replace(",", ".")),
      }),
    });

    if (!res.ok) {
      setError(await readError(res, "Nie udało się utworzyć konta."));
      setPending(false);
      return;
    }
    onCreated();
  }

  return (
    <Dialog title="Nowe konto" onClose={onClose}>
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={dialogLabel}>Imię i nazwisko</span>
            <input name="fullName" required minLength={3} className={dialogField} />
          </label>
          <label className="block">
            <span className={dialogLabel}>E-mail</span>
            <input type="email" name="email" required className={dialogField} />
          </label>
          <label className="block">
            <span className={dialogLabel}>Rola</span>
            <select name="role" className={dialogField} defaultValue="CONSULTANT">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={dialogLabel}>Stanowisko</span>
            <input name="position" className={dialogField} />
          </label>
          <label className="block">
            <span className={dialogLabel}>Etat (FTE)</span>
            <input
              name="fte"
              type="number"
              step="0.1"
              min={0}
              max={2}
              defaultValue={1}
              className={dialogField}
            />
          </label>
          <label className="block">
            <span className={dialogLabel}>Stawka godzinowa (PLN)</span>
            <input name="hourlyRate" inputMode="decimal" className={dialogField} />
          </label>
        </div>

        <label className="block">
          <span className={dialogLabel}>Hasło startowe (min. 10 znaków)</span>
          <input type="password" name="password" required minLength={10} className={dialogField} />
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
            {pending ? "Tworzenie…" : "Utwórz konto"}
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
