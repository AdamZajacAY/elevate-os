"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dialog, dialogField, dialogLabel, readError } from "@/components/crm/Dialog";

type Contact = {
  id: string;
  fullName: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  decisionLevel: string;
  isPrimary: boolean;
};

const DECISION_LEVELS = [
  ["DECYDENT", "Decydent"],
  ["WPLYWOWY", "Wpływowy"],
  ["OPERACYJNY", "Operacyjny"],
  ["KONTAKT_TECHNICZNY", "Kontakt techniczny"],
] as const;

const DECISION_LABEL = Object.fromEntries(DECISION_LEVELS) as Record<string, string>;

export function ClientContacts({
  clientId,
  contacts,
}: {
  clientId: string;
  contacts: Contact[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader
        title="Kontakty"
        subtitle={`${contacts.length} ${contacts.length === 1 ? "osoba" : "osób"} po stronie klienta`}
        action={
          <button onClick={() => setOpen(true)} className="text-[12.5px] font-semibold text-accent">
            + Dodaj
          </button>
        }
      />
      <div className="p-3">
        {contacts.length === 0 ? (
          <EmptyState title="Brak kontaktów" hint="Dodaj osobę po stronie klienta." />
        ) : (
          <ul className="space-y-1">
            {contacts.map((c) => (
              <li key={c.id} className="rounded-xl px-2.5 py-2 hover:bg-surface-2">
                <div className="flex items-center gap-2.5">
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">
                    {c.fullName}
                  </span>
                  {c.isPrimary && <Pill tone="accent">główny</Pill>}
                  <Pill tone={c.decisionLevel === "DECYDENT" ? "good" : "neutral"}>
                    {DECISION_LABEL[c.decisionLevel] ?? c.decisionLevel}
                  </Pill>
                </div>
                <p className="mt-0.5 text-[12px] text-muted">
                  {[c.position, c.email, c.phone].filter(Boolean).join(" · ") || "brak danych"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && (
        <NewContactDialog
          clientId={clientId}
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </Card>
  );
}

function NewContactDialog({
  clientId,
  onClose,
  onCreated,
}: {
  clientId: string;
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

    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        fullName: text("fullName"),
        position: text("position"),
        email: text("email"),
        phone: text("phone"),
        decisionLevel: text("decisionLevel"),
        isPrimary: form.get("isPrimary") === "on",
      }),
    });

    if (!res.ok) {
      setError(await readError(res, "Nie udało się zapisać kontaktu."));
      setPending(false);
      return;
    }
    onCreated();
  }

  return (
    <Dialog title="Nowy kontakt" onClose={onClose}>
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <label className="block">
          <span className={dialogLabel}>Imię i nazwisko</span>
          <input name="fullName" required minLength={2} className={dialogField} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={dialogLabel}>Stanowisko</span>
            <input name="position" className={dialogField} />
          </label>
          <label className="block">
            <span className={dialogLabel}>Poziom decyzyjny</span>
            <select name="decisionLevel" className={dialogField} defaultValue="OPERACYJNY">
              {DECISION_LEVELS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={dialogLabel}>E-mail</span>
            <input type="email" name="email" className={dialogField} />
          </label>
          <label className="block">
            <span className={dialogLabel}>Telefon</span>
            <input name="phone" className={dialogField} />
          </label>
        </div>

        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            name="isPrimary"
            className="h-4 w-4 accent-[var(--accent-deep)]"
          />
          <span className="text-[13px] text-ink-soft">Kontakt główny</span>
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
            {pending ? "Zapisywanie…" : "Dodaj kontakt"}
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
