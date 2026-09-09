import { prisma } from "@/lib/prisma";
import { projectScopeWhere, canSeeFinancials } from "@/lib/rbac";
import { redactMany } from "@/lib/redact";
import { isOnTime, startOfDay } from "@/lib/format";
import type { Role } from "@/lib/domain";

/** Dane pulpitu — zawezone do zakresu roli, z finansami tylko dla uprawnionych. */
export async function getDashboardData(userId: string, role: Role) {
  const scope = projectScopeWhere(role, userId);
  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 86_400_000);

  const [projects, myTasks, overdueTasks, upcomingMilestones, openRisks] = await Promise.all([
    prisma.project.findMany({
      where: { ...scope, status: { not: "CLOSED" } },
      select: {
        id: true,
        code: true,
        name: true,
        phase: true,
        ragStatus: true,
        status: true,
        endDate: true,
        contractValue: true,
        budget: true,
        client: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.task.findMany({
      where: { assigneeId: userId, status: { not: "DONE" } },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        project: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ dueDate: "asc" }],
      take: 8,
    }),
    prisma.task.count({
      where: { assigneeId: userId, status: { not: "DONE" }, dueDate: { lt: now } },
    }),
    prisma.milestone.findMany({
      where: {
        completedAt: null,
        // Od poczatku dnia, nie od biezacej godziny — inaczej kamien milowy
        // z terminem na dzis znikal z pulpitu tego samego ranka.
        dueDate: { gte: startOfDay(now), lte: horizon },
        project: scope,
      },
      select: {
        id: true,
        name: true,
        dueDate: true,
        project: { select: { id: true, code: true, name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 6,
    }),
    prisma.risk.count({ where: { status: "OPEN", project: scope } }),
  ]);

  const byPhase = { EXPLORE: 0, ENGINEER: 0, EXECUTE: 0, ELEVATE: 0 } as Record<string, number>;
  const byRag = { GREEN: 0, AMBER: 0, RED: 0 } as Record<string, number>;
  for (const p of projects) {
    byPhase[p.phase] = (byPhase[p.phase] ?? 0) + 1;
    byRag[p.ragStatus] = (byRag[p.ragStatus] ?? 0) + 1;
  }

  // Suma wartosci umow — wylacznie dla rol z uprawnieniem finansowym (spec 04).
  const contractTotal = canSeeFinancials(role)
    ? projects.reduce((sum, p) => sum + (p.contractValue ?? 0), 0)
    : null;

  return {
    // Redakcja przez wspolny helper — recznie pisane `canSeeFinancials ? x : null`
    // bylo trzecia rownolegla implementacja tej samej reguly i nie znalo mapy
    // pol finansowych z redact.ts.
    projects: redactMany("project", role, projects),
    byPhase,
    byRag,
    myTasks,
    overdueTasks,
    upcomingMilestones,
    openRisks,
    contractTotal,
  };
}

/** Terminowosc: udzial zadan zamknietych w terminie (spec 04). */
export async function getOnTimeRatio(userId: string, role: Role): Promise<number | null> {
  const scope = projectScopeWhere(role, userId);
  const done = await prisma.task.findMany({
    where: { status: "DONE", completedAt: { not: null }, dueDate: { not: null }, project: scope },
    select: { dueDate: true, completedAt: true },
  });
  if (done.length === 0) return null;
  const onTime = done.filter((t) => isOnTime(t.completedAt!, t.dueDate!)).length;
  return Math.round((onTime / done.length) * 100);
}
