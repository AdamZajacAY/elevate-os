import { prisma } from "@/lib/prisma";
import {
  BILLING_PERIOD_MONTHS,
  type BillingPeriod,
  type Role,
} from "@/lib/domain";
import { canSeeFinancials } from "@/lib/rbac";

/**
 * Rentownosc i obciazenie (spec 04).
 *
 * Koszt rzeczywisty projektu = godziny z TimeLog × stawka + wartosci umow
 * podwykonawcow. Zrodlem godzin jest wylacznie TimeLog — Task.actualHours to
 * suma pochodna, wygodna do wyswietlania, ale nie do liczenia pieniedzy.
 *
 * Stawka: `rateSnapshot` zamrozony przy zapisie wpisu, z odwrotem na biezaca
 * stawke uzytkownika, gdy wpis powstal przed wprowadzeniem stawki.
 */

/**
 * Przychod projektu abonamentowego.
 *
 * Wartosc umowy nie opisuje abonamentu: przy umowie bezterminowej jej po prostu
 * nie ma, a przy terminowej myli sie z tym, co juz zafakturowano. Liczymy wiec
 * przychod **do dzisiaj** — kwota za okres razy liczba okresow, ktore minely.
 *
 * Okres liczy sie jako rozpoczety: klient placi z gory za caly miesiac,
 * wiec pierwszego dnia okresu przychod juz istnieje.
 */
function recurringRevenueToDate(p: {
  billingModel: string;
  billingPeriod: string | null;
  recurringAmount: number | null;
  billingStartDate: Date | null;
  billingEndDate: Date | null;
}): number | null {
  if (p.billingModel !== "ABONAMENT") return null;
  if (!p.billingPeriod || p.recurringAmount === null || !p.billingStartDate) return null;

  const months = BILLING_PERIOD_MONTHS[p.billingPeriod as BillingPeriod];
  if (!months) return null;

  const now = new Date();
  // Umowa zakonczona nie nalicza sie dalej.
  const until = p.billingEndDate && p.billingEndDate < now ? p.billingEndDate : now;
  if (until < p.billingStartDate) return 0;

  const monthsElapsed =
    (until.getFullYear() - p.billingStartDate.getFullYear()) * 12 +
    (until.getMonth() - p.billingStartDate.getMonth()) +
    (until.getDate() >= p.billingStartDate.getDate() ? 0 : -1);

  const periods = Math.floor(monthsElapsed / months) + 1;
  return Math.max(periods, 0) * p.recurringAmount;
}

/** Wartosc miesieczna abonamentu (MRR) — porownywalna miedzy okresami rozliczeniowymi. */
function monthlyRecurring(p: {
  billingModel: string;
  billingPeriod: string | null;
  recurringAmount: number | null;
  billingEndDate: Date | null;
  status: string;
}): number {
  if (p.billingModel !== "ABONAMENT" || p.status === "CLOSED") return 0;
  if (!p.billingPeriod || p.recurringAmount === null) return 0;
  // Umowa, ktora juz sie skonczyla, nie generuje przychodu powtarzalnego.
  if (p.billingEndDate && p.billingEndDate < new Date()) return 0;

  const months = BILLING_PERIOD_MONTHS[p.billingPeriod as BillingPeriod];
  return months ? p.recurringAmount / months : 0;
}

export type ProjectFinance = {
  id: string;
  code: string;
  name: string;
  clientId: string;
  clientName: string;
  billingModel: string;
  billingPeriod: string | null;
  recurringAmount: number | null;
  /// Przychod naliczony do dzisiaj — dla abonamentu z okresow, dla jednorazowego wartosc umowy
  revenue: number | null;
  /// Miesieczny przychod powtarzalny; 0 dla projektow jednorazowych
  mrr: number;
  isOpenEnded: boolean;
  phase: string;
  status: string;
  ragStatus: string;
  contractValue: number | null;
  budget: number | null;
  laborCost: number;
  subcontractorCost: number;
  totalCost: number;
  margin: number | null;
  marginPct: number | null;
  hours: number;
};

export async function getProjectFinance(): Promise<ProjectFinance[]> {
  const projects = await prisma.project.findMany({
    include: {
      client: { select: { id: true, name: true } },
      timeLogs: {
        select: { hours: true, rateSnapshot: true, user: { select: { hourlyRate: true } } },
      },
      experts: { select: { contractValue: true } },
    },
    orderBy: [{ status: "asc" }, { code: "asc" }],
  });

  return projects.map((p) => {
    const laborCost = p.timeLogs.reduce(
      (sum, log) => sum + log.hours * (log.rateSnapshot ?? log.user.hourlyRate ?? 0),
      0,
    );
    const subcontractorCost = p.experts.reduce((sum, e) => sum + (e.contractValue ?? 0), 0);
    const totalCost = laborCost + subcontractorCost;
    const hours = p.timeLogs.reduce((sum, log) => sum + log.hours, 0);

    // Marza tylko tam, gdzie jest z czego liczyc — projekt bez wartosci umowy
    // nie ma marzy zero, ma marze nieznana.
    // Przychod: abonament liczy sie z okresow, jednorazowy z wartosci umowy.
    const recurring = recurringRevenueToDate(p);
    const revenue = recurring ?? p.contractValue;

    const margin = revenue === null ? null : revenue - totalCost;
    const marginPct =
      revenue === null || revenue === 0
        ? null
        : Math.round(((revenue - totalCost) / revenue) * 100);

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      clientId: p.client.id,
      clientName: p.client.name,
      phase: p.phase,
      status: p.status,
      ragStatus: p.ragStatus,
      contractValue: p.contractValue,
      budget: p.budget,
      billingModel: p.billingModel,
      billingPeriod: p.billingPeriod,
      recurringAmount: p.recurringAmount,
      revenue,
      mrr: monthlyRecurring(p),
      // Abonament bez daty konca — trwa do wypowiedzenia.
      isOpenEnded: p.billingModel === "ABONAMENT" && p.billingEndDate === null,
      laborCost,
      subcontractorCost,
      totalCost,
      margin,
      marginPct,
      hours,
    };
  });
}

export type ClientFinance = {
  clientId: string;
  clientName: string;
  segment: string;
  projects: number;
  revenue: number;
  cost: number;
  margin: number;
};

/** Rentownosc per klient — agregat po projektach. */
/**
  * Przyjmuje gotowe dane projektow zamiast liczyc je ponownie — `getProjectFinance`
  * dociaga wszystkie wpisy czasu portfela i jest najdrozszym zapytaniem w systemie.
  * Wolajacy i tak go potrzebuje, wiec liczymy je raz na zadanie.
  */
export async function getClientFinance(projects: ProjectFinance[]): Promise<ClientFinance[]> {
  const clients = await prisma.client.findMany({
    select: { id: true, name: true, segment: true },
  });
  // Grupowanie po id, nie po nazwie: nic nie wymusza unikalnosci nazwy klienta,
  // a dwoch klientow o tej samej nazwie sumowalo sobie nawzajem przychod i koszt.
  const byClientId = new Map<string, ProjectFinance[]>();
  for (const p of projects) {
    byClientId.set(p.clientId, [...(byClientId.get(p.clientId) ?? []), p]);
  }

  return clients
    .map((c) => {
      const rows = byClientId.get(c.id) ?? [];
      const revenue = rows.reduce((sum, r) => sum + (r.revenue ?? 0), 0);
      const cost = rows.reduce((sum, r) => sum + r.totalCost, 0);
      return {
        clientId: c.id,
        clientName: c.name,
        segment: c.segment,
        projects: rows.length,
        revenue,
        cost,
        margin: revenue - cost,
      };
    })
    .filter((c) => c.projects > 0)
    .sort((a, b) => b.revenue - a.revenue);
}

export type ConsultantLoad = {
  userId: string;
  fullName: string;
  position: string | null;
  role: string;
  fte: number;
  hours: number;
  capacityHours: number;
  utilizationPct: number;
  projects: number;
  cost: number;
};

/** Ile dni roboczych (pn–pt) mieści się w zadanym oknie. */
function workdaysBetween(from: Date, to: Date): number {
  let count = 0;
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= to) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/**
 * Obciazenie zespolu (spec 04) — kto ma wolne moce na nowy projekt.
 * Zdolnosc = FTE × 8h × dni robocze w oknie; wykorzystanie = godziny / zdolnosc.
 */
export async function getTeamLoad(days = 30): Promise<ConsultantLoad[]> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const capacityDays = workdaysBetween(from, to);

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      fullName: true,
      position: true,
      role: true,
      fte: true,
      hourlyRate: true,
      timeLogs: {
        where: { workDate: { gte: from, lte: to } },
        select: { hours: true, rateSnapshot: true, projectId: true },
      },
    },
    orderBy: { fullName: "asc" },
  });

  return users.map((u) => {
    const hours = u.timeLogs.reduce((sum, log) => sum + log.hours, 0);
    const cost = u.timeLogs.reduce(
      (sum, log) => sum + log.hours * (log.rateSnapshot ?? u.hourlyRate ?? 0),
      0,
    );
    const capacityHours = u.fte * 8 * capacityDays;
    return {
      userId: u.id,
      fullName: u.fullName,
      position: u.position,
      role: u.role,
      fte: u.fte,
      hours,
      capacityHours,
      utilizationPct: capacityHours === 0 ? 0 : Math.round((hours / capacityHours) * 100),
      projects: new Set(u.timeLogs.map((log) => log.projectId)).size,
      cost,
    };
  });
}

export type Timeliness = {
  tasksOnTime: number;
  tasksTotal: number;
  tasksPct: number | null;
  milestonesOnTime: number;
  milestonesTotal: number;
  milestonesPct: number | null;
  overdueTasks: number;
  overdueMilestones: number;
};

/** Terminowosc: udzial zadan i kamieni milowych zamknietych w terminie (spec 04). */
export async function getTimeliness(): Promise<Timeliness> {
  const now = new Date();
  const [tasks, milestones, overdueTasks, overdueMilestones] = await Promise.all([
    prisma.task.findMany({
      where: { status: "DONE", completedAt: { not: null }, dueDate: { not: null } },
      select: { dueDate: true, completedAt: true },
    }),
    prisma.milestone.findMany({
      where: { completedAt: { not: null } },
      select: { dueDate: true, completedAt: true },
    }),
    prisma.task.count({ where: { status: { not: "DONE" }, dueDate: { lt: now } } }),
    prisma.milestone.count({ where: { completedAt: null, dueDate: { lt: now } } }),
  ]);

  const tasksOnTime = tasks.filter((t) => t.completedAt! <= t.dueDate!).length;
  const milestonesOnTime = milestones.filter((m) => m.completedAt! <= m.dueDate).length;

  return {
    tasksOnTime,
    tasksTotal: tasks.length,
    tasksPct: tasks.length === 0 ? null : Math.round((tasksOnTime / tasks.length) * 100),
    milestonesOnTime,
    milestonesTotal: milestones.length,
    milestonesPct:
      milestones.length === 0 ? null : Math.round((milestonesOnTime / milestones.length) * 100),
    overdueTasks,
    overdueMilestones,
  };
}

export type PipelineValue = {
  stage: string;
  count: number;
  value: number;
  weightedValue: number;
};

/** Pipeline wartosci — przychod prognozowany obok przychodu z realizacji (spec 04). */
export async function getPipelineValue(): Promise<PipelineValue[]> {
  const opportunities = await prisma.opportunity.findMany({
    where: { status: "OPEN" },
    select: { stage: true, value: true, probability: true },
  });

  const byStage = new Map<string, PipelineValue>();
  for (const o of opportunities) {
    const entry = byStage.get(o.stage) ?? { stage: o.stage, count: 0, value: 0, weightedValue: 0 };
    entry.count += 1;
    entry.value += o.value ?? 0;
    // Wazenie prawdopodobienstwem — prognoza, nie lista zyczen.
    entry.weightedValue += ((o.value ?? 0) * o.probability) / 100;
    byStage.set(o.stage, entry);
  }
  return [...byStage.values()];
}

/** Komplet danych raportu executive — jedno wywolanie zamiast pieciu. */
export async function getExecutiveReport(role: Role) {
  if (!canSeeFinancials(role)) throw new Error("Brak uprawnien finansowych");

  const [projects, team, timeliness, pipeline] = await Promise.all([
    getProjectFinance(),
    getTeamLoad(),
    getTimeliness(),
    getPipelineValue(),
  ]);
  const clients = await getClientFinance(projects);

  const active = projects.filter((p) => p.status !== "CLOSED");
  const revenue = active.reduce((sum, p) => sum + (p.revenue ?? 0), 0);
  const cost = active.reduce((sum, p) => sum + p.totalCost, 0);
  const mrr = active.reduce((sum, p) => sum + p.mrr, 0);

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      activeProjects: active.length,
      revenue,
      cost,
      margin: revenue - cost,
      marginPct: revenue === 0 ? null : Math.round(((revenue - cost) / revenue) * 100),
      hours: active.reduce((sum, p) => sum + p.hours, 0),
      pipelineWeighted: pipeline.reduce((sum, s) => sum + s.weightedValue, 0),
      // Przychod powtarzalny — baza, ktora firma ma co miesiac bez nowej sprzedazy.
      mrr,
      recurringProjects: active.filter((p) => p.billingModel === "ABONAMENT").length,
    },
    projects,
    clients,
    team,
    timeliness,
    pipeline,
  };
}
