"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dialog, dialogField, dialogLabel, readError } from "@/components/crm/Dialog";
import { DateField } from "@/components/ui/DateField";
import { PHASES, PHASE_LABEL, labelOf } from "@/lib/domain";
import { formatDate, daysUntil } from "@/lib/format";

export type MilestoneRow = {
  id: string;
  name: string;
  description: string | null;
  phase: string;
  dueDate: string;
  completedAt: string | null;
};

/**
 * Kamienie milowe — kluczowe daty decyzyjne projektu.
 *
 * Odhaczenie jest odwracalne i idzie osobnym kliknięciem, bo to najczęstsza
 * operacja: reszta pól zmienia się rzadko, a „zrobione / niezrobione" ciągle.
 * Kamień po terminie przestawia status RAG projektu, więc każda zmiana
 * przelicza go po stronie serwera.
 */
export function Milestones({
  projectId,
  milestones,
  canEdit,
}: {
  projectId: string;
  milestones: MilestoneRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ mode: "new" } | { mode: "edit"; item: MilestoneRow } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function toggle(item: MilestoneRow) {
    setError(null);
    const res = await fetch(`/api/milestones/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completedAt: item.completedAt ? null : new Date().toISOString() }),
    });
    if (!res.ok) {
      setError(await readError(res, "Nie udało się zmienić kamienia milowego."));
      return;
    }
    router.refresh();
  }

  const done = milestones.filter((m) => m.completedAt).length;

  return (
    <Card>
      <CardHeader
        title="Kamienie milowe"
        subtitle={
          milestones.length === 0
            ? "Kluczowe daty decyzyjne"
            : `${done} z ${milestones.length} zrealizowanych`
        }
        action={
          canEdit ? (
            <button
              onClick={() => setDialog({ mode: "new" })}
              className="text-[12.5px] font-semibold text-accent"
            >
              + Dodaj
            </button>
          ) : undefined
        }
      />
      <div className="p-3">
        {error && (
          <p className="mb-2 rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[12.5px] text-crit">
            {error}
          </p>
        )}

        {milestones.length === 0 ? (
          <EmptyState
            title="Brak kamieni milowych"
            hint="Termin dostarczenia strategii, start wdrożenia, przegląd kwartalny…"
          />
        ) : (
          <ul className="space-y-1">
            {milestones.map((m) => {
              const days = daysUntil(m.dueDate);
              const overdue = !m.completedAt && days !== null && days < 0;
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-surface-2"
                >
                  <button
                    onClick={() => canEdit && toggle(m)}
                    disabled={!canEdit}
                    title={m.completedAt ? "Cofnij realizację" : "Oznacz jako zrealizowany"}
                    className={`h-4 w-4 shrink-0 rounded-full border-2 transition-colors ${
                      m.completedAt
                        ? "border-good bg-good"
                        : overdue
                          ? "border-crit"
                          : "border-border hover:border-accent"
                    } ${canEdit ? "cursor-pointer" : "cursor-default"}`}
                  />
                  <button
                    onClick={() => canEdit && setDialog({ mode: "edit", item: m })}
                    disabled={!canEdit}
                    className={`min-w-0 flex-1 truncate text-left text-[13.5px] ${
                      m.completedAt ? "text-muted line-through" : "text-ink"
                    } ${canEdit ? "hover:text-accent" : ""}`}
                  >
                    {m.name}
                  </button>
                  <Pill tone="neutral">{labelOf(PHASE_LABEL, m.phase)}</Pill>
                  <span
                    className={`w-[92px] shrink-0 text-right font-mono text-[11px] ${
                      overdue ? "text-crit" : "text-muted"
                    }`}
                  >
                    {formatDate(m.dueDate)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {dialog && (
        <MilestoneDialog
          projectId={projectId}
          item={dialog.mode === "edit" ? dialog.item : undefined}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            router.refresh();
          }}
        />
      )}
    </Card>
  );
}

function MilestoneDialog({
  projectId,
  item,
  onClose,
  onSaved,
}: {
  projectId: string;
  item?: MilestoneRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!item;
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const text = (k: string) => String(form.get(k) ?? "").trim();

    const res = await fetch(isEdit ? `/api/milestones/${item.id}` : "/api/milestones", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(isEdit ? {} : { projectId }),
        name: text("name"),
        description: text("description"),
        phase: text("phase"),
        dueDate: text("dueDate"),
      }),
    });

    if (!res.ok) {
      setError(await readError(res, "Nie udało się zapisać kamienia milowego."));
      setPending(false);
      return;
    }
    onSaved();
  }

  async function remove() {
    if (!item) return;
    setPending(true);
    const res = await fetch(`/api/milestones/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError(await readError(res, "Nie udało się usunąć."));
      setPending(false);
      setConfirmDelete(false);
      return;
    }
    onSaved();
  }

  return (
    <Dialog title={isEdit ? `Edycja: ${item.name}` : "Nowy kamień milowy"} onClose={onClose}>
      <form onSubmit={save} className="mt-5 space-y-4">
        <label className="block">
          <span className={dialogLabel}>Nazwa</span>
          <input
            name="name"
            required
            minLength={3}
            defaultValue={item?.name ?? ""}
            className={dialogField}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={dialogLabel}>Termin</span>
            <DateField
              name="dueDate"
              required
              defaultValue={item ? item.dueDate.slice(0, 10) : ""}
              className={dialogField}
            />
          </label>
          <label className="block">
            <span className={dialogLabel}>Faza Elevate</span>
            <select name="phase" className={dialogField} defaultValue={item?.phase ?? "EXPLORE"}>
              {PHASES.map((p) => (
                <option key={p} value={p}>
                  {PHASE_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className={dialogLabel}>Opis</span>
          <textarea
            name="description"
            rows={3}
            defaultValue={item?.description ?? ""}
            className={dialogField}
          />
        </label>

        {error && (
          <p className="rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[13px] text-crit">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent-deep px-5 py-2.5 text-[14px] font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Zapisywanie…" : isEdit ? "Zapisz zmiany" : "Dodaj"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-5 py-2.5 text-[14px] font-semibold text-ink-soft hover:bg-surface-2"
          >
            Anuluj
          </button>
          {isEdit && (
            <span className="ml-auto">
              {confirmDelete ? (
                <button
                  type="button"
                  onClick={remove}
                  className="rounded-lg bg-crit px-4 py-2.5 text-[13px] font-bold text-white hover:opacity-90"
                >
                  Potwierdzam
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-lg px-4 py-2.5 text-[13px] font-semibold text-muted hover:text-crit"
                >
                  Usuń…
                </button>
              )}
            </span>
          )}
        </div>
      </form>
    </Dialog>
  );
}
