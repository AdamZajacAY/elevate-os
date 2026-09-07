"use client";

import { useState } from "react";
import { PRIORITIES, PRIORITY_LABEL, TASK_STATUSES, TASK_STATUS_LABEL } from "@/lib/domain";
import { DateField } from "@/components/ui/DateField";

const field =
  "mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2 text-[14px] text-ink outline-none focus:border-accent";
const labelClass = "font-mono text-[10.5px] uppercase tracking-wider text-muted";

export function NewTaskDialog({
  projects,
  assignees,
  defaultProjectId,
  onClose,
  onCreated,
}: {
  projects: { id: string; code: string; name: string }[];
  assignees: { id: string; fullName: string }[];
  defaultProjectId: string;
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
    const estimated = String(form.get("estimatedHours") ?? "").trim();

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: String(form.get("projectId") ?? ""),
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? ""),
        status: String(form.get("status") ?? "TODO"),
        priority: String(form.get("priority") ?? "MEDIUM"),
        assigneeId: String(form.get("assigneeId") ?? "") || null,
        estimatedHours: estimated === "" ? null : Number(estimated.replace(",", ".")),
        dueDate: String(form.get("dueDate") ?? "") || null,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = Array.isArray(body.details)
        ? body.details.map((d: { message: string }) => d.message).join(", ")
        : null;
      setError(detail ?? body.error ?? "Nie udało się zapisać zadania.");
      setPending(false);
      return;
    }
    onCreated();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nowe zadanie"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-[560px] overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-card"
      >
        <h2 className="font-display text-[19px] font-bold text-ink">Nowe zadanie</h2>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <label className="block">
            <span className={labelClass}>Projekt</span>
            <select name="projectId" required className={field} defaultValue={defaultProjectId}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={labelClass}>Tytuł</span>
            <input name="title" required minLength={3} className={field} />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Wykonawca</span>
              <select name="assigneeId" className={field} defaultValue="">
                <option value="">nieprzypisane</option>
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.fullName}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Priorytet</span>
              <select name="priority" className={field} defaultValue="MEDIUM">
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Status</span>
              <select name="status" className={field} defaultValue="TODO">
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Termin</span>
              <DateField  name="dueDate" className={field} />
            </label>

            <label className="block">
              <span className={labelClass}>Godziny szacowane</span>
              <input name="estimatedHours" inputMode="decimal" className={field} />
            </label>
          </div>

          <label className="block">
            <span className={labelClass}>Opis</span>
            <textarea name="description" rows={3} className={field} />
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
              {pending ? "Zapisywanie…" : "Dodaj zadanie"}
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
      </div>
    </div>
  );
}
