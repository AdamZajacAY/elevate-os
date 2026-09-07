import type { Role } from "@/lib/domain";

/**
 * Uprawnienia ELEVATE OS (spec 06). Egzekwowane po stronie serwera —
 * interfejs jedynie ukrywa to, czego dana rola i tak by nie zapisala.
 */

export const MODULES = [
  "dashboard",
  "projects",
  "tasks",
  "gantt",
  "crm",
  "finances",
  "experts",
  "improvements",
  "admin",
] as const;
export type ModuleKey = (typeof MODULES)[number];

const READ_ACCESS: Record<ModuleKey, Role[]> = {
  dashboard: ["ADMIN", "PARTNER", "CONSULTANT"],
  projects: ["ADMIN", "PARTNER", "CONSULTANT"],
  tasks: ["ADMIN", "PARTNER", "CONSULTANT"],
  gantt: ["ADMIN", "PARTNER", "CONSULTANT"],
  crm: ["ADMIN", "PARTNER"],
  finances: ["ADMIN", "PARTNER"],
  experts: ["ADMIN", "PARTNER", "CONSULTANT"],
  improvements: ["ADMIN", "PARTNER", "CONSULTANT"],
  admin: ["ADMIN"],
};

/** Odczyt modulu. */
export function canRead(role: Role, module: ModuleKey): boolean {
  return READ_ACCESS[module].includes(role);
}

/**
 * Wglad w pola finansowe: budzet, przychod, stawka godzinowa, wycena podwykonawcy.
 * Konsultant widzi swoj postep operacyjny, nigdy marze projektu (spec 04).
 */
export function canSeeFinancials(role: Role): boolean {
  return role === "ADMIN" || role === "PARTNER";
}

/** Zarzadzanie platforma: konta, role, slowniki, kopie zapasowe. */
export function isAdmin(role: Role): boolean {
  return role === "ADMIN";
}

/**
 * Zapis na karcie projektu. Partner ma pelny odczyt portfela, ale zapis
 * tylko na projektach, ktorych jest opiekunem (spec 06).
 */
export function canWriteProject(
  role: Role,
  userId: string,
  project: { ownerId: string | null },
): boolean {
  if (role === "ADMIN") return true;
  return project.ownerId === userId;
}

/**
 * Widocznosc projektu. Konsultant widzi projekty, w ktorych jest opiekunem
 * albo ma przypisane zadanie — zawezanie realizuje `projectScopeWhere`.
 */
export function canReadAllProjects(role: Role): boolean {
  return role === "ADMIN" || role === "PARTNER";
}

/**
 * Fragment `where` Prismy zawezajacy projekty do zakresu roli.
 * Zwraca `{}` dla rol z pelnym odczytem portfela.
 */
export function projectScopeWhere(role: Role, userId: string) {
  if (canReadAllProjects(role)) return {};
  return {
    OR: [{ ownerId: userId }, { tasks: { some: { assigneeId: userId } } }],
  };
}
