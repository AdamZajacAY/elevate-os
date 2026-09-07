import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/domain";
import { canReadAllProjects, projectScopeWhere } from "@/lib/rbac";

/**
 * Sprawdzenia dostepu do konkretnego rekordu.
 *
 * `rbac.ts` odpowiada na pytanie "czy ta rola widzi ten modul"; ten plik na
 * pytanie "czy ten uzytkownik widzi ten rekord". Rozdzielenie jest celowe:
 * sama zgoda na modul nie wystarcza, bo modul `projects` czyta kazda rola,
 * a zakres projektow konsultanta jest wezszy niz caly portfel.
 *
 * Kazda trasa API operujaca na id przekazanym przez klienta musi przejsc przez
 * jedna z tych funkcji — inaczej id z cudzego projektu daje dostep do danych.
 */

/** Czy uzytkownik widzi projekt: pelny odczyt portfela, opiekun albo wykonawca zadania. */
export async function canViewProject(
  userId: string,
  role: Role,
  projectId: string,
): Promise<boolean> {
  // Regula widocznosci zyje w jednym miejscu — `projectScopeWhere` zwraca `{}`
  // dla rol z pelnym odczytem portfela, wiec nie trzeba osobnej galezi.
  const hit = await prisma.project.findFirst({
    where: { id: projectId, ...projectScopeWhere(role, userId) },
    select: { id: true },
  });
  return !!hit;
}

/**
 * Czy uzytkownik moze zakladac i edytowac zadania w projekcie.
 * Szerzej niz `canWriteProjectById`: wykonawca prowadzi swoje zadania,
 * ale nie zaklada ich w cudzych projektach.
 */
export async function canManageTasksIn(
  userId: string,
  role: Role,
  projectId: string,
): Promise<boolean> {
  return canViewProject(userId, role, projectId);
}

/** Czy uzytkownik widzi zadanie — przez projekt albo przez przypisanie. */
export async function canViewTask(userId: string, role: Role, taskId: string): Promise<boolean> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { assigneeId: true, projectId: true, project: { select: { ownerId: true } } },
  });
  if (!task) return false;
  if (canReadAllProjects(role)) return true;
  return task.assigneeId === userId || task.project.ownerId === userId;
}

/** Czy uzytkownik widzi klienta — CRM jest modulem ADMIN/PARTNER, wiec sama rola decyduje. */
export async function canViewClient(role: Role, clientId: string): Promise<boolean> {
  if (!canReadAllProjects(role)) return false;
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  return !!client;
}
