import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/server/session";
import { canReadAllProjects, canSeeFinancials, canWriteProject, isAdmin } from "@/lib/rbac";
import { Card, CardHeader, StatTile, RedactedValue } from "@/components/ui/Card";
import { Pill, ragTone, priorityTone } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProjectChecklist } from "@/components/ProjectChecklist";
import { EditProjectButton } from "@/components/projects/EditProjectButton";
import { Milestones } from "@/components/projects/Milestones";
import { Risks } from "@/components/projects/Risks";
import { ProjectStages } from "@/components/projects/ProjectStages";
import { ProjectTeam } from "@/components/projects/ProjectTeam";
import { MeetingNotes } from "@/components/projects/MeetingNotes";
import { StatusReports } from "@/components/projects/StatusReports";
import {
  PHASE_LABEL,
  PROJECT_STATUS_LABEL,
  BILLING_MODEL_LABEL,
  BILLING_PERIOD_LABEL,
  SERVICE_TYPE_LABEL,
  TASK_STATUS_LABEL,
  PRIORITY_LABEL,
  labelOf,
} from "@/lib/domain";
import { formatMoney, formatDate, formatHours } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("projects");
  const { id } = await params;

  // Konsultant widzi projekt tylko jako opiekun albo wykonawca zadania (spec 06).
  const scope = canReadAllProjects(user.role)
    ? { id }
    : {
        id,
        OR: [{ ownerId: user.id }, { tasks: { some: { assigneeId: user.id } } }],
      };

  const project = await prisma.project.findFirst({
    where: scope,
    include: {
      client: { select: { id: true, name: true, industry: true } },
      owner: { select: { id: true, fullName: true } },
      stages: { orderBy: { startDate: "asc" } },
      tasks: {
        include: { assignee: { select: { fullName: true } }, expert: { select: { fullName: true } } },
        orderBy: [{ dueDate: "asc" }],
      },
      checklist: { orderBy: [{ position: "asc" }] },
      risks: {
        include: { owner: { select: { id: true, fullName: true } } },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      },
      milestones: { orderBy: { dueDate: "asc" } },
      experts: { include: { expert: { select: { fullName: true, specialty: true } } } },
      members: {
        include: { user: { select: { id: true, fullName: true, position: true } } },
        orderBy: { joinedAt: "asc" },
      },
      meetingNotes: {
        include: {
          author: { select: { fullName: true } },
          items: {
            orderBy: { position: "asc" },
            include: { task: { select: { id: true, code: true } } },
          },
        },
        orderBy: { meetingDate: "desc" },
      },
      statusReports: {
        include: { author: { select: { fullName: true } } },
        orderBy: { reportDate: "desc" },
      },
    },
  });

  if (!project) notFound();

  const [teamMembers, allClients] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const mayEdit = canWriteProject(user.role, user.id, project);

  const showMoney = canSeeFinancials(user.role);
  const doneTasks = project.tasks.filter((t) => t.status === "DONE").length;
  const totalHours = project.tasks.reduce((sum, t) => sum + t.actualHours, 0);
  const estimatedHours = project.tasks.reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0);
  const openRisks = project.risks.filter((r) => r.status === "OPEN").length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-[11.5px] text-accent">{project.code}</span>
            <Pill tone={ragTone(project.ragStatus)} dot>
              {project.ragStatus}
            </Pill>
            <Pill tone="accent">{labelOf(PHASE_LABEL, project.phase)}</Pill>
            <Pill>{labelOf(PROJECT_STATUS_LABEL, project.status)}</Pill>
          </div>
          <h1 className="mt-2 font-display text-[28px] font-black leading-tight tracking-tight text-ink">
            {project.name}
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            {project.client.name}
            {project.client.industry ? ` · ${project.client.industry}` : ""} ·{" "}
            {labelOf(SERVICE_TYPE_LABEL, project.serviceType)} ·{" "}
            {labelOf(BILLING_MODEL_LABEL, project.billingModel)} · opiekun:{" "}
            {project.owner?.fullName ?? "nieprzypisany"}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          {mayEdit && (
            <EditProjectButton
              canDelete={isAdmin(user.role)}
              showFinancials={showMoney}
              clients={allClients}
              owners={teamMembers}
              project={{
                id: project.id,
                name: project.name,
                clientId: project.clientId,
                serviceType: project.serviceType,
                ownerId: project.ownerId,
                phase: project.phase,
                status: project.status,
                description: project.description,
                startDate: project.startDate?.toISOString() ?? null,
                endDate: project.endDate?.toISOString() ?? null,
                budget: project.budget,
                contractValue: project.contractValue,
                quotedValue: project.quotedValue,
                billingModel: project.billingModel,
                billingPeriod: project.billingPeriod,
                recurringAmount: project.recurringAmount,
                billingStartDate: project.billingStartDate?.toISOString() ?? null,
                billingEndDate: project.billingEndDate?.toISOString() ?? null,
                noticePeriodDays: project.noticePeriodDays,
              }}
            />
          )}
          <Link
            href="/projects"
            className="rounded-lg border border-border px-3.5 py-1.5 text-[13px] font-semibold text-ink-soft hover:bg-surface-2"
          >
            ← Projekty
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatTile
          label="Zadania"
          value={`${doneTasks}/${project.tasks.length}`}
          hint="zrobione / wszystkie"
        />
        <StatTile
          label="Godziny"
          value={formatHours(totalHours)}
          hint={estimatedHours > 0 ? `szacowane ${formatHours(estimatedHours)}` : "bez szacunku"}
          tone={estimatedHours > 0 && totalHours > estimatedHours ? "warn" : "ink"}
        />
        <StatTile
          label="Otwarte ryzyka"
          value={String(openRisks)}
          tone={openRisks > 0 ? "warn" : "good"}
        />
        {project.billingModel === "ABONAMENT" ? (
          <StatTile
            label="Abonament"
            tone="accent"
            value={
              showMoney ? (
                project.recurringAmount !== null ? (
                  `${formatMoney(project.recurringAmount)} / ${labelOf(BILLING_PERIOD_LABEL, project.billingPeriod ?? "").toLowerCase()}`
                ) : (
                  "—"
                )
              ) : (
                <RedactedValue />
              )
            }
            hint={
              project.billingEndDate
                ? `do ${formatDate(project.billingEndDate)}`
                : "czas nieokreślony — do wypowiedzenia"
            }
          />
        ) : (
          <StatTile
            label="Wartość umowy"
            tone="accent"
            value={showMoney ? (formatMoney(project.contractValue) ?? "—") : <RedactedValue />}
            hint={
              showMoney
                ? `budżet ${formatMoney(project.budget) ?? "—"}`
                : "pole zredagowane dla Twojej roli"
            }
          />
        )}
      </div>

      {project.description && (
        <Card>
          <CardHeader title="Zakres" />
          <p className="whitespace-pre-wrap px-5 py-4 text-[13.5px] text-ink-soft">
            {project.description}
          </p>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Zadania"
            subtitle={`${project.tasks.length} pozycji`}
            action={
              <Link
                href={`/tasks?projekt=${project.id}`}
                className="text-[12.5px] font-semibold text-accent"
              >
                Tablica →
              </Link>
            }
          />
          <div className="p-3">
            {project.tasks.length === 0 ? (
              <EmptyState title="Brak zadań" hint="Dodaj pierwsze zadanie na tablicy." />
            ) : (
              <ul className="space-y-1">
                {project.tasks.slice(0, 12).map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-surface-2"
                  >
                    <span className="font-mono text-[10.5px] text-muted">{task.code}</span>
                    <Link
                      href={`/tasks/${task.id}`}
                      className="min-w-0 flex-1 truncate text-[13.5px] text-ink hover:text-accent"
                    >
                      {task.title}
                    </Link>
                    <span className="shrink-0 text-[11.5px] text-muted">
                      {task.assignee?.fullName ?? task.expert?.fullName ?? "nieprzypisane"}
                    </span>
                    <Pill tone={priorityTone(task.priority)}>
                      {labelOf(PRIORITY_LABEL, task.priority)}
                    </Pill>
                    <span className="w-[92px] shrink-0 text-right font-mono text-[10.5px] text-muted">
                      {labelOf(TASK_STATUS_LABEL, task.status)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Checklista instancjonowana automatycznie z szablonu typu uslugi (spec 03) */}
        <ProjectChecklist items={project.checklist} />
      </div>

      <ProjectTeam
        projectId={project.id}
        canEdit={mayEdit}
        candidates={teamMembers}
        members={project.members.map((m) => ({
          id: m.id,
          userId: m.user.id,
          fullName: m.user.fullName,
          position: m.user.position,
          role: m.role,
          allocation: m.allocation,
          // Ile otwartych zadań ma ta osoba w tym projekcie — sygnał obciążenia.
          openTasks: project.tasks.filter(
            (t) => t.assigneeId === m.user.id && t.status !== "DONE",
          ).length,
        }))}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Milestones
          projectId={project.id}
          canEdit={mayEdit}
          milestones={project.milestones.map((m) => ({
            id: m.id,
            name: m.name,
            description: m.description,
            phase: m.phase,
            dueDate: m.dueDate.toISOString(),
            completedAt: m.completedAt?.toISOString() ?? null,
          }))}
        />

        <Risks
          projectId={project.id}
          canEdit={mayEdit}
          owners={teamMembers}
          risks={project.risks.map((r) => ({
            id: r.id,
            title: r.title,
            kind: r.kind,
            description: r.description,
            impact: r.impact,
            probability: r.probability,
            mitigation: r.mitigation,
            status: r.status,
            ownerId: r.ownerId,
            ownerName: r.owner?.fullName ?? null,
            dueDate: r.dueDate?.toISOString() ?? null,
          }))}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <MeetingNotes
          projectId={project.id}
          teamMembers={teamMembers}
          notes={project.meetingNotes.map((n) => ({
            id: n.id,
            title: n.title,
            meetingDate: n.meetingDate.toISOString(),
            content: n.content,
            attendees: n.attendees,
            authorName: n.author?.fullName ?? "—",
            items: n.items.map((i) => ({
              id: i.id,
              content: i.content,
              taskId: i.task?.id ?? null,
              taskCode: i.task?.code ?? null,
            })),
          }))}
        />

        <StatusReports
          projectId={project.id}
          currentRag={project.ragStatus}
          canWrite={canWriteProject(user.role, user.id, project)}
          reports={project.statusReports.map((r) => ({
            id: r.id,
            reportDate: r.reportDate.toISOString(),
            ragStatus: r.ragStatus,
            summary: r.summary,
            budgetNote: r.budgetNote,
            authorName: r.author?.fullName ?? "—",
          }))}
        />
      </div>

      <ProjectStages
        projectId={project.id}
        canEdit={mayEdit}
        stages={project.stages.map((st) => ({
          id: st.id,
          name: st.name,
          phase: st.phase,
          startDate: st.startDate.toISOString(),
          endDate: st.endDate.toISOString(),
          progress: st.progress,
        }))}
      />
    </div>
  );
}
