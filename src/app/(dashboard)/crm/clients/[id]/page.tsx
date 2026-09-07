import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/server/session";
import { canSeeFinancials } from "@/lib/rbac";
import { Card, CardHeader, StatTile, RedactedValue } from "@/components/ui/Card";
import { Pill, ragTone } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClientContacts } from "@/components/crm/ClientContacts";
import { MeetingNotes } from "@/components/projects/MeetingNotes";
import {
  CLIENT_SEGMENT_LABEL,
  CLIENT_STATUS_LABEL,
  OPPORTUNITY_STAGE_LABEL,
  PHASE_LABEL,
  PROJECT_STATUS_LABEL,
  labelOf,
} from "@/lib/domain";
import { formatMoney, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("crm");
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { fullName: "asc" }] },
      projects: { orderBy: { createdAt: "desc" } },
      opportunities: {
        include: { owner: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
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
    },
  });
  if (!client) notFound();

  const [teamMembers, openProjects] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.project.findMany({
      where: { status: { not: "CLOSED" } },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const showMoney = canSeeFinancials(user.role);
  const activeProjects = client.projects.filter((p) => p.status !== "CLOSED").length;
  const openOpportunities = client.opportunities.filter((o) => o.status === "OPEN");
  // Wartosc dotychczasowej wspolpracy — suma umow wszystkich projektow klienta.
  const lifetimeValue = client.projects.reduce((sum, p) => sum + (p.contractValue ?? 0), 0);
  const pipelineValue = openOpportunities.reduce((sum, o) => sum + (o.value ?? 0), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <Pill tone="accent">{labelOf(CLIENT_STATUS_LABEL, client.status)}</Pill>
            <Pill>{labelOf(CLIENT_SEGMENT_LABEL, client.segment)}</Pill>
            {client.nip && (
              <span className="font-mono text-[11px] text-muted">NIP {client.nip}</span>
            )}
          </div>
          <h1 className="mt-2 font-display text-[28px] font-black leading-tight tracking-tight text-ink">
            {client.name}
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            {[client.industry, client.city].filter(Boolean).join(" · ") || "Brak danych branżowych"}
            {" · ostatni kontakt "}
            {formatDate(client.lastContactAt)}
          </p>
        </div>
        <Link
          href="/crm"
          className="rounded-lg border border-border px-3.5 py-1.5 text-[13px] font-semibold text-ink-soft hover:bg-surface-2"
        >
          ← CRM
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatTile label="Projekty" value={String(client.projects.length)} hint={`${activeProjects} aktywnych`} />
        <StatTile label="Otwarte szanse" value={String(openOpportunities.length)} tone="accent" />
        <StatTile
          label="Wartość współpracy"
          hint="suma umów"
          value={showMoney ? (formatMoney(lifetimeValue) ?? "—") : <RedactedValue />}
        />
        <StatTile
          label="Pipeline"
          hint="otwarte szanse"
          tone="accent"
          value={showMoney ? (formatMoney(pipelineValue) ?? "—") : <RedactedValue />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <ClientContacts clientId={client.id} contacts={client.contacts} />

        <Card>
          <CardHeader
            title="Szanse sprzedażowe"
            subtitle="Pipeline tego klienta"
            action={
              <Link href="/crm?zakladka=pipeline" className="text-[12.5px] font-semibold text-accent">
                Cały pipeline →
              </Link>
            }
          />
          <div className="p-3">
            {client.opportunities.length === 0 ? (
              <EmptyState title="Brak szans sprzedażowych" />
            ) : (
              <ul className="space-y-1">
                {client.opportunities.map((o) => (
                  <li key={o.id} className="rounded-xl px-2.5 py-2 hover:bg-surface-2">
                    <div className="flex items-center gap-2.5">
                      <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                        {o.title}
                      </span>
                      <Pill
                        tone={o.status === "WON" ? "good" : o.status === "LOST" ? "crit" : "accent"}
                      >
                        {o.status === "WON" ? "Wygrana" : o.status === "LOST" ? "Przegrana" : "Otwarta"}
                      </Pill>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between text-[11.5px] text-muted">
                      <span>{labelOf(OPPORTUNITY_STAGE_LABEL, o.stage)}</span>
                      <span className="font-mono">
                        {showMoney ? (formatMoney(o.value) ?? "—") : "——"} · {o.probability}%
                      </span>
                    </div>
                    {o.convertedProjectId && (
                      <Link
                        href={`/projects/${o.convertedProjectId}`}
                        className="mt-0.5 inline-block font-mono text-[11px] text-accent"
                      >
                        → przekonwertowana w projekt
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {/* Notatka klienta nie ma projektu, wiec konwersja punktu pyta, do ktorego trafi */}
      <MeetingNotes
        clientId={client.id}
        teamMembers={teamMembers}
        projects={openProjects}
        notes={client.meetingNotes.map((n) => ({
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

      <Card>
        <CardHeader
          title="Historia projektów"
          subtitle="Jeden klient, wiele projektów w czasie — pełna historia w jednym miejscu"
        />
        <div className="overflow-x-auto">
          {client.projects.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Brak projektów"
                hint="Projekt powstanie z konwersji szansy sprzedażowej."
              />
            </div>
          ) : (
            <table className="w-full min-w-[720px] text-[13px]">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left font-mono text-[10.5px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-2.5">Kod</th>
                  <th className="px-4 py-2.5">Projekt</th>
                  <th className="px-4 py-2.5">Faza</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">RAG</th>
                  <th className="px-4 py-2.5">Okres</th>
                  <th className="px-4 py-2.5 text-right">Wartość</th>
                </tr>
              </thead>
              <tbody>
                {client.projects.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                    <td className="px-4 py-2.5 font-mono text-[11.5px] text-accent">
                      <Link href={`/projects/${p.id}`}>{p.code}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-ink">
                      <Link href={`/projects/${p.id}`}>{p.name}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">{labelOf(PHASE_LABEL, p.phase)}</td>
                    <td className="px-4 py-2.5 text-ink-soft">
                      {labelOf(PROJECT_STATUS_LABEL, p.status)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Pill tone={ragTone(p.ragStatus)} dot>
                        {p.ragStatus}
                      </Pill>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-muted">
                      {formatDate(p.startDate)} → {formatDate(p.endDate)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] text-ink">
                      {showMoney ? (formatMoney(p.contractValue) ?? "—") : <RedactedValue />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
