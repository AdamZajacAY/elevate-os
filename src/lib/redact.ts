import type { Role } from "@/lib/domain";
import { canSeeFinancials } from "@/lib/rbac";

/**
 * Redakcja pol finansowych (spec 04).
 *
 * "Redakcja finansowa jest domyslna, nie opcjonalna." Pola zerowane sa tutaj —
 * na granicy odpowiedzi serwera — a nie ukrywane w komponencie. Kazda trasa API
 * zwracajaca encje z pieniedzmi przepuszcza dane przez `redact*`.
 */

/** Pola finansowe per encja — zmiana schematu wymaga aktualizacji tej mapy. */
const FINANCIAL_FIELDS = {
  project: ["budget", "contractValue", "quotedValue", "recurringAmount"],
  user: ["hourlyRate"],
  expert: ["hourlyRate"],
  projectExpert: ["contractValue"],
  opportunity: ["value"],
  timeLog: ["rateSnapshot"],
} as const;

export type FinancialEntity = keyof typeof FINANCIAL_FIELDS;

/** Zeruje pola finansowe encji, jesli rola nie ma uprawnienia. */
export function redact<T extends Record<string, unknown>>(
  entity: FinancialEntity,
  role: Role,
  data: T,
): T {
  if (canSeeFinancials(role)) return data;
  const out = { ...data };
  for (const field of FINANCIAL_FIELDS[entity]) {
    if (field in out) (out as Record<string, unknown>)[field] = null;
  }
  return out;
}

/** Wersja dla list. */
export function redactMany<T extends Record<string, unknown>>(
  entity: FinancialEntity,
  role: Role,
  rows: T[],
): T[] {
  if (canSeeFinancials(role)) return rows;
  return rows.map((row) => redact(entity, role, row));
}

/**
 * Karta projektu z zagniezdzonymi relacjami — redaguje projekt oraz
 * przypisania ekspertow i wpisy czasu, ktore niosa wlasne pola finansowe.
 */
export function redactProjectTree<
  T extends Record<string, unknown> & {
    experts?: Record<string, unknown>[];
    timeLogs?: Record<string, unknown>[];
  },
>(role: Role, project: T): T {
  if (canSeeFinancials(role)) return project;
  const out = redact("project", role, project);
  if (Array.isArray(out.experts)) {
    out.experts = redactMany("projectExpert", role, out.experts) as T["experts"];
  }
  if (Array.isArray(out.timeLogs)) {
    out.timeLogs = redactMany("timeLog", role, out.timeLogs) as T["timeLogs"];
  }
  return out;
}
