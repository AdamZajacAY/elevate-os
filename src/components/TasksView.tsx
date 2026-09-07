"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Pill, priorityTone } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  KANBAN_COLUMNS,
  TASK_STATUS_LABEL,
  PRIORITY_LABEL,
  type TaskStatus,
  labelOf,
} from "@/lib/domain";
import { formatDate, daysUntil, formatHours } from "@/lib/format";
import { NewTaskDialog } from "@/components/NewTaskDialog";

export type TaskRow = {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  estimatedHours: number | null;
  actualHours: number;
  assigneeId: string | null;
  assigneeName: string | null;
  projectId: string;
  projectCode: string;
  projectName: string;
};

type View = "kanban" | "lista" | "moje";

const VIEW_LABEL: Record<View, string> = {
  kanban: "Kanban",
  lista: "Lista",
  moje: "Moje zadania",
};

export function TasksView({
  tasks,
  projects,
  assignees,
  currentUserId,
  initialView,
  initialProjectId,
}: {
  tasks: TaskRow[];
  projects: { id: string; code: string; name: string }[];
  assignees: { id: string; fullName: string }[];
  currentUserId: string;
  initialView: View;
  initialProjectId: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [rows, setRows] = useState(tasks);

  // `router.refresh()` przerysowuje komponent serwerowy, ale React zachowuje stan
  // kliencki — bez tej synchronizacji nowo utworzone zadanie bylo niewidoczne
  // az do pelnego przeladowania strony.
  useEffect(() => setRows(tasks), [tasks]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    let out = rows;
    if (projectId) out = out.filter((t) => t.projectId === projectId);
    if (view === "moje") out = out.filter((t) => t.assigneeId === currentUserId);
    return out;
  }, [rows, projectId, view, currentUserId]);

  /** Zmiana statusu wprost na tablicy — optymistycznie, z cofnieciem przy odmowie. */
  async function moveTask(taskId: string, status: TaskStatus) {
    const before = rows;
    setRows((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    setError(null);

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setRows(before);
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Nie udało się zmienić statusu zadania.");
      return;
    }
    router.refresh();
  }

  const selectClass =
    "rounded-lg border border-border bg-surface px-3 py-1.5 text-[13px] text-ink outline-none focus:border-accent";

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-accent">
            Praca projektowa
          </p>
          <h1 className="mt-1 font-display text-[28px] font-black tracking-tight text-ink">
            Zadania
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            {visible.length} {visible.length === 1 ? "zadanie" : "zadań"} w tym widoku
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          disabled={projects.length === 0}
          className="rounded-lg bg-accent-deep px-4 py-2 text-[13.5px] font-bold text-white hover:opacity-90 disabled:opacity-40"
        >
          Nowe zadanie
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex rounded-lg border border-border bg-surface p-0.5">
          {(Object.keys(VIEW_LABEL) as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-[6px] px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                view === v ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"
              }`}
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>

        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className={selectClass}
        >
          <option value="">Wszystkie projekty</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} · {p.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[13px] text-crit">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <EmptyState
          title="Brak zadań w tym widoku"
          hint={view === "moje" ? "Nic nie jest przypisane do Ciebie." : "Zmień filtr projektu."}
        />
      ) : view === "kanban" ? (
        <KanbanBoard tasks={visible} onMove={moveTask} />
      ) : (
        <TaskList tasks={visible} />
      )}

      {dialogOpen && (
        <NewTaskDialog
          projects={projects}
          assignees={assignees}
          defaultProjectId={projectId || projects[0]?.id || ""}
          onClose={() => setDialogOpen(false)}
          onCreated={() => {
            setDialogOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function KanbanBoard({
  tasks,
  onMove,
}: {
  tasks: TaskRow[];
  onMove: (id: string, status: TaskStatus) => void;
}) {
  return (
    <div className="grid gap-3 overflow-x-auto md:grid-cols-3 xl:grid-cols-5">
      {KANBAN_COLUMNS.map((column) => {
        const columnTasks = tasks.filter((t) => t.status === column);
        return (
          <div key={column} className="min-w-[220px]">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted">
                {TASK_STATUS_LABEL[column]}
              </span>
              <span className="font-mono text-[10.5px] text-muted">{columnTasks.length}</span>
            </div>
            <div className="space-y-2">
              {columnTasks.map((task) => (
                <TaskCard key={task.id} task={task} onMove={onMove} />
              ))}
              {columnTasks.length === 0 && (
                <div className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-[12px] text-muted">
                  pusto
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskCard({
  task,
  onMove,
}: {
  task: TaskRow;
  onMove: (id: string, status: TaskStatus) => void;
}) {
  const days = daysUntil(task.dueDate);
  const overdue = days !== null && days < 0 && task.status !== "DONE";

  return (
    <div className="rounded-xl border border-border bg-surface p-3 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/projects/${task.projectId}`}
          className="font-mono text-[10px] text-accent hover:underline"
        >
          {task.projectCode}
        </Link>
        <Pill tone={priorityTone(task.priority)}>{labelOf(PRIORITY_LABEL, task.priority)}</Pill>
      </div>
      <Link
        href={`/tasks/${task.id}`}
        className="mt-1.5 block text-[13px] font-medium leading-snug text-ink hover:text-accent"
      >
        {task.title}
      </Link>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
        <span className="truncate text-muted">{task.assigneeName ?? "nieprzypisane"}</span>
        <span className={`shrink-0 font-mono ${overdue ? "text-crit" : "text-muted"}`}>
          {task.dueDate ? formatDate(task.dueDate) : "—"}
        </span>
      </div>
      <select
        value={task.status}
        onChange={(e) => onMove(task.id, e.target.value as TaskStatus)}
        aria-label={`Zmień status zadania ${task.code}`}
        className="mt-2.5 w-full rounded-lg border border-border bg-bg px-2 py-1 text-[11.5px] text-ink-soft outline-none focus:border-accent"
      >
        {KANBAN_COLUMNS.map((s) => (
          <option key={s} value={s}>
            {TASK_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </div>
  );
}

function TaskList({ tasks }: { tasks: TaskRow[] }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-[13px]">
        <thead>
          <tr className="border-b border-border bg-surface-2 text-left font-mono text-[10.5px] uppercase tracking-wider text-muted">
            <th className="px-4 py-3">Kod</th>
            <th className="px-4 py-3">Zadanie</th>
            <th className="px-4 py-3">Projekt</th>
            <th className="px-4 py-3">Wykonawca</th>
            <th className="px-4 py-3">Priorytet</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Godziny</th>
            <th className="px-4 py-3">Termin</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const days = daysUntil(task.dueDate);
            const overdue = days !== null && days < 0 && task.status !== "DONE";
            return (
              <tr key={task.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                <td className="px-4 py-2.5 font-mono text-[11px] text-muted">
                  <Link href={`/tasks/${task.id}`} className="hover:text-accent">
                    {task.code}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <Link href={`/tasks/${task.id}`} className="text-ink hover:text-accent">
                    {task.title}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <Link href={`/projects/${task.projectId}`} className="text-accent">
                    {task.projectCode}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-ink-soft">{task.assigneeName ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <Pill tone={priorityTone(task.priority)}>
                    {labelOf(PRIORITY_LABEL, task.priority)}
                  </Pill>
                </td>
                <td className="px-4 py-2.5 text-ink-soft">
                  {labelOf(TASK_STATUS_LABEL, task.status)}
                </td>
                <td className="px-4 py-2.5 font-mono text-[11.5px] text-ink-soft">
                  {formatHours(task.actualHours)}
                  {task.estimatedHours ? ` / ${formatHours(task.estimatedHours)}` : ""}
                </td>
                <td
                  className={`px-4 py-2.5 font-mono text-[11.5px] ${
                    overdue ? "text-crit" : "text-muted"
                  }`}
                >
                  {formatDate(task.dueDate)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
