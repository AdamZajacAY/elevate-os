import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/server/session";
import { canReadAllProjects } from "@/lib/rbac";
import { Card, CardHeader, StatTile } from "@/components/ui/Card";
import { Pill, priorityTone } from "@/components/ui/Pill";
import { TaskComments } from "@/components/tasks/TaskComments";
import { TimeLogger } from "@/components/tasks/TimeLogger";
import {
  TASK_STATUS_LABEL,
  PRIORITY_LABEL,
  PHASE_LABEL,
  labelOf,
} from "@/lib/domain";
import { formatDate, formatHours, daysUntil } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule("tasks");
  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      project: {
        select: { id: true, code: true, name: true, phase: true, ownerId: true },
      },
      stage: { select: { id: true, name: true } },
      assignee: { select: { id: true, fullName: true } },
      expert: { select: { id: true, fullName: true, specialty: true } },
      comments: {
        include: { author: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "asc" },
      },
      timeLogs: {
        include: { user: { select: { fullName: true } } },
        orderBy: { workDate: "desc" },
      },
    },
  });
  if (!task) notFound();

  // Konsultant widzi zadanie jako wykonawca albo opiekun projektu (spec 06).
  const mayView =
    canReadAllProjects(user.role) ||
    task.assigneeId === user.id ||
    task.project.ownerId === user.id;
  if (!mayView) notFound();

  const [teamMembers, statusLabel] = [
    await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    labelOf(TASK_STATUS_LABEL, task.status),
  ];

  const days = daysUntil(task.dueDate);
  const overdue = days !== null && days < 0 && task.status !== "DONE";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-[11.5px] text-accent">{task.code}</span>
            <Pill tone={task.status === "DONE" ? "good" : "accent"}>{statusLabel}</Pill>
            <Pill tone={priorityTone(task.priority)}>
              {labelOf(PRIORITY_LABEL, task.priority)}
            </Pill>
            {overdue && <Pill tone="crit">po terminie</Pill>}
          </div>
          <h1 className="mt-2 font-display text-[26px] font-black leading-tight tracking-tight text-ink">
            {task.title}
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            <Link href={`/projects/${task.project.id}`} className="text-accent hover:underline">
              {task.project.code} · {task.project.name}
            </Link>
            {" · "}
            {labelOf(PHASE_LABEL, task.project.phase)}
            {task.stage ? ` · etap: ${task.stage.name}` : ""}
          </p>
        </div>
        <Link
          href="/tasks"
          className="rounded-lg border border-border px-3.5 py-1.5 text-[13px] font-semibold text-ink-soft hover:bg-surface-2"
        >
          ← Zadania
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatTile
          label="Wykonawca"
          value={task.assignee?.fullName ?? task.expert?.fullName ?? "nieprzypisane"}
          hint={task.expert ? `ekspert · ${task.expert.specialty}` : undefined}
        />
        <StatTile
          label="Termin"
          value={formatDate(task.dueDate)}
          hint={days === null ? undefined : days < 0 ? `${-days} dni po terminie` : `za ${days} dni`}
          tone={overdue ? "crit" : days !== null && days <= 3 ? "warn" : "ink"}
        />
        <StatTile
          label="Godziny"
          value={formatHours(task.actualHours)}
          hint={task.estimatedHours ? `szacowane ${formatHours(task.estimatedHours)}` : "bez szacunku"}
          tone={
            task.estimatedHours && task.actualHours > task.estimatedHours ? "warn" : "ink"
          }
        />
        <StatTile label="Komentarze" value={String(task.comments.length)} />
      </div>

      {task.description && (
        <Card>
          <CardHeader title="Opis" />
          <p className="whitespace-pre-wrap px-5 py-4 text-[13.5px] text-ink-soft">
            {task.description}
          </p>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <TaskComments
          taskId={task.id}
          currentUserId={user.id}
          isAdmin={user.role === "ADMIN"}
          teamMembers={teamMembers}
          comments={task.comments.map((c) => ({
            id: c.id,
            body: c.body,
            authorId: c.author.id,
            authorName: c.author.fullName,
            createdAt: c.createdAt.toISOString(),
          }))}
        />

        <div className="space-y-5">
          <TimeLogger taskId={task.id} projectId={task.project.id} />

          <Card>
            <CardHeader
              title="Wpisy czasu"
              subtitle={`${task.timeLogs.length} ${task.timeLogs.length === 1 ? "wpis" : "wpisów"}`}
            />
            <div className="p-3">
              {task.timeLogs.length === 0 ? (
                <p className="px-2.5 py-3 text-[13px] text-muted">
                  Brak zarejestrowanych godzin na tym zadaniu.
                </p>
              ) : (
                <ul className="space-y-1">
                  {task.timeLogs.map((log) => (
                    <li
                      key={log.id}
                      className="flex items-center gap-3 rounded-xl px-2.5 py-1.5 text-[12.5px]"
                    >
                      <span className="font-mono text-[11px] text-muted">
                        {formatDate(log.workDate)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ink-soft">
                        {log.user.fullName}
                        {log.note ? ` — ${log.note}` : ""}
                      </span>
                      <span className="shrink-0 font-mono text-ink">{formatHours(log.hours)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
