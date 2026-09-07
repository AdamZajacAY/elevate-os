import { prisma } from "@/lib/prisma";

/**
 * Powiadomienia (spec 03/05). Dwa zrodla:
 *  - zdarzeniowe — wzmianka w komentarzu, przypisanie zadania: tworzone przy zapisie,
 *  - proaktywne — zblizajacy sie termin, opoznienie, kamien milowy, cisza u klienta:
 *    tworzone przez `scanForNotifications`, wolane cyklicznie albo z panelu.
 *
 * Kazde powiadomienie ma klucz naturalny (kind + link + odbiorca), zeby ponowne
 * przeskanowanie nie zasypalo skrzynki duplikatami tego samego terminu.
 */

export type NotificationKind =
  | "TERMIN"
  | "OPOZNIENIE"
  | "WZMIANKA"
  | "KAMIEN_MILOWY"
  | "FOLLOW_UP"
  | "PRZYPISANIE";

/** Tworzy powiadomienie, o ile identyczne nieprzeczytane juz nie wisi w skrzynce. */
export async function notify(params: {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  link?: string | null;
}): Promise<boolean> {
  const existing = await prisma.notification.findFirst({
    where: {
      userId: params.userId,
      kind: params.kind,
      link: params.link ?? null,
      readAt: null,
    },
    select: { id: true },
  });
  if (existing) return false;

  await prisma.notification.create({
    data: {
      userId: params.userId,
      kind: params.kind,
      title: params.title,
      body: params.body ?? null,
      link: params.link ?? null,
    },
  });
  return true;
}

/** Wzmianki w komentarzu — autor nie dostaje powiadomienia o wzmiance samego siebie. */
export async function notifyMentions(params: {
  mentionedIds: string[];
  authorId: string;
  authorName: string;
  taskId: string;
  taskCode: string;
  taskTitle: string;
  projectId: string;
  excerpt: string;
}): Promise<number> {
  const targets = [...new Set(params.mentionedIds)].filter((id) => id !== params.authorId);
  if (targets.length === 0) return 0;

  // Wzmianka ma sens tylko dla aktywnych kont.
  const active = await prisma.user.findMany({
    where: { id: { in: targets }, isActive: true },
    select: { id: true },
  });

  let created = 0;
  for (const user of active) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        kind: "WZMIANKA",
        title: `${params.authorName} wspomniał(a) Cię przy ${params.taskCode}`,
        body: `${params.taskTitle} — „${params.excerpt}”`,
        link: `/tasks/${params.taskId}`,
      },
    });
    created += 1;
  }
  return created;
}

export type ScanResult = {
  upcoming: number;
  overdue: number;
  milestones: number;
  silentClients: number;
};

/**
 * Skan proaktywny (spec 11, Faza 5). Prog "zblizajacego sie terminu" jest
 * indywidualny — kazdy uzytkownik ma wlasne `urgentDays` z Panelu Usprawnien.
 */
export async function scanForNotifications(): Promise<ScanResult> {
  const now = new Date();
  const result: ScanResult = { upcoming: 0, overdue: 0, milestones: 0, silentClients: 0 };

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, role: true, urgentDays: true },
  });

  for (const user of users) {
    const horizon = new Date(now.getTime() + user.urgentDays * 86_400_000);

    const [upcoming, overdue] = await Promise.all([
      prisma.task.findMany({
        where: {
          assigneeId: user.id,
          status: { not: "DONE" },
          dueDate: { gte: now, lte: horizon },
        },
        select: { id: true, code: true, title: true, dueDate: true },
      }),
      prisma.task.findMany({
        where: { assigneeId: user.id, status: { not: "DONE" }, dueDate: { lt: now } },
        select: { id: true, code: true, title: true, dueDate: true },
      }),
    ]);

    for (const task of upcoming) {
      const created = await notify({
        userId: user.id,
        kind: "TERMIN",
        title: `Zbliża się termin: ${task.code}`,
        body: task.title,
        link: `/tasks/${task.id}`,
      });
      if (created) result.upcoming += 1;
    }

    for (const task of overdue) {
      const created = await notify({
        userId: user.id,
        kind: "OPOZNIENIE",
        title: `Zadanie po terminie: ${task.code}`,
        body: task.title,
        link: `/tasks/${task.id}`,
      });
      if (created) result.overdue += 1;
    }
  }

  // Kamienie milowe — do opiekuna projektu, w oknie 14 dni.
  const milestoneHorizon = new Date(now.getTime() + 14 * 86_400_000);
  const milestones = await prisma.milestone.findMany({
    where: { completedAt: null, dueDate: { gte: now, lte: milestoneHorizon } },
    include: { project: { select: { id: true, code: true, ownerId: true } } },
  });
  for (const milestone of milestones) {
    if (!milestone.project.ownerId) continue;
    const created = await notify({
      userId: milestone.project.ownerId,
      kind: "KAMIEN_MILOWY",
      title: `Kamień milowy: ${milestone.name}`,
      body: `${milestone.project.code} — termin ${milestone.dueDate.toLocaleDateString("pl-PL")}`,
      link: `/projects/${milestone.project.id}`,
    });
    if (created) result.milestones += 1;
  }

  // Cisza u klienta (spec 05) — do rol prowadzacych sprzedaz.
  const silenceThreshold = new Date(now.getTime() - 30 * 86_400_000);
  const silentClients = await prisma.client.findMany({
    where: {
      status: { in: ["PROSPEKT", "AKTYWNY", "STALY"] },
      OR: [{ lastContactAt: null }, { lastContactAt: { lt: silenceThreshold } }],
    },
    select: { id: true, name: true, lastContactAt: true },
  });
  const salesUsers = users.filter((u) => u.role === "ADMIN" || u.role === "PARTNER");
  for (const client of silentClients) {
    for (const user of salesUsers) {
      const created = await notify({
        userId: user.id,
        kind: "FOLLOW_UP",
        title: `Brak kontaktu: ${client.name}`,
        body: client.lastContactAt
          ? `Ostatni kontakt ${client.lastContactAt.toLocaleDateString("pl-PL")}`
          : "Nigdy nie odnotowano kontaktu",
        link: `/crm/clients/${client.id}`,
      });
      if (created) result.silentClients += 1;
    }
  }

  return result;
}
