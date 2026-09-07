"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, dialogField, dialogLabel, readError } from "@/components/crm/Dialog";
import { DateField } from "@/components/ui/DateField";
import {
  PRIORITIES,
  PRIORITY_LABEL,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
} from "@/lib/domain";

export type TaskFormValues = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  estimatedHours: number | null;
  dueDate: string | null;
};

/**
 * Edycja i usunięcie zadania. Do tej pory z interfejsu dało się zmienić
 * wyłącznie status — tytuł, opis, termin i wykonawca były nie do poprawienia,
 * mimo że trasa PATCH obsługiwała je od początku.
 */
export function EditTaskButton({
  task,
  assignees,
  canDelete,
}: {
  task: TaskFormValues;
  assignees: { id: string; fullName: string }[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const text = (k: string) => String(form.get(k) ?? "").trim();
    const est = text("estimatedHours");

    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: text("title"),
        description: text("description"),
        status: text("status"),
        priority: text("priority"),
        assigneeId: text("assigneeId") || null,
        estimatedHours: est === "" ? null : Number(est.replace(",", ".")),
        dueDate: text("dueDate") || null,
      }),
    });

    if (!res.ok) {
      setError(await readError(res, "Nie udało się zapisać zadania."));
      setPending(false);
      return;
    }
    setOpen(false);
    setPending(false);
    router.refresh();
  }

  async function remove() {
    setPending(true);
    const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError(await readError(res, "Nie udało się usunąć zadania."));
      setPending(false);
      setConfirmDelete(false);
      return;
    }
    router.push("/tasks");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border px-3.5 py-1.5 text-[13px] font-semibold text-ink-soft hover:bg-surface-2"
      >
        Edytuj
      </button>

      {open && (
        <Dialog title={`Edycja: ${task.code}`} onClose={() => setOpen(false)}>
          <form onSubmit={save} className="mt-5 space-y-4">
            <label className="block">
              <span className={dialogLabel}>Tytuł</span>
              <input
                name="title"
                required
                minLength={3}
                defaultValue={task.title}
                className={dialogField}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={dialogLabel}>Wykonawca</span>
                <select
                  name="assigneeId"
                  className={dialogField}
                  defaultValue={task.assigneeId ?? ""}
                >
                  <option value="">nieprzypisane</option>
                  {assignees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.fullName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className={dialogLabel}>Priorytet</span>
                <select name="priority" className={dialogField} defaultValue={task.priority}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className={dialogLabel}>Status</span>
                <select name="status" className={dialogField} defaultValue={task.status}>
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {TASK_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className={dialogLabel}>Termin</span>
                <DateField
                  name="dueDate"
                  defaultValue={task.dueDate ? task.dueDate.slice(0, 10) : ""}
                  className={dialogField}
                />
              </label>

              <label className="block">
                <span className={dialogLabel}>Godziny szacowane</span>
                <input
                  name="estimatedHours"
                  inputMode="decimal"
                  defaultValue={task.estimatedHours ?? ""}
                  className={dialogField}
                />
              </label>
            </div>

            <label className="block">
              <span className={dialogLabel}>Opis</span>
              <textarea
                name="description"
                rows={4}
                defaultValue={task.description ?? ""}
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
                {pending ? "Zapisywanie…" : "Zapisz zmiany"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border px-5 py-2.5 text-[14px] font-semibold text-ink-soft hover:bg-surface-2"
              >
                Anuluj
              </button>

              {canDelete && (
                <span className="ml-auto">
                  {confirmDelete ? (
                    <button
                      type="button"
                      onClick={remove}
                      disabled={pending}
                      className="rounded-lg bg-crit px-4 py-2.5 text-[13px] font-bold text-white hover:opacity-90"
                    >
                      Potwierdzam usunięcie
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="rounded-lg px-4 py-2.5 text-[13px] font-semibold text-muted hover:text-crit"
                    >
                      Usuń zadanie…
                    </button>
                  )}
                </span>
              )}
            </div>

            {confirmDelete && (
              <p className="rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[12.5px] text-crit">
                Usunięcie skasuje też komentarze zadania. Zarejestrowane godziny zostaną
                w projekcie — odłączą się od zadania, ale nie znikną z rentowności.
              </p>
            )}
          </form>
        </Dialog>
      )}
    </>
  );
}
