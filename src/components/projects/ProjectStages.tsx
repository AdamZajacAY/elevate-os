"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dialog, dialogField, dialogLabel, readError } from "@/components/crm/Dialog";
import { DateField } from "@/components/ui/DateField";
import { PHASES, PHASE_LABEL, labelOf } from "@/lib/domain";
import { formatDate } from "@/lib/format";

export type StageRow = {
  id: string;
  name: string;
  phase: string;
  startDate: string;
  endDate: string;
  progress: number;
};

/**
 * Etapy harmonogramu projektu.
 *
 * Trasy API istniały od początku, ale nie było ekranu — Gantt wieloprojektowy
 * rysował się z pustej listy, bo etapy dało się wprowadzić tylko przez seed.
 */
export function ProjectStages({
  projectId,
  stages,
  canEdit,
}: {
  projectId: string;
  stages: StageRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ mode: "new" } | { mode: "edit"; item: StageRow } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  /** Postęp zmienia się najczęściej — suwak wprost na liście, bez otwierania okna. */
  async function setProgress(item: StageRow, progress: number) {
    setError(null);
    const res = await fetch(`/api/stages/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progress }),
    });
    if (!res.ok) {
      setError(await readError(res, "Nie udało się zapisać postępu."));
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader
        title="Harmonogram projektu"
        subtitle={
          stages.length === 0
            ? "Etapy na osi czasu"
            : `${stages.length} ${stages.length === 1 ? "etap" : "etapów"}`
        }
        action={
          <span className="flex items-center gap-3">
            {canEdit && (
              <button
                onClick={() => setDialog({ mode: "new" })}
                className="text-[12.5px] font-semibold text-accent"
              >
                + Dodaj etap
              </button>
            )}
            <Link href="/gantt" className="text-[12.5px] font-semibold text-accent">
              Gantt →
            </Link>
          </span>
        }
      />
      <div className="p-3">
        {error && (
          <p className="mb-2 rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[12.5px] text-crit">
            {error}
          </p>
        )}

        {stages.length === 0 ? (
          <EmptyState
            title="Brak etapów"
            hint="Dodaj etapy, żeby projekt pojawił się na wykresie Gantta."
          />
        ) : (
          <ul className="space-y-1">
            {stages.map((s) => (
              <li key={s.id} className="rounded-xl px-2.5 py-2 hover:bg-surface-2">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => canEdit && setDialog({ mode: "edit", item: s })}
                    disabled={!canEdit}
                    className={`min-w-0 flex-1 truncate text-left text-[13.5px] text-ink ${
                      canEdit ? "hover:text-accent" : ""
                    }`}
                  >
                    {s.name}
                  </button>
                  <Pill tone="neutral">{labelOf(PHASE_LABEL, s.phase)}</Pill>
                  <span className="shrink-0 font-mono text-[11px] text-muted">
                    {formatDate(s.startDate)} → {formatDate(s.endDate)}
                  </span>
                </div>

                <div className="mt-1.5 flex items-center gap-2.5">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      style={{ width: `${s.progress}%` }}
                      className="h-full rounded-full bg-accent"
                    />
                  </div>
                  {canEdit ? (
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      defaultValue={s.progress}
                      onMouseUp={(e) => setProgress(s, Number(e.currentTarget.value))}
                      onTouchEnd={(e) => setProgress(s, Number(e.currentTarget.value))}
                      aria-label={`Postęp etapu ${s.name}`}
                      className="w-[110px] accent-[var(--accent-deep)]"
                    />
                  ) : null}
                  <span className="w-[38px] shrink-0 text-right font-mono text-[11px] text-accent">
                    {s.progress}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {dialog && (
        <StageDialog
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

function StageDialog({
  projectId,
  item,
  onClose,
  onSaved,
}: {
  projectId: string;
  item?: StageRow;
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

    const res = await fetch(isEdit ? `/api/stages/${item.id}` : "/api/stages", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(isEdit ? {} : { projectId }),
        name: text("name"),
        phase: text("phase"),
        startDate: text("startDate"),
        endDate: text("endDate"),
        progress: Number(text("progress") || 0),
      }),
    });

    if (!res.ok) {
      setError(await readError(res, "Nie udało się zapisać etapu."));
      setPending(false);
      return;
    }
    onSaved();
  }

  async function remove() {
    if (!item) return;
    setPending(true);
    const res = await fetch(`/api/stages/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError(await readError(res, "Nie udało się usunąć etapu."));
      setPending(false);
      setConfirmDelete(false);
      return;
    }
    onSaved();
  }

  return (
    <Dialog title={isEdit ? `Edycja: ${item.name}` : "Nowy etap harmonogramu"} onClose={onClose}>
      <form onSubmit={save} className="mt-5 space-y-4">
        <label className="block">
          <span className={dialogLabel}>Nazwa etapu</span>
          <input
            name="name"
            required
            minLength={2}
            defaultValue={item?.name ?? ""}
            className={dialogField}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={dialogLabel}>Start</span>
            <DateField
              name="startDate"
              required
              defaultValue={item ? item.startDate.slice(0, 10) : ""}
              className={dialogField}
            />
          </label>
          <label className="block">
            <span className={dialogLabel}>Koniec</span>
            <DateField
              name="endDate"
              required
              defaultValue={item ? item.endDate.slice(0, 10) : ""}
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
          <label className="block">
            <span className={dialogLabel}>Postęp (%)</span>
            <input
              name="progress"
              type="number"
              min={0}
              max={100}
              defaultValue={item?.progress ?? 0}
              className={dialogField}
            />
          </label>
        </div>

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
            {pending ? "Zapisywanie…" : isEdit ? "Zapisz zmiany" : "Dodaj etap"}
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
                  Usuń etap…
                </button>
              )}
            </span>
          )}
        </div>
      </form>
    </Dialog>
  );
}
