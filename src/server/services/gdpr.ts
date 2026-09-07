import { prisma } from "@/lib/prisma";

/**
 * RODO — realizacja praw podmiotow danych (spec 10).
 *
 * Aplikacja przetwarza dwie kategorie danych osobowych:
 *  1. **konta pracownikow** — imie, nazwisko, e-mail, stanowisko, stawka;
 *     podstawa: umowa i prawnie uzasadniony interes administratora,
 *  2. **kontakty po stronie klienta** — imie, nazwisko, stanowisko, e-mail,
 *     telefon; podstawa: prawnie uzasadniony interes (realizacja i rozliczenie
 *     projektu, art. 6 ust. 1 lit. f).
 *
 * Dane firmowe klienta (nazwa, NIP, KRS, adres siedziby) nie sa danymi osobowymi
 * dla spolek prawa handlowego, ale sa nimi dla jednoosobowej dzialalnosci —
 * dlatego traktujemy je tak samo.
 *
 * ── Dlaczego anonimizacja, a nie usuniecie ─────────────────────────────────
 * Twarde skasowanie klienta zabraloby rentownosc projektow, ktore juz sie
 * rozliczyly, a wpisy czasu i faktury podlegaja odrebnym terminom przechowywania
 * (ustawa o rachunkowosci — 5 lat). Zastepujemy wiec dane osobowe znacznikami,
 * zostawiajac rekordy finansowe i statystyczne bez mozliwosci powiazania z osoba.
 */

/** Ile lat po zamknieciu ostatniego projektu wolno trzymac dane klienta. */
export const CLIENT_RETENTION_YEARS = 5;

/** Po ilu dniach kasujemy techniczne slady, ktore nie sluza juz zadnemu celowi. */
export const RETENTION_DAYS = {
  /** Proby logowania — potrzebne wylacznie na czas okna blokady i analizy incydentu. */
  loginAttempts: 30,
  /** Przeczytane powiadomienia — po miesiacu nie niosa juz informacji. */
  readNotifications: 30,
  /** Dziennik audytu — dwa lata, zeby dalo sie odtworzyc historie zmian. */
  auditLog: 730,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
//  PRAWO DOSTEPU I PRZENOSZENIA (art. 15 i 20)
// ═══════════════════════════════════════════════════════════════════════════

export type ExportSubject = "USER" | "CLIENT";

/**
 * Komplet danych podmiotu w formacie nadajacym sie do odczytu maszynowego.
 * Nie zawiera hashy hasel ani tokenow — to sekrety uwierzytelniajace, nie dane
 * podmiotu, a ich wydanie byloby samo w sobie zagrozeniem.
 */
export async function exportUserData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      position: true,
      fte: true,
      hourlyRate: true,
      theme: true,
      defaultView: true,
      urgentDays: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      anonymizedAt: true,
    },
  });
  if (!user) return null;

  const [tasks, timeLogs, comments, notes, improvements, notifications, ownedProjects] =
    await Promise.all([
      prisma.task.findMany({
        where: { assigneeId: userId },
        select: { code: true, title: true, status: true, dueDate: true, createdAt: true },
      }),
      prisma.timeLog.findMany({
        where: { userId },
        select: { hours: true, workDate: true, note: true, createdAt: true },
      }),
      prisma.comment.findMany({
        where: { authorId: userId },
        select: { body: true, createdAt: true },
      }),
      prisma.meetingNote.findMany({
        where: { authorId: userId },
        select: { title: true, meetingDate: true, content: true, attendees: true },
      }),
      prisma.improvement.findMany({
        where: { authorId: userId },
        select: { title: true, body: true, status: true, createdAt: true },
      }),
      prisma.notification.findMany({
        where: { userId },
        select: { kind: true, title: true, body: true, createdAt: true },
      }),
      prisma.project.findMany({
        where: { ownerId: userId },
        select: { code: true, name: true, status: true },
      }),
    ]);

  return {
    wygenerowano: new Date().toISOString(),
    podmiot: "konto uzytkownika",
    konto: user,
    projektyProwadzone: ownedProjects,
    zadania: tasks,
    wpisyCzasu: timeLogs,
    komentarze: comments,
    notatkiZeSpotkan: notes,
    zgloszeniaUsprawnien: improvements,
    powiadomienia: notifications,
  };
}

export async function exportClientData(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      contacts: true,
      opportunities: {
        select: {
          title: true,
          stage: true,
          status: true,
          value: true,
          probability: true,
          createdAt: true,
        },
      },
      projects: {
        select: {
          code: true,
          name: true,
          serviceType: true,
          status: true,
          startDate: true,
          endDate: true,
          contractValue: true,
        },
      },
      meetingNotes: {
        select: { title: true, meetingDate: true, content: true, attendees: true },
      },
    },
  });
  if (!client) return null;

  return {
    wygenerowano: new Date().toISOString(),
    podmiot: "klient i jego kontakty",
    klient: client,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  PRAWO DO USUNIECIA (art. 17)
// ═══════════════════════════════════════════════════════════════════════════

/** Wartosc zastepcza — czytelna dla czlowieka, jednoznacznie nieodwracalna. */
function placeholder(kind: string, id: string): string {
  return `[${kind} zanonimizowany ${id.slice(0, 6)}]`;
}

/**
 * Anonimizuje konto pracownika. Konto zostaje dezaktywowane, dane osobowe
 * zastapione, a autorstwo wpisow czasu i komentarzy — zachowane, bo bez niego
 * rozliczenie projektow przestaloby sie zgadzac.
 */
export async function anonymizeUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, anonymizedAt: true },
  });
  if (!user) throw new Error("Konto nie istnieje");
  if (user.anonymizedAt) throw new Error("Konto zostalo juz zanonimizowane");

  await prisma.$transaction(async (tx) => {
    // Proby logowania sa kluczowane e-mailem — trzeba je skasowac, zanim
    // podmienimy adres, inaczej zostana w bazie z prawdziwym adresem osoby.
    await tx.loginAttempt.deleteMany({ where: { email: user.email } });

    await tx.user.update({
      where: { id: userId },
      data: {
        email: `anon-${userId.slice(0, 12)}@usuniete.local`,
        fullName: placeholder("Uzytkownik", userId),
        position: null,
        passwordHash: null,
        calendarToken: null,
        isActive: false,
        anonymizedAt: new Date(),
      },
    });

    // Tokeny do zewnetrznych uslug musza zniknac razem z kontem.
    await tx.googleCalendarLink.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
  });
}

/**
 * Anonimizuje klienta wraz z kontaktami. Projekty, wpisy czasu i wartosci umow
 * zostaja — sluza rozliczeniu i sprawozdawczosci, a po anonimizacji nie da sie
 * ich powiazac z konkretna firma ani osoba.
 */
export async function anonymizeClient(clientId: string): Promise<{ contacts: number }> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, anonymizedAt: true },
  });
  if (!client) throw new Error("Klient nie istnieje");
  if (client.anonymizedAt) throw new Error("Klient zostal juz zanonimizowany");

  return prisma.$transaction(async (tx) => {
    await tx.client.update({
      where: { id: clientId },
      data: {
        name: placeholder("Klient", clientId),
        nip: null,
        krs: null,
        regon: null,
        address: null,
        city: null,
        website: null,
        notes: null,
        industry: null,
        status: "UTRACONY",
        anonymizedAt: new Date(),
      },
    });

    const contacts = await tx.clientContact.findMany({
      where: { clientId },
      select: { id: true },
    });
    for (const contact of contacts) {
      await tx.clientContact.update({
        where: { id: contact.id },
        data: {
          fullName: placeholder("Kontakt", contact.id),
          position: null,
          email: null,
          phone: null,
          notes: null,
          anonymizedAt: new Date(),
        },
      });
    }

    // Notatki ze spotkan niosa nazwiska uczestnikow i tresc rozmow.
    await tx.meetingNote.updateMany({
      where: { clientId },
      data: { attendees: null, content: null },
    });

    return { contacts: contacts.length };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  RETENCJA (art. 5 ust. 1 lit. e)
// ═══════════════════════════════════════════════════════════════════════════

export type CleanupResult = {
  loginAttempts: number;
  notifications: number;
  auditLog: number;
  clientsFlagged: number;
  clientsOverdue: string[];
};

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

/**
 * Sprzatanie retencyjne. Kasuje slady techniczne, ktore przekroczyly swoj okres,
 * i wylicza date konca retencji klientom po zamknieciu ostatniego projektu.
 *
 * Klientow **nie anonimizuje automatycznie** — decyzja o usunieciu danych
 * kontrahenta ma skutki umowne i ksiegowe, wiec zostaje przy czlowieku.
 * Zamiast tego zwraca liste przeterminowanych do rozpatrzenia.
 */
export async function runRetentionCleanup(): Promise<CleanupResult> {
  const [loginAttempts, notifications, auditLog] = await Promise.all([
    prisma.loginAttempt.deleteMany({
      where: { createdAt: { lt: daysAgo(RETENTION_DAYS.loginAttempts) } },
    }),
    prisma.notification.deleteMany({
      where: { readAt: { not: null, lt: daysAgo(RETENTION_DAYS.readNotifications) } },
    }),
    prisma.auditLog.deleteMany({
      where: { createdAt: { lt: daysAgo(RETENTION_DAYS.auditLog) } },
    }),
  ]);

  // Klient bez aktywnych projektow: okres retencji liczy sie od ostatniego zamkniecia.
  const candidates = await prisma.client.findMany({
    where: { anonymizedAt: null, retentionUntil: null },
    select: {
      id: true,
      name: true,
      projects: { select: { status: true, closedAt: true, updatedAt: true } },
    },
  });

  let clientsFlagged = 0;
  for (const client of candidates) {
    if (client.projects.length === 0) continue;
    if (client.projects.some((p) => p.status !== "CLOSED")) continue;

    const lastClosed = client.projects
      .map((p) => p.closedAt ?? p.updatedAt)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    const until = new Date(lastClosed);
    until.setFullYear(until.getFullYear() + CLIENT_RETENTION_YEARS);

    await prisma.client.update({ where: { id: client.id }, data: { retentionUntil: until } });
    clientsFlagged += 1;
  }

  const overdue = await prisma.client.findMany({
    where: { anonymizedAt: null, retentionUntil: { lt: new Date() } },
    select: { id: true, name: true },
  });

  return {
    loginAttempts: loginAttempts.count,
    notifications: notifications.count,
    auditLog: auditLog.count,
    clientsFlagged,
    clientsOverdue: overdue.map((c) => `${c.name} (${c.id})`),
  };
}

/** Zapis zadania podmiotu danych — obowiazek udokumentowania (art. 12 ust. 3). */
export async function logGdprRequest(params: {
  kind: "EXPORT" | "ERASURE";
  subjectType: "USER" | "CLIENT" | "CONTACT";
  subjectId: string;
  subjectLabel: string;
  requestedById: string | null;
  note?: string;
}): Promise<void> {
  await prisma.gdprRequest.create({
    data: {
      kind: params.kind,
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      subjectLabel: params.subjectLabel,
      requestedById: params.requestedById,
      note: params.note ?? null,
    },
  });
}
