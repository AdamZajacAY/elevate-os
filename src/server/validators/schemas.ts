import { z } from "zod";
import {
  BILLING_MODELS,
  BILLING_PERIODS,
  PHASES,
  PRIORITIES,
  PROJECT_STATUSES,
  RAG_STATUSES,
  ROLES,
  SERVICE_TYPES,
  TASK_STATUSES,
  CLIENT_STATUSES,
  CLIENT_SEGMENTS,
  OPPORTUNITY_STAGES,
  IMPROVEMENT_STATUSES,
  WIN_FACTORS,
  LOSS_FACTORS,
} from "@/lib/domain";

/**
 * Walidacja wejscia API.
 *
 * ── Zasada, ktora rzadzi calym plikiem ──────────────────────────────────────
 * Schematy aktualizacji (PATCH) NIE MOGA wstawiac wartosci domyslnych ani
 * zamieniac pominietych pol na `null`. Trasy PATCH robia `prisma.update({ data })`,
 * wiec kazde pole obecne w wyniku parsowania zostaje zapisane do bazy. Gdyby
 * pominiete pole stawalo sie `null` albo dostawalo `.default()`, zwykla zmiana
 * statusu kasowalaby priorytet, stawke godzinowa albo tresc notatki.
 *
 * Stad dwie reguly:
 *  1. Pola opcjonalne zostawiaja `undefined` nietkniete — transformacja dotyczy
 *     wylacznie wartosci faktycznie przyslanych (`null` albo pusty string).
 *  2. Wartosci domyslne (`.default(...)`) zyja wylacznie w schematach tworzenia.
 *     Schematy aktualizacji buduje sie z tego samego zestawu pol, ale bez domyslnych.
 *
 * `.partial()` w Zod 4 NIE zdejmuje `.default()` — dlatego nie da sie zrobic
 * `createSchema.partial()` i uznac sprawy za zalatwiona.
 */

/** Tekst opcjonalny: pominiete pole zostaje pominiete, jawny null/"" daje null. */
const optionalText = z
  .union([z.string().trim().max(5000), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === null || v === "" ? null : v));

/** Kwota opcjonalna — przyjmuje liczbe, string z przecinkiem albo null. */
const optionalMoney = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  });

/** Data opcjonalna. */
const optionalDate = z
  .union([z.string().min(1), z.date(), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === null || v === "" ? null : new Date(v)));

/** Data wymagana. */
const requiredDate = z.union([z.string().min(1), z.date()]).transform((v) => new Date(v));

/**
 * Data opcjonalna, ale **nie** nullowalna — do pol, ktore w bazie sa wymagane.
 * Mozna ich nie przysylac przy PATCH, ale nie mozna ich wyczyscic.
 */
const optionalRequiredDate = z
  .union([z.string().min(1), z.date()])
  .optional()
  .transform((v) => (v === undefined ? undefined : new Date(v)));

/** Odwolanie do rekordu: id albo jawne odpiecie przez null. */
const optionalRef = z
  .union([z.string().min(1), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === null || v === "" ? null : v));

/**
 * Odrzuca cialo, ktore po walidacji nie niesie zadnego pola.
 * Bez tego zniekształcone zadanie (parseBody zamienia zly JSON na `{}`)
 * przechodzilo jako poprawny, pusty PATCH.
 */
function nonEmptyPatch<T extends z.ZodTypeAny>(schema: T) {
  return schema.refine(
    (value) => value !== null && typeof value === "object" && Object.keys(value).length > 0,
    { message: "Zadanie nie zawiera zadnych pol do zapisania" },
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  PROJEKTY
// ═══════════════════════════════════════════════════════════════════════════

/** Pola karty projektu — bez wartosci domyslnych, wspolne dla create i update. */
const projectFields = {
  name: z.string().trim().min(3, "Nazwa projektu ma minimum 3 znaki").max(160),
  clientId: z.string().min(1, "Wybierz klienta"),
  serviceType: z.enum(SERVICE_TYPES),
  ownerId: optionalRef,
  phase: z.enum(PHASES),
  status: z.enum(PROJECT_STATUSES),
  description: optionalText,
  startDate: optionalDate,
  endDate: optionalDate,
  budget: optionalMoney,
  contractValue: optionalMoney,
  quotedValue: optionalMoney,
  billingModel: z.enum(BILLING_MODELS),
  billingPeriod: z.union([z.enum(BILLING_PERIODS), z.null()]).optional(),
  recurringAmount: optionalMoney,
  billingStartDate: optionalDate,
  billingEndDate: optionalDate,
  noticePeriodDays: z.union([z.number().int().min(0).max(365), z.null()]).optional(),
};

/**
 * Abonament bez okresu rozliczeniowego albo bez kwoty to nie abonament —
 * nie da sie z niego policzyc ani przychodu, ani wartosci miesiecznej.
 */
function requireRecurringFields<T extends { billingModel?: string; billingPeriod?: unknown; recurringAmount?: unknown }>(
  value: T,
): boolean {
  if (value.billingModel !== "ABONAMENT") return true;
  return !!value.billingPeriod && typeof value.recurringAmount === "number";
}

export const projectCreateSchema = z
  .object({
    ...projectFields,
    phase: projectFields.phase.default("EXPLORE"),
    status: projectFields.status.default("ACTIVE"),
    billingModel: projectFields.billingModel.default("JEDNORAZOWY"),
  })
  .refine(requireRecurringFields, {
    message: "Abonament wymaga okresu rozliczeniowego i kwoty za okres",
    path: ["recurringAmount"],
  });

export const projectUpdateSchema = nonEmptyPatch(
  z.object({ ...projectFields, ragStatus: z.enum(RAG_STATUSES) }).partial(),
).refine(requireRecurringFields, {
  message: "Abonament wymaga okresu rozliczeniowego i kwoty za okres",
  path: ["recurringAmount"],
});

// ═══════════════════════════════════════════════════════════════════════════
//  ZADANIA
// ═══════════════════════════════════════════════════════════════════════════

const taskFields = {
  title: z.string().trim().min(3, "Tytul zadania ma minimum 3 znaki").max(200),
  description: optionalText,
  status: z.enum(TASK_STATUSES),
  priority: z.enum(PRIORITIES),
  assigneeId: optionalRef,
  expertId: optionalRef,
  stageId: optionalRef,
  estimatedHours: z.union([z.number().min(0).max(1000), z.null()]).optional(),
  dueDate: optionalDate,
};

export const taskCreateSchema = z.object({
  ...taskFields,
  projectId: z.string().min(1, "Zadanie musi nalezec do projektu"),
  status: taskFields.status.default("TODO"),
  priority: taskFields.priority.default("MEDIUM"),
});

export const taskUpdateSchema = nonEmptyPatch(z.object(taskFields).partial());

// ═══════════════════════════════════════════════════════════════════════════
//  HARMONOGRAM
// ═══════════════════════════════════════════════════════════════════════════

export const stageCreateSchema = z
  .object({
    projectId: z.string().min(1),
    name: z.string().trim().min(2).max(160),
    phase: z.enum(PHASES).default("EXPLORE"),
    startDate: requiredDate,
    endDate: requiredDate,
    progress: z.number().int().min(0).max(100).default(0),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "Data konca etapu nie moze byc wczesniejsza niz start",
    path: ["endDate"],
  });

export const stageUpdateSchema = nonEmptyPatch(
  z
    .object({
      name: z.string().trim().min(2).max(160),
      phase: z.enum(PHASES),
      startDate: optionalDate,
      endDate: optionalDate,
      progress: z.number().int().min(0).max(100),
    })
    .partial(),
);

// ═══════════════════════════════════════════════════════════════════════════
//  WPISY CZASU
// ═══════════════════════════════════════════════════════════════════════════

export const timeLogCreateSchema = z.object({
  taskId: optionalRef,
  projectId: z.string().min(1),
  hours: z.number().positive("Liczba godzin musi byc dodatnia").max(24),
  workDate: requiredDate,
  note: optionalText,
});

// ═══════════════════════════════════════════════════════════════════════════
//  CRM
// ═══════════════════════════════════════════════════════════════════════════

const clientFields = {
  name: z.string().trim().min(2).max(160),
  industry: optionalText,
  segment: z.enum(CLIENT_SEGMENTS),
  status: z.enum(CLIENT_STATUSES),
  nip: z
    .union([z.string().trim().regex(/^\d{10}$/, "NIP to 10 cyfr"), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === null || v === "" ? null : v)),
  krs: optionalText,
  regon: optionalText,
  address: optionalText,
  city: optionalText,
  website: optionalText,
  notes: optionalText,
};

export const clientCreateSchema = z.object({
  ...clientFields,
  segment: clientFields.segment.default("STANDARDOWY"),
  status: clientFields.status.default("PROSPEKT"),
});

export const clientUpdateSchema = nonEmptyPatch(z.object(clientFields).partial());

const contactFields = {
  fullName: z.string().trim().min(2).max(160),
  position: optionalText,
  email: z
    .union([z.string().email("Nieprawidlowy e-mail"), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === null || v === "" ? null : v)),
  phone: optionalText,
  decisionLevel: z.enum(["DECYDENT", "WPLYWOWY", "OPERACYJNY", "KONTAKT_TECHNICZNY"]),
  isPrimary: z.boolean(),
  notes: optionalText,
};

export const contactCreateSchema = z.object({
  ...contactFields,
  clientId: z.string().min(1),
  decisionLevel: contactFields.decisionLevel.default("OPERACYJNY"),
  isPrimary: contactFields.isPrimary.default(false),
});

export const contactUpdateSchema = nonEmptyPatch(z.object(contactFields).partial());

const opportunityFields = {
  clientId: z.string().min(1),
  title: z.string().trim().min(3).max(200),
  stage: z.enum(OPPORTUNITY_STAGES),
  serviceType: z.union([z.enum(SERVICE_TYPES), z.null()]).optional(),
  value: optionalMoney,
  probability: z.number().int().min(0).max(100),
  expectedCloseDate: optionalDate,
  ownerId: optionalRef,
  notes: optionalText,
};

export const opportunityCreateSchema = z.object({
  ...opportunityFields,
  stage: opportunityFields.stage.default("KONSULTACJE"),
  probability: opportunityFields.probability.default(30),
});

export const opportunityUpdateSchema = nonEmptyPatch(
  z
    .object({
      ...opportunityFields,
      status: z.enum(["OPEN", "WON", "LOST"]),
      lostReason: optionalText,
    })
    .partial(),
);

/**
 * Zamkniecie szansy — wygrana albo przegrana wraz z czynnikami decyzji.
 * Osobny schemat, bo to inna operacja niz zwykla edycja: wymaga podania
 * co najmniej jednego czynnika, zeby dane nadawaly sie do analizy.
 */
export const opportunityCloseSchema = z
  .object({
    status: z.enum(["WON", "LOST"]),
    winFactors: z.array(z.enum(WIN_FACTORS)).max(WIN_FACTORS.length).default([]),
    lossFactors: z.array(z.enum(LOSS_FACTORS)).max(LOSS_FACTORS.length).default([]),
    decisionNote: optionalText,
  })
  .refine(
    (v) =>
      v.status === "WON" ? v.winFactors.length > 0 : v.lossFactors.length > 0,
    {
      message: "Wskaz co najmniej jeden czynnik decyzji",
      path: ["winFactors"],
    },
  );

// ═══════════════════════════════════════════════════════════════════════════
//  RYZYKA, KAMIENIE MILOWE
// ═══════════════════════════════════════════════════════════════════════════

const riskFields = {
  title: z.string().trim().min(3).max(200),
  kind: z.enum(["RYZYKO", "PROBLEM"]),
  description: optionalText,
  impact: z.enum(["NISKI", "SREDNI", "WYSOKI"]),
  probability: z.enum(["NISKI", "SREDNI", "WYSOKI"]),
  mitigation: optionalText,
  ownerId: optionalRef,
  status: z.enum(["OPEN", "MITIGATED", "CLOSED"]),
  dueDate: optionalDate,
};

export const riskCreateSchema = z.object({
  ...riskFields,
  projectId: z.string().min(1),
  kind: riskFields.kind.default("RYZYKO"),
  impact: riskFields.impact.default("SREDNI"),
  probability: riskFields.probability.default("SREDNI"),
  status: riskFields.status.default("OPEN"),
});

export const riskUpdateSchema = nonEmptyPatch(z.object(riskFields).partial());

const milestoneFields = {
  name: z.string().trim().min(3).max(200),
  description: optionalText,
  phase: z.enum(PHASES),
  /// Termin jest w bazie wymagany — da sie go przesunac, nie da sie wyczyscic.
  dueDate: optionalRequiredDate,
  /// Odhaczenie jest odwracalne — null cofa realizacje.
  completedAt: optionalDate,
};

export const milestoneCreateSchema = z.object({
  ...milestoneFields,
  projectId: z.string().min(1),
  phase: milestoneFields.phase.default("EXPLORE"),
  dueDate: requiredDate,
});

export const milestoneUpdateSchema = nonEmptyPatch(z.object(milestoneFields).partial());

// ═══════════════════════════════════════════════════════════════════════════
//  UZYTKOWNICY / ADMIN
// ═══════════════════════════════════════════════════════════════════════════

const userFields = {
  fullName: z.string().trim().min(3).max(160),
  role: z.enum(ROLES),
  position: optionalText,
  fte: z.number().min(0).max(2),
  hourlyRate: optionalMoney,
};

export const userCreateSchema = z.object({
  ...userFields,
  email: z.string().email(),
  password: z.string().min(10, "Haslo ma minimum 10 znakow").max(128),
  role: userFields.role.default("CONSULTANT"),
  fte: userFields.fte.default(1),
});

export const userUpdateSchema = nonEmptyPatch(
  z
    .object({
      ...userFields,
      isActive: z.boolean(),
      password: z.union([z.string().min(10).max(128), z.null()]).optional(),
    })
    .partial(),
);

// ═══════════════════════════════════════════════════════════════════════════
//  PANEL USPRAWNIEN
// ═══════════════════════════════════════════════════════════════════════════

export const improvementCreateSchema = z.object({
  title: z.string().trim().min(5, "Tytul zgloszenia ma minimum 5 znakow").max(200),
  body: z.string().trim().min(10, "Opisz pomysl w minimum 10 znakach").max(4000),
});

export const improvementUpdateSchema = nonEmptyPatch(
  z.object({ status: z.enum(IMPROVEMENT_STATUSES), adminNote: optionalText }).partial(),
);

/**
 * Personalizacja. `defaultView` jest sciezka, na ktora przekierowuje korzen
 * serwisu — musi byc z zamknietej listy, inaczej dowolny string staje sie
 * otwartym przekierowaniem na obca domene.
 */
export const ALLOWED_DEFAULT_VIEWS = [
  "/dashboard",
  "/projects",
  "/tasks",
  "/gantt",
  "/notifications",
  "/crm",
  "/finances",
  "/experts",
  "/improvements",
] as const;

export const preferencesSchema = nonEmptyPatch(
  z
    .object({
      theme: z.enum(["light", "dark", "system"]),
      defaultView: z.enum(ALLOWED_DEFAULT_VIEWS),
      urgentDays: z.number().int().min(1).max(30),
    })
    .partial(),
);

// ═══════════════════════════════════════════════════════════════════════════
//  KOMENTARZE
// ═══════════════════════════════════════════════════════════════════════════

export const commentCreateSchema = z.object({
  taskId: z.string().min(1),
  body: z.string().trim().min(1).max(4000),
  mentions: z.array(z.string()).max(50).default([]),
});

// ═══════════════════════════════════════════════════════════════════════════
//  EKSPERCI ZEWNETRZNI
// ═══════════════════════════════════════════════════════════════════════════

const expertFields = {
  fullName: z.string().trim().min(3).max(160),
  specialty: z.string().trim().min(2).max(160),
  company: optionalText,
  email: z
    .union([z.string().email("Nieprawidlowy e-mail"), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === null || v === "" ? null : v)),
  phone: optionalText,
  hourlyRate: optionalMoney,
  availability: z.enum(["DOSTEPNY", "OGRANICZONA", "NIEDOSTEPNY"]),
  rating: z.union([z.number().int().min(1).max(5), z.null()]).optional(),
  notes: optionalText,
};

export const expertCreateSchema = z.object({
  ...expertFields,
  availability: expertFields.availability.default("DOSTEPNY"),
});

export const expertUpdateSchema = nonEmptyPatch(
  z.object({ ...expertFields, isActive: z.boolean() }).partial(),
);

export const expertAssignmentSchema = z.object({
  projectId: z.string().min(1),
  expertId: z.string().min(1),
  scope: z.string().trim().min(3, "Opisz zakres prac").max(500),
  contractValue: optionalMoney,
  startDate: optionalDate,
  endDate: optionalDate,
});

// ═══════════════════════════════════════════════════════════════════════════
//  NOTATKI ZE SPOTKAN
// ═══════════════════════════════════════════════════════════════════════════

export const meetingNoteCreateSchema = z
  .object({
    title: z.string().trim().min(3, "Tytul notatki ma minimum 3 znaki").max(200),
    meetingDate: requiredDate,
    projectId: optionalRef,
    clientId: optionalRef,
    content: optionalText,
    attendees: optionalText,
    items: z.array(z.string().trim().min(1).max(500)).max(100).default([]),
  })
  .refine((v) => !!v.projectId || !!v.clientId, {
    message: "Notatka musi dotyczyc projektu albo klienta",
    path: ["projectId"],
  });

export const meetingNoteUpdateSchema = nonEmptyPatch(
  z
    .object({
      title: z.string().trim().min(3).max(200),
      meetingDate: optionalDate,
      content: optionalText,
      attendees: optionalText,
    })
    .partial(),
);

/** Konwersja punktu notatki na zadanie — reszta pol dziedziczy sie z notatki. */
export const noteItemConvertSchema = z.object({
  assigneeId: optionalRef,
  dueDate: optionalDate,
  priority: z.enum(PRIORITIES).default("MEDIUM"),
  projectId: optionalRef,
});

// ═══════════════════════════════════════════════════════════════════════════
//  RAPORTY STATUSOWE
// ═══════════════════════════════════════════════════════════════════════════

export const statusReportCreateSchema = z.object({
  projectId: z.string().min(1),
  reportDate: requiredDate,
  ragStatus: z.enum(RAG_STATUSES),
  summary: z.string().trim().min(10, "Podsumowanie ma minimum 10 znakow").max(4000),
  budgetNote: optionalText,
});
