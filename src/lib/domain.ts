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

/// Pipeline sprzedazowy zbudowany na metodzie Elevate, nie na generycznych etapach (spec 05)
export const OPPORTUNITY_STAGES = [
  "LEAD_OFERTA",
  "EXPLORE",
  "ENGINEER_EXECUTE",
  "ELEVATE_OPIEKA",
] as const;
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const OPPORTUNITY_STAGE_LABEL: Record<OpportunityStage, string> = {
  LEAD_OFERTA: "Lead → Oferta",
  EXPLORE: "Etap I: Explore",
  ENGINEER_EXECUTE: "Etap II: Engineer / Execute",
  ELEVATE_OPIEKA: "Elevate: stała opieka",
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
