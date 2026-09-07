import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

/**
 * Kopie zapasowe (spec 10).
 *
 * Na SQLite robilismy `VACUUM INTO`. Po przejsciu na Postgres tamta droga
 * odpada, a `pg_dump` wymaga binarki, ktorej obraz Rendera nie ma. Robimy wiec
 * **zrzut logiczny przez Prisme**: JSON ze wszystkimi tabelami. Dziala wszedzie,
 * bez zaleznosci zewnetrznych, i jest przenosny — da sie go zaladowac do innej bazy.
 *
 * To **uzupelnienie**, nie zamiennik kopii zarzadzanych przez Render. Zrzut
 * logiczny nie zachowuje sekwencji ani planow zapytan; sluzy przenosinom
 * i awaryjnemu odtworzeniu danych, nie odtworzeniu klastra.
 *
 * Na Renderze dysk jest efemeryczny — pliki znikaja przy kazdym wdrozeniu.
 * Dlatego kopia jest przede wszystkim **pobierana przez Administratora**,
 * a na dysk trafia tylko wtedy, gdy `BACKUP_DIR` wskazuje trwaly wolumen.
 */

const KEEP_LAST = 10;

/** Katalog kopii; brak zmiennej = kopie nie sa utrwalane (np. na Renderze). */
function backupDir(): string | null {
  const dir = process.env.BACKUP_DIR;
  if (dir) return path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
  // Lokalnie domyslnie zapisujemy — wygodne przy pracy z danymi demonstracyjnymi.
  return process.env.NODE_ENV === "production" ? null : path.join(process.cwd(), "backups");
}

export type BackupFile = { name: string; sizeBytes: number; createdAt: string };

/**
 * Zrzut wszystkich tabel. Kolejnosc ma znaczenie przy odtwarzaniu — najpierw
 * encje, na ktore wskazuja klucze obce.
 */
async function dumpAllTables() {
  const [
    users, clients, contacts, opportunities, projects, stages, tasks, timeLogs,
    checklistTemplates, checklistTemplateItems, projectChecklist, experts, projectExperts,
    risks, milestones, statusReports, meetingNotes, meetingNoteItems, comments,
    notifications, configLabels, improvements, counters, gdprRequests,
  ] = await Promise.all([
    prisma.user.findMany(), prisma.client.findMany(), prisma.clientContact.findMany(),
    prisma.opportunity.findMany(), prisma.project.findMany(), prisma.projectStage.findMany(),
    prisma.task.findMany(), prisma.timeLog.findMany(), prisma.checklistTemplate.findMany(),
    prisma.checklistTemplateItem.findMany(), prisma.projectChecklistItem.findMany(),
    prisma.externalExpert.findMany(), prisma.projectExpert.findMany(), prisma.risk.findMany(),
    prisma.milestone.findMany(), prisma.statusReport.findMany(), prisma.meetingNote.findMany(),
    prisma.meetingNoteItem.findMany(), prisma.comment.findMany(), prisma.notification.findMany(),
    prisma.configLabel.findMany(), prisma.improvement.findMany(), prisma.counter.findMany(),
    prisma.gdprRequest.findMany(),
  ]);

  return {
    format: "elevate-os-backup-v1",
    createdAt: new Date().toISOString(),
    tables: {
      users, clients, contacts, opportunities, projects, stages, tasks, timeLogs,
      checklistTemplates, checklistTemplateItems, projectChecklist, experts, projectExperts,
      risks, milestones, statusReports, meetingNotes, meetingNoteItems, comments,
      notifications, configLabels, improvements, counters, gdprRequests,
    },
  };
}

/**
 * Tworzy kopie i zwraca jej tresc. Zapis na dysk jest opcjonalny — wolajacy
 * moze chciec wylacznie oddac plik do pobrania.
 */
export async function createBackup(
  label: "reczna" | "auto" = "reczna",
): Promise<{ name: string; content: string; persisted: boolean }> {
  const dump = await dumpAllTables();
  const content = JSON.stringify(dump, null, 2);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const name = `elevate-${label}-${stamp}.json`;

  const dir = backupDir();
  if (!dir) return { name, content, persisted: false };

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), content, "utf8");
  await pruneOldBackups();
  return { name, content, persisted: true };
}

export async function listBackups(): Promise<BackupFile[]> {
  const dir = backupDir();
  if (!dir) return [];
  try {
    const names = await readdir(dir);
    const files = await Promise.all(
      names
        .filter((n) => n.endsWith(".json"))
        .map(async (name) => {
          const info = await stat(path.join(dir, name));
          return { name, sizeBytes: info.size, createdAt: info.birthtime.toISOString() };
        }),
    );
    return files.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

async function pruneOldBackups(): Promise<void> {
  const dir = backupDir();
  if (!dir) return;
  const stale = (await listBackups()).slice(KEEP_LAST);
  for (const file of stale) {
    await unlink(path.join(dir, file.name)).catch(() => {});
  }
}

/** Kopia przy starcie — pomijana, gdy dzisiejsza juz istnieje albo gdy nie ma gdzie zapisac. */
export async function backupOnStartup(): Promise<BackupFile | null> {
  if (!backupDir()) return null;

  const today = new Date().toISOString().slice(0, 10);
  const existing = await listBackups();
  if (existing.some((f) => f.name.includes("auto") && f.createdAt.startsWith(today))) return null;

  const created = await createBackup("auto");
  return { name: created.name, sizeBytes: Buffer.byteLength(created.content), createdAt: new Date().toISOString() };
}
