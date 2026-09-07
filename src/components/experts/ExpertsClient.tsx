"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import { RedactedValue } from "@/components/ui/Card";
import { formatMoney } from "@/lib/format";
import { ExpertDialog, AssignExpertDialog } from "@/components/experts/ExpertDialogs";

export type ExpertRow = {
  id: string;
  fullName: string;
  specialty: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  hourlyRate: number | null;
  availability: string;
  rating: number | null;
  isActive: boolean;
  openTasks: number;
  assignments: {
    id: string;
    scope: string;
    contractValue: number | null;
    projectId: string;
    projectCode: string;
    projectName: string;
    projectStatus: string;
  }[];
};

const AVAILABILITY_LABEL: Record<string, string> = {
  DOSTEPNY: "Dostępny",
  OGRANICZONA: "Ograniczona",
  NIEDOSTEPNY: "Niedostępny",
};

const AVAILABILITY_TONE: Record<string, "good" | "warn" | "crit"> = {
  DOSTEPNY: "good",
  OGRANICZONA: "warn",
  NIEDOSTEPNY: "crit",
};

export function ExpertsClient({
  experts,
  projects,
  canManage,
  showMoney,
}: {
  experts: ExpertRow[];
  projects: { id: string; code: string; name: string }[];
  canManage: boolean;
  showMoney: boolean;
}) {
  const router = useRouter();
  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<ExpertRow | null>(null);
  const [assigning, setAssigning] = useState<ExpertRow | null>(null);

  const active = experts.filter((e) => e.isActive);
  const available = active.filter((e) => e.availability === "DOSTEPNY").length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-accent">Zespół</p>
          <h1 className="mt-1 font-display text-[28px] font-black tracking-tight text-ink">
            Biblioteka ekspertów
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            {active.length} aktywnych specjalistów zewnętrznych · {available} dostępnych od zaraz
          {canManage ? " — kliknij nazwisko, żeby edytować" : ""}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setNewOpen(true)}
            className="rounded-lg bg-accent-deep px-4 py-2 text-[13.5px] font-bold text-white hover:opacity-90"
          >
            Nowy ekspert
          </button>
        )}
      </header>

      {experts.length === 0 ? (
        <EmptyState
          title="Kartoteka pusta"
          hint="Dodaj pierwszego specjalistę zewnętrznego."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {experts.map((expert) => (
            <Card key={expert.id} className={expert.isActive ? "" : "opacity-60"}>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      onClick={() => canManage && setEditing(expert)}
                      disabled={!canManage}
                      className={`text-left font-display text-[15.5px] font-bold text-ink ${
                        canManage ? "hover:text-accent" : ""
                      }`}
                    >
                      {expert.fullName}
                    </button>
                    <p className="mt-0.5 text-[12.5px] text-accent">{expert.specialty}</p>
                    {expert.company && (
                      <p className="text-[11.5px] text-muted">{expert.company}</p>
                    )}
                  </div>
                  <Pill tone={AVAILABILITY_TONE[expert.availability] ?? "neutral"} dot>
                    {AVAILABILITY_LABEL[expert.availability] ?? expert.availability}
                  </Pill>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted">
                    Stawka
                  </span>
                  <span className="font-mono text-[12.5px] text-ink">
                    {showMoney ? (
                      expert.hourlyRate ? (
                        `${formatMoney(expert.hourlyRate)}/h`
                      ) : (
                        "—"
                      )
                    ) : (
                      <RedactedValue />
                    )}
                  </span>
                </div>

                {(expert.email || expert.phone) && (
                  <p className="mt-2 text-[11.5px] text-muted">
                    {[expert.email, expert.phone].filter(Boolean).join(" · ")}
                  </p>
                )}

                <div className="mt-3">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                    Przypisania ({expert.assignments.length})
                  </p>
                  {expert.assignments.length === 0 ? (
                    <p className="mt-1 text-[12px] text-muted">brak — wolne moce</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {expert.assignments.map((a) => (
                        <li key={a.id} className="text-[12px]">
                          <Link
                            href={`/projects/${a.projectId}`}
                            className="font-mono text-[10.5px] text-accent hover:underline"
                          >
                            {a.projectCode}
                          </Link>
                          <span className="ml-1.5 text-ink-soft">{a.scope}</span>
                          {showMoney && a.contractValue !== null && (
                            <span className="ml-1.5 font-mono text-muted">
                              {formatMoney(a.contractValue)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {canManage && expert.isActive && (
                  <button
                    onClick={() => setAssigning(expert)}
                    className="mt-3 w-full rounded-lg bg-accent-soft px-3 py-1.5 text-[12px] font-bold text-accent hover:opacity-80"
                  >
                    Przypisz do projektu
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {newOpen && (
        <ExpertDialog
          showMoney={showMoney}
          onClose={() => setNewOpen(false)}
          onSaved={() => {
            setNewOpen(false);
            router.refresh();
          }}
        />
      )}

      {editing && (
        <ExpertDialog
          expert={editing}
          showMoney={showMoney}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      {assigning && (
        <AssignExpertDialog
          expert={assigning}
          projects={projects}
          showMoney={showMoney}
          onClose={() => setAssigning(null)}
          onAssigned={() => {
            setAssigning(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
