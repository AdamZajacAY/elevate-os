/**
 * Slowniki domenowe ELEVATE OS — jedno zrodlo prawdy dla wartosci trzymanych
 * w bazie jako String (SQLite nie ma enumow) oraz dla etykiet w interfejsie.
 */

// ── Role (spec 06) ───────────────────────────────────────────────────────────
export const ROLES = ["ADMIN", "PARTNER", "CONSULTANT"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrator",
  PARTNER: "Partner / Zarząd",
  CONSULTANT: "Konsultant",
};

// ── Fazy metody Elevate (spec 07) ────────────────────────────────────────────
export const PHASES = ["EXPLORE", "ENGINEER", "EXECUTE", "ELEVATE"] as const;
export type Phase = (typeof PHASES)[number];

export const PHASE_LABEL: Record<Phase, string> = {
  EXPLORE: "Explore",
  ENGINEER: "Engineer",
  EXECUTE: "Execute",
  ELEVATE: "Elevate",
};

export const PHASE_DESC: Record<Phase, string> = {
  EXPLORE: "Diagnoza i audyt",
  ENGINEER: "Projektowanie strategii",
  EXECUTE: "Wdrożenie zmian",
  ELEVATE: "Skalowanie i monitoring",
};

// ── Status RAG (spec 03) ─────────────────────────────────────────────────────
export const RAG_STATUSES = ["GREEN", "AMBER", "RED"] as const;
export type RagStatus = (typeof RAG_STATUSES)[number];

// ── Status projektu ──────────────────────────────────────────────────────────
export const PROJECT_STATUSES = ["PLANNED", "ACTIVE", "ON_HOLD", "CLOSED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANNED: "Planowany",
  ACTIVE: "W realizacji",
  ON_HOLD: "Wstrzymany",
  CLOSED: "Zamknięty",
};

// ── Typy uslugi (spec 03) — slownik konfiguracyjny, ponizej wartosci startowe ─
export const SERVICE_TYPES = [
  "AUDYT_ECOMMERCE",
  "STRATEGIA_SPRZEDAZY",
  "INTERIM_MANAGEMENT",
  "WDROZENIE_NARZEDZIA",
  "SZKOLENIE_ZESPOLU",
  "EKSPANSJA_CROSS_BORDER",
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_TYPE_LABEL: Record<ServiceType, string> = {
  AUDYT_ECOMMERCE: "Audyt e-commerce",
  STRATEGIA_SPRZEDAZY: "Strategia sprzedaży",
  INTERIM_MANAGEMENT: "Interim management",
  WDROZENIE_NARZEDZIA: "Wdrożenie narzędzia",
  SZKOLENIE_ZESPOLU: "Szkolenie zespołu",
  EKSPANSJA_CROSS_BORDER: "Ekspansja cross-border",
};

// ── Zadania ──────────────────────────────────────────────────────────────────
export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "REVIEW", "BLOCKED", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "Do zrobienia",
  IN_PROGRESS: "W toku",
  REVIEW: "Do przeglądu",
  BLOCKED: "Zablokowane",
  DONE: "Zrobione",
};

/// Kolumny tablicy Kanban w kolejnosci przeplywu
export const KANBAN_COLUMNS: TaskStatus[] = ["TODO", "IN_PROGRESS", "REVIEW", "BLOCKED", "DONE"];

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: "Niski",
  MEDIUM: "Średni",
  HIGH: "Wysoki",
  CRITICAL: "Krytyczny",
};

// ── CRM ──────────────────────────────────────────────────────────────────────
export const CLIENT_STATUSES = ["PROSPEKT", "AKTYWNY", "STALY", "NIEAKTYWNY", "UTRACONY"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = {
  PROSPEKT: "Prospekt",
  AKTYWNY: "Aktywny",
  STALY: "Stały klient",
  NIEAKTYWNY: "Nieaktywny",
  UTRACONY: "Utracony",
};

export const CLIENT_SEGMENTS = ["STRATEGICZNY", "KLUCZOWY", "STANDARDOWY", "JEDNORAZOWY"] as const;
export type ClientSegment = (typeof CLIENT_SEGMENTS)[number];

export const CLIENT_SEGMENT_LABEL: Record<ClientSegment, string> = {
  STRATEGICZNY: "Strategiczny",
  KLUCZOWY: "Kluczowy",
  STANDARDOWY: "Standardowy",
  JEDNORAZOWY: "Jednorazowy",
};

/**
 * Pipeline sprzedazowy AdviseYou. Etapy odzwierciedlaja realny proces:
 * od rozmowy diagnostycznej, przez przygotowanie i wyslanie oferty, po decyzje klienta.
 * Ostatni etap jest rozstrzygajacy — szansa konczy sie tam wygrana albo przegrana.
 */
export const OPPORTUNITY_STAGES = [
  "KONSULTACJE",
  "OFERTA_W_PRZYGOTOWANIU",
  "OFERTA_WYSLANA",
  "WERYFIKACJA_OFERTY",
  "ZAKUP_LUB_ODMOWA",
] as const;
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const OPPORTUNITY_STAGE_LABEL: Record<OpportunityStage, string> = {
  KONSULTACJE: "Konsultacje biznesowe",
  OFERTA_W_PRZYGOTOWANIU: "Oferta w przygotowaniu",
  OFERTA_WYSLANA: "Wysłana oferta",
  WERYFIKACJA_OFERTY: "Weryfikacja oferty",
  ZAKUP_LUB_ODMOWA: "Zakup lub odmowa",
};

export const OPPORTUNITY_STAGE_HINT: Record<OpportunityStage, string> = {
  KONSULTACJE: "Rozmowa diagnostyczna, rozpoznanie potrzeby",
  OFERTA_W_PRZYGOTOWANIU: "Zakres i wycena po naszej stronie",
  OFERTA_WYSLANA: "Oferta u klienta, czekamy na reakcję",
  WERYFIKACJA_OFERTY: "Klient analizuje, negocjacje i pytania",
  ZAKUP_LUB_ODMOWA: "Etap rozstrzygający — decyzja klienta",
};

/** Etap, na ktorym zapada decyzja — tam wymagamy zamkniecia szansy z czynnikami. */
export const DECISION_STAGE: OpportunityStage = "ZAKUP_LUB_ODMOWA";

// ── Czynniki decyzji (spec 05 — nauka z wygranych i przegranych) ─────────────

/**
 * Dlaczego klient kupil. Zbierane przy wygranej, zeby dalo sie odpowiedziec
 * na pytanie "co domyka nasze oferty" liczbami, a nie wrazeniem.
 */
export const WIN_FACTORS = [
  "REKOMENDACJA",
  "DOPASOWANIE_ZAKRESU",
  "CENA",
  "TERMIN_REALIZACJI",
  "DOSWIADCZENIE_BRANZOWE",
  "RELACJA_Z_KONSULTANTEM",
  "REFERENCJE",
  "KOMPLEKSOWOSC",
  "SZYBKOSC_REAKCJI",
] as const;
export type WinFactor = (typeof WIN_FACTORS)[number];

export const WIN_FACTOR_LABEL: Record<WinFactor, string> = {
  REKOMENDACJA: "Rekomendacja / polecenie",
  DOPASOWANIE_ZAKRESU: "Dopasowanie zakresu do potrzeby",
  CENA: "Cena",
  TERMIN_REALIZACJI: "Termin realizacji",
  DOSWIADCZENIE_BRANZOWE: "Doświadczenie w branży klienta",
  RELACJA_Z_KONSULTANTEM: "Relacja z konsultantem",
  REFERENCJE: "Referencje i case studies",
  KOMPLEKSOWOSC: "Kompleksowość oferty",
  SZYBKOSC_REAKCJI: "Szybkość reakcji",
};

/** Dlaczego klient nie kupil. */
export const LOSS_FACTORS = [
  "CENA_ZA_WYSOKA",
  "BRAK_BUDZETU",
  "WYBRANO_KONKURENCJE",
  "REALIZACJA_WEWNETRZNA",
  "ODLOZONE_W_CZASIE",
  "ZMIANA_PRIORYTETOW",
  "BRAK_DECYZYJNOSCI",
  "ZAKRES_NIEADEKWATNY",
  "BRAK_KONTAKTU",
] as const;
export type LossFactor = (typeof LOSS_FACTORS)[number];

export const LOSS_FACTOR_LABEL: Record<LossFactor, string> = {
  CENA_ZA_WYSOKA: "Cena za wysoka",
  BRAK_BUDZETU: "Brak budżetu",
  WYBRANO_KONKURENCJE: "Wybrano konkurencję",
  REALIZACJA_WEWNETRZNA: "Realizacja własnymi siłami",
  ODLOZONE_W_CZASIE: "Odłożone w czasie",
  ZMIANA_PRIORYTETOW: "Zmiana priorytetów u klienta",
  BRAK_DECYZYJNOSCI: "Brak decyzji / rozmówca bez mandatu",
  ZAKRES_NIEADEKWATNY: "Zakres nieadekwatny do potrzeby",
  BRAK_KONTAKTU: "Klient przestał odpowiadać",
};

// ── Ryzyka ───────────────────────────────────────────────────────────────────
export const RISK_STATUSES = ["OPEN", "MITIGATED", "CLOSED"] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];

export const RISK_STATUS_LABEL: Record<RiskStatus, string> = {
  OPEN: "Otwarte",
  MITIGATED: "Zmitygowane",
  CLOSED: "Zamknięte",
};

// ── Panel Usprawnien ─────────────────────────────────────────────────────────
export const IMPROVEMENT_STATUSES = ["NOWY", "W_ANALIZIE", "WDROZONY", "ODRZUCONY"] as const;
export type ImprovementStatus = (typeof IMPROVEMENT_STATUSES)[number];

export const IMPROVEMENT_STATUS_LABEL: Record<ImprovementStatus, string> = {
  NOWY: "Nowy",
  W_ANALIZIE: "W analizie",
  WDROZONY: "Wdrożony",
  ODRZUCONY: "Odrzucony",
};

// ── Pomocnicze ───────────────────────────────────────────────────────────────
export function labelOf<T extends string>(map: Record<T, string>, value: string): string {
  return (map as Record<string, string>)[value] ?? value;
}
