"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dialog, dialogField, dialogLabel, readError } from "@/components/crm/Dialog";
import {
  IMPROVEMENT_STATUSES,
  IMPROVEMENT_STATUS_LABEL,
  type ImprovementStatus,
  labelOf,
} from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { PreferencesPanel } from "@/components/improvements/PreferencesPanel";
import { GoogleCalendarPanel } from "@/components/improvements/GoogleCalendarPanel";

type Improvement = {
  id: string;
  title: string;
  body: string;
  status: string;
  adminNote: string | null;
  authorId: string;
  authorName: string;
  createdAt: string;
};

const STATUS_TONE: Record<string, "accent" | "warn" | "good" | "crit"> = {
  NOWY: "accent",
  W_ANALIZIE: "warn",
  WDROZONY: "good",
  ODRZUCONY: "crit",
};

export function ImprovementsClient({
  improvements,
  preferences,
  isAdmin,
  currentUserId,
}: {
  improvements: Improvement[];
  preferences: { theme: string; defaultView: string; urgentDays: number };
  isAdmin: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Administrator zmienia status zgloszenia wprost z listy. */
  async function setStatus(id: string, status: ImprovementStatus) {
    setError(null);
    const res = await fetch(`/api/improvements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setError(await readError(res, "Nie udało się zmienić statusu."));
      return;
    }
    router.refresh();
  }

  async function withdraw(id: string) {
    setError(null);
    const res = await fetch(`/api/improvements/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError(await readError(res, "Nie udało się wycofać zgłoszenia."));
      return;
    }
    router.refresh();
  }

  const open_ = improvements.filter((i) => i.status === "NOWY" || i.status === "W_ANALIZIE");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-accent">Ustawienia</p>
          <h1 className="mt-1 font-display text-[28px] font-black tracking-tight text-ink">
            Panel Usprawnień
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            {isAdmin
              ? `Skrzynka zgłoszeń całego zespołu — ${open_.length} nierozpatrzonych.`
              : "Twoje zgłoszenia i personalizacja własnych ustawień."}
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg bg-accent-deep px-4 py-2 text-[13.5px] font-bold text-white hover:opacity-90"
        >
          Zgłoś usprawnienie
        </button>
      </header>

      {error && (
        <p className="rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[13px] text-crit">
          {error}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader
            title={isAdmin ? "Skrzynka zgłoszeń" : "Moje zgłoszenia"}
            subtitle={`${improvements.length} ${improvements.length === 1 ? "zgłoszenie" : "zgłoszeń"}`}
          />
          <div className="p-3">
            {improvements.length === 0 ? (
              <EmptyState
                title="Brak zgłoszeń"
                hint="Masz pomysł na usprawnienie narzędzia albo procesu? Zgłoś go."
              />
            ) : (
              <ul className="space-y-2">
                {improvements.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-border bg-surface-2 px-3.5 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 text-[13.5px] font-semibold text-ink">
                        {item.title}
                      </p>
                      <Pill tone={STATUS_TONE[item.status] ?? "neutral"}>
                        {labelOf(IMPROVEMENT_STATUS_LABEL, item.status)}
                      </Pill>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[12.5px] text-ink-soft">
                      {item.body}
                    </p>
                    <p className="mt-1.5 font-mono text-[10.5px] text-muted">
                      {item.authorName} · {formatDate(item.createdAt)}
                    </p>

                    {item.adminNote && (
                      <p className="mt-2 rounded-lg border border-border bg-surface px-3 py-2 text-[12px] text-ink-soft">
                        <span className="font-semibold text-ink">Odpowiedź: </span>
                        {item.adminNote}
                      </p>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {isAdmin && (
                        <select
                          value={item.status}
                          onChange={(e) => setStatus(item.id, e.target.value as ImprovementStatus)}
                          aria-label={`Zmień status zgłoszenia ${item.title}`}
                          className="rounded-lg border border-border bg-surface px-2 py-1 text-[11.5px] text-ink-soft outline-none focus:border-accent"
                        >
                          {IMPROVEMENT_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {IMPROVEMENT_STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      )}
                      {(isAdmin || item.authorId === currentUserId) && (
                        <button
                          onClick={() => withdraw(item.id)}
                          className="text-[11.5px] font-semibold text-muted hover:text-crit"
                        >
                          Wycofaj
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <div className="space-y-5">
          <PreferencesPanel preferences={preferences} />
          <GoogleCalendarPanel />
        </div>
      </div>

      {open && (
        <NewImprovementDialog
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function NewImprovementDialog({
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
    const res = await fetch("/api/improvements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: String(form.get("title") ?? "").trim(),
        body: String(form.get("body") ?? "").trim(),
      }),
    });

    if (!res.ok) {
      setError(await readError(res, "Nie udało się zapisać zgłoszenia."));
      setPending(false);
      return;
    }
    onCreated();
  }

  return (
    <Dialog title="Zgłoszenie usprawnienia" onClose={onClose}>
      <p className="mt-2 text-[13px] text-muted">
        Zgłoszenie trafia do skrzynki Administratora. Dostaniesz status: nowy, w analizie, wdrożony
        albo odrzucony.
      </p>
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <label className="block">
          <span className={dialogLabel}>Tytuł</span>
          <input name="title" required minLength={5} className={dialogField} />
        </label>
        <label className="block">
          <span className={dialogLabel}>Opis pomysłu</span>
          <textarea name="body" required minLength={10} rows={5} className={dialogField} />
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
            {pending ? "Wysyłanie…" : "Zgłoś"}
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
