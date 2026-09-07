import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/domain";
import { projectScopeWhere } from "@/lib/rbac";

/**
 * Kalendarz (spec 09) — "spotkania z klientem i kamienie milowe widoczne poza
 * narzędziem, wydarzenia synchronizowane jednokierunkowo".
 *
 * Realizacja: feed iCal (RFC 5545). Kalendarz klienta subskrybuje adres i sam
 * odpytuje o zmiany — synchronizacja idzie wyłącznie z ELEVATE na zewnątrz,
 * nic nie wraca. Zakres wydarzeń jest zawężony do widoczności roli.
 */

/** Escapowanie wg RFC 5545 — przecinek, średnik, odwrotny ukośnik i nowa linia. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Data w formacie UTC bez separatorów: 20260907T104500Z */
function toIcsDateTime(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

/** Data całodniowa: 20260907 */
function toIcsDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

/** Linie dłuższe niż 75 oktetów muszą być łamane spacją kontynuacji. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    chunks.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest) chunks.push(` ${rest}`);
  return chunks.join("\r\n");
}

export async function buildCalendar(userId: string, role: Role): Promise<string> {
  const scope = projectScopeWhere(role, userId);
  const now = new Date();

  const [milestones, meetings, deadlines] = await Promise.all([
    prisma.milestone.findMany({
      where: { project: scope },
      include: { project: { select: { code: true, name: true } } },
    }),
    prisma.meetingNote.findMany({
      where: { OR: [{ project: scope }, { projectId: null }] },
      include: {
        project: { select: { code: true, name: true } },
        client: { select: { name: true } },
      },
    }),
    // Terminy projektow — jeden wpis calodniowy na projekt z data konca.
    prisma.project.findMany({
      where: { ...scope, status: { not: "CLOSED" }, endDate: { not: null } },
      select: { id: true, code: true, name: true, endDate: true },
    }),
  ]);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AdviseYou//ELEVATE OS//PL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:ELEVATE OS",
    "X-WR-TIMEZONE:Europe/Warsaw",
  ];

  function pushEvent(params: {
    uid: string;
    date: Date;
    summary: string;
    description: string;
    allDay: boolean;
  }) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${params.uid}@elevate.adviseyou.pl`);
    lines.push(`DTSTAMP:${toIcsDateTime(now)}`);
    if (params.allDay) {
      const next = new Date(params.date.getTime() + 86_400_000);
      lines.push(`DTSTART;VALUE=DATE:${toIcsDate(params.date)}`);
      lines.push(`DTEND;VALUE=DATE:${toIcsDate(next)}`);
    } else {
      const end = new Date(params.date.getTime() + 3_600_000);
      lines.push(`DTSTART:${toIcsDateTime(params.date)}`);
      lines.push(`DTEND:${toIcsDateTime(end)}`);
    }
    lines.push(fold(`SUMMARY:${escapeText(params.summary)}`));
    lines.push(fold(`DESCRIPTION:${escapeText(params.description)}`));
    lines.push("END:VEVENT");
  }

  for (const m of milestones) {
    pushEvent({
      uid: `milestone-${m.id}`,
      date: m.dueDate,
      allDay: true,
      summary: `${m.completedAt ? "✓ " : ""}Kamień milowy: ${m.name}`,
      description: `${m.project.code} — ${m.project.name}${m.description ? `\n${m.description}` : ""}`,
    });
  }

  for (const note of meetings) {
    const context = note.project
      ? `${note.project.code} — ${note.project.name}`
      : (note.client?.name ?? "spotkanie");
    pushEvent({
      uid: `meeting-${note.id}`,
      date: note.meetingDate,
      allDay: false,
      summary: `Spotkanie: ${note.title}`,
      description: [context, note.attendees ? `Uczestnicy: ${note.attendees}` : null, note.content]
        .filter(Boolean)
        .join("\n"),
    });
  }

  for (const project of deadlines) {
    pushEvent({
      uid: `deadline-${project.id}`,
      date: project.endDate!,
      allDay: true,
      summary: `Termin projektu: ${project.code}`,
      description: project.name,
    });
  }

  lines.push("END:VCALENDAR");
  // RFC 5545 wymaga CRLF.
  return lines.join("\r\n");
}
