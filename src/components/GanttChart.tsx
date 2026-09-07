"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { RAG_BG } from "@/components/ui/Pill";
import { PHASE_LABEL, labelOf } from "@/lib/domain";
import { formatDate } from "@/lib/format";

type Stage = {
  id: string;
  name: string;
  phase: string;
  progress: number;
  startDate: string;
  endDate: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  ragStatus: string;
};

type Milestone = {
  id: string;
  name: string;
  dueDate: string;
  done: boolean;
  projectId: string;
};

const DAY = 86_400_000;

/**
 * Gantt wieloprojektowy renderowany jako siatka procentowa — bez biblioteki,
 * zeby wykres skalowal sie razem z szerokoscia kontenera i dzialal w obu motywach.
 */
export function GanttChart({
  stages,
  milestones,
}: {
  stages: Stage[];
  milestones: Milestone[];
}) {
  const { min, span, months, groups } = useMemo(() => {
    const starts = stages.map((s) => new Date(s.startDate).getTime());
    const ends = stages.map((s) => new Date(s.endDate).getTime());
    // Margines tygodnia z kazdej strony, zeby paski nie dotykaly krawedzi.
    const rawMin = Math.min(...starts) - 7 * DAY;
    const rawMax = Math.max(...ends) + 7 * DAY;
    const totalSpan = Math.max(rawMax - rawMin, DAY);

    // Naglowki miesiecy na osi
    const labels: { label: string; left: number }[] = [];
    const cursor = new Date(rawMin);
    cursor.setDate(1);
    cursor.setHours(0, 0, 0, 0);
    while (cursor.getTime() <= rawMax) {
      const left = ((cursor.getTime() - rawMin) / totalSpan) * 100;
      if (left >= 0 && left <= 100) {
        labels.push({
          label: cursor.toLocaleDateString("pl-PL", { month: "short", year: "2-digit" }),
          left,
        });
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // Grupowanie etapow po projekcie
    const byProject = new Map<string, { code: string; name: string; rag: string; items: Stage[] }>();
    for (const stage of stages) {
      const entry = byProject.get(stage.projectId) ?? {
        code: stage.projectCode,
        name: stage.projectName,
        rag: stage.ragStatus,
        items: [],
      };
      entry.items.push(stage);
      byProject.set(stage.projectId, entry);
    }

    return {
      min: rawMin,
      span: totalSpan,
      months: labels,
      groups: [...byProject.entries()],
    };
  }, [stages]);

  const todayLeft = ((Date.now() - min) / span) * 100;

  function position(startIso: string, endIso: string) {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    return {
      left: ((start - min) / span) * 100,
      width: Math.max(((end - start) / span) * 100, 0.6),
    };
  }

  return (
    <Card className="overflow-hidden">
      {/* Os miesiecy */}
      <div className="relative h-8 border-b border-border bg-surface-2">
        <div className="absolute inset-y-0 left-[210px] right-4">
          {months.map((m) => (
            <span
              key={m.label + m.left}
              style={{ left: `${m.left}%` }}
              className="absolute top-2 font-mono text-[10px] uppercase text-muted"
            >
              {m.label}
            </span>
          ))}
        </div>
      </div>

      <div className="divide-y divide-border">
        {groups.map(([projectId, group]) => (
          <div key={projectId} className="py-2">
            <div className="flex items-center gap-2 px-4 py-1">
              <Link
                href={`/projects/${projectId}`}
                className="font-mono text-[10.5px] text-accent hover:underline"
              >
                {group.code}
              </Link>
              <span className="truncate text-[12.5px] font-semibold text-ink">{group.name}</span>
            </div>

            {group.items.map((stage) => {
              const { left, width } = position(stage.startDate, stage.endDate);
              return (
                <div key={stage.id} className="flex items-center gap-0 px-4 py-1">
                  <div className="w-[194px] shrink-0 pr-3">
                    <p className="truncate text-[12px] text-ink-soft">{stage.name}</p>
                    <p className="font-mono text-[10px] text-muted">
                      {labelOf(PHASE_LABEL, stage.phase)} · {formatDate(stage.startDate)} →{" "}
                      {formatDate(stage.endDate)}
                    </p>
                  </div>

                  <div className="relative h-7 flex-1 rounded-md bg-surface-2">
                    {/* Linia dnia dzisiejszego */}
                    {todayLeft >= 0 && todayLeft <= 100 && (
                      <div
                        style={{ left: `${todayLeft}%` }}
                        className="absolute inset-y-0 w-px bg-accent/50"
                        aria-hidden
                      />
                    )}

                    <div
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${stage.name} · ${stage.progress}%`}
                      className={`absolute inset-y-1 overflow-hidden rounded-[5px] ${
                        RAG_BG[stage.ragStatus] ?? "bg-accent"
                      } opacity-30`}
                    />
                    <div
                      style={{ left: `${left}%`, width: `${(width * stage.progress) / 100}%` }}
                      className={`absolute inset-y-1 rounded-[5px] ${
                        RAG_BG[stage.ragStatus] ?? "bg-accent"
                      }`}
                    />

                    {/* Kamienie milowe tego projektu */}
                    {milestones
                      .filter((m) => m.projectId === projectId)
                      .map((m) => {
                        const msLeft = ((new Date(m.dueDate).getTime() - min) / span) * 100;
                        if (msLeft < 0 || msLeft > 100) return null;
                        return (
                          <span
                            key={m.id}
                            style={{ left: `calc(${msLeft}% - 5px)` }}
                            title={`${m.name} · ${formatDate(m.dueDate)}`}
                            className={`absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border ${
                              m.done ? "border-good bg-good" : "border-accent bg-surface"
                            }`}
                          />
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Card>
  );
}
