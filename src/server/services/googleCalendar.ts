import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/domain";
import { projectScopeWhere } from "@/lib/rbac";
import { getValidAccessToken } from "@/server/services/googleOAuth";

/**
 * Synchronizacja z Google Calendar (spec 09) — jednokierunkowa: ELEVATE OS
 * wypycha wydarzenia, nic nie wraca. Zmiany zrobione w Google zostaną nadpisane
 * przy kolejnej synchronizacji.
 *
 * Wydarzenia lądują w **osobnym kalendarzu** „ELEVATE OS", zakładanym w koncie
 * użytkownika — nie mieszamy terminów projektowych z jego kalendarzem prywatnym,
 * a odłączenie integracji da się zrobić jednym usunięciem kalendarza po stronie Google.
 */

const API = "https://www.googleapis.com/calendar/v3";
const CALENDAR_NAME = "ELEVATE OS";

export type SyncResult = {
  created: number;
  updated: number;
  total: number;
  calendarId: string;
};

async function googleFetch(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

/**
 * Identyfikator wydarzenia budowany deterministycznie z id encji.
 * Google wymaga znaków a–v i 0–9, długość 5–1024 — cuid tego nie spełnia,
 * więc bierzemy skrót heksadecymalny przemapowany na dozwolony alfabet.
 */
function eventId(kind: string, entityId: string): string {
  const digest = createHash("sha1").update(`${kind}:${entityId}`).digest("hex");
  // hex ma 0-9a-f, a Google dopuszcza 0-9a-v — hex mieści się w całości.
  return `elevate${digest}`;
}

/** Znajduje kalendarz „ELEVATE OS" albo zakłada nowy. */
async function ensureCalendar(userId: string, accessToken: string): Promise<string> {
  const link = await prisma.googleCalendarLink.findUnique({ where: { userId } });

  if (link?.calendarId) {
    // Kalendarz mogl zostac skasowany po stronie Google — wtedy zakladamy nowy.
    const check = await googleFetch(accessToken, `/calendars/${encodeURIComponent(link.calendarId)}`);
    if (check.ok) return link.calendarId;
  }

  const res = await googleFetch(accessToken, "/calendars", {
    method: "POST",
    body: JSON.stringify({
      summary: CALENDAR_NAME,
      description: "Kamienie milowe, spotkania i terminy projektów z ELEVATE OS (AdviseYou).",
      timeZone: "Europe/Warsaw",
    }),
  });

  if (!res.ok) {
    throw new Error(`Nie udało się utworzyć kalendarza (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }

  const created = (await res.json()) as { id: string };
  await prisma.googleCalendarLink.update({
    where: { userId },
    data: { calendarId: created.id },
  });
  return created.id;
}

type PlannedEvent = {
  id: string;
  summary: string;
  description: string;
  date: Date;
  allDay: boolean;
};

/** Wydarzenia do wypchnięcia — ten sam zakres widoczności co feed iCal. */
async function collectEvents(userId: string, role: Role): Promise<PlannedEvent[]> {
  const scope = projectScopeWhere(role, userId);

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
    prisma.project.findMany({
      where: { ...scope, status: { not: "CLOSED" }, endDate: { not: null } },
      select: { id: true, code: true, name: true, endDate: true },
    }),
  ]);

  const events: PlannedEvent[] = [];

  for (const m of milestones) {
    events.push({
      id: eventId("milestone", m.id),
      summary: `${m.completedAt ? "✓ " : ""}Kamień milowy: ${m.name}`,
      description: `${m.project.code} — ${m.project.name}${m.description ? `\n${m.description}` : ""}`,
      date: m.dueDate,
      allDay: true,
    });
  }

  for (const note of meetings) {
    const context = note.project
      ? `${note.project.code} — ${note.project.name}`
      : (note.client?.name ?? "spotkanie");
    events.push({
      id: eventId("meeting", note.id),
      summary: `Spotkanie: ${note.title}`,
      description: [context, note.attendees ? `Uczestnicy: ${note.attendees}` : null, note.content]
        .filter(Boolean)
        .join("\n"),
      date: note.meetingDate,
      allDay: false,
    });
  }

  for (const project of deadlines) {
    events.push({
      id: eventId("deadline", project.id),
      summary: `Termin projektu: ${project.code}`,
      description: project.name,
      date: project.endDate!,
      allDay: true,
    });
  }

  return events;
}

function toGoogleEvent(event: PlannedEvent) {
  const timing = event.allDay
    ? {
        start: { date: event.date.toISOString().slice(0, 10) },
        end: { date: new Date(event.date.getTime() + 86_400_000).toISOString().slice(0, 10) },
      }
    : {
        start: { dateTime: event.date.toISOString(), timeZone: "Europe/Warsaw" },
        end: {
          dateTime: new Date(event.date.getTime() + 3_600_000).toISOString(),
          timeZone: "Europe/Warsaw",
        },
      };

  return {
    id: event.id,
    summary: event.summary,
    description: event.description,
    source: { title: "ELEVATE OS", url: process.env.AUTH_URL ?? "http://localhost:3002" },
    ...timing,
  };
}

/**
 * Wypycha wydarzenia do kalendarza użytkownika.
 * Najpierw próbuje wstawić (`insert`); konflikt `409` znaczy, że wydarzenie już
 * istnieje — wtedy je aktualizuje. Dzięki deterministycznym id ponowna
 * synchronizacja nigdy nie duplikuje wpisów.
 */
export async function syncToGoogleCalendar(userId: string, role: Role): Promise<SyncResult> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    throw new Error("Brak ważnego połączenia z Google — połącz konto ponownie");
  }

  const calendarId = await ensureCalendar(userId, accessToken);
  const events = await collectEvents(userId, role);

  let created = 0;
  let updated = 0;

  for (const event of events) {
    const body = JSON.stringify(toGoogleEvent(event));
    const insert = await googleFetch(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      { method: "POST", body },
    );

    if (insert.ok) {
      created += 1;
      continue;
    }

    if (insert.status === 409) {
      const update = await googleFetch(
        accessToken,
        `/calendars/${encodeURIComponent(calendarId)}/events/${event.id}`,
        { method: "PUT", body },
      );
      if (update.ok) {
        updated += 1;
        continue;
      }
      throw new Error(
        `Aktualizacja wydarzenia nieudana (${update.status}): ${(await update.text()).slice(0, 160)}`,
      );
    }

    throw new Error(
      `Zapis wydarzenia nieudany (${insert.status}): ${(await insert.text()).slice(0, 160)}`,
    );
  }

  await prisma.googleCalendarLink.update({
    where: { userId },
    data: {
      lastSyncAt: new Date(),
      lastSyncCount: events.length,
      lastSyncError: null,
    },
  });

  return { created, updated, total: events.length, calendarId };
}

/** Zapisuje przyczynę nieudanej synchronizacji, żeby użytkownik ją zobaczył. */
export async function recordSyncError(userId: string, message: string): Promise<void> {
  await prisma.googleCalendarLink
    .update({ where: { userId }, data: { lastSyncError: message } })
    .catch(() => {});
}
