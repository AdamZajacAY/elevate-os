"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dialog, dialogField, dialogLabel, readError } from "@/components/crm/Dialog";
import {
  PROJECT_MEMBER_ROLES,
  PROJECT_MEMBER_ROLE_LABEL,
  labelOf,
} from "@/lib/domain";

export type MemberRow = {
  id: string;
  userId: string;
  fullName: string;
  position: string | null;
  role: string;
  allocation: number | null;
  openTasks: number;
};

/**
 * Skład zespołu projektowego.
 *
 * Przynależność do projektu wynikała dotąd wyłącznie z przypisań zadań — osoba
 * bez zadania nie istniała w projekcie, mimo że mogła nim kierować albo doradzać.
 * Nie dało się też zaplanować czyjegoś udziału, zanim powstało pierwsze zadanie.
 */
export function ProjectTeam({
  projectId,
  members,
  candidates,
  canEdit,
}: {
  projectId: string;
  members: MemberRow[];
  candidates: { id: string; fullName: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setRole(member: MemberRow, role: string) {
    setError(null);
    const res = await fetch(`/api/project-members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      setError(await readError(res, "Nie udało się zmienić roli."));
      return;
    }
    router.refresh();
  }

  async function remove(member: MemberRow) {
    setError(null);
    const res = await fetch(`/api/project-members/${member.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError(await readError(res, "Nie udało się usunąć z zespołu."));
      return;
    }
    router.refresh();
  }

  // Ktoś już w zespole nie powinien być na liście do dodania.
  const inTeam = new Set(members.map((m) => m.userId));
  const available = candidates.filter((c) => !inTeam.has(c.id));
  const totalAllocation = members.reduce((sum, m) => sum + (m.allocation ?? 0), 0);

  return (
    <Card>
      <CardHeader
        title="Zespół projektowy"
        subtitle={
          members.length === 0
            ? "Kto pracuje nad tym projektem"
            : `${members.length} ${members.length === 1 ? "osoba" : "osób"}${
                totalAllocation > 0 ? ` · ${totalAllocation.toFixed(2)} FTE zaplanowane` : ""
              }`
        }
        action={
          canEdit && available.length > 0 ? (
            <button
              onClick={() => setAddOpen(true)}
              className="text-[12.5px] font-semibold text-accent"
            >
              + Dodaj osobę
            </button>
          ) : undefined
        }
      />
      <div className="p-3">
        {error && (
          <p className="mb-2 rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[12.5px] text-crit">
            {error}
          </p>
        )}

        {members.length === 0 ? (
          <EmptyState
            title="Zespół nieokreślony"
            hint="Dodaj osoby, żeby było widać, kto pracuje nad projektem — także zanim powstaną zadania."
          />
        ) : (
          <ul className="space-y-1">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] text-ink">{m.fullName}</span>
                  <span className="block truncate text-[11.5px] text-muted">
                    {[m.position, m.allocation ? `${m.allocation} FTE` : null]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </span>
                </span>

                {m.openTasks > 0 && (
                  <Pill tone="accent">
                    {m.openTasks} {m.openTasks === 1 ? "zadanie" : "zadań"}
                  </Pill>
                )}

                {canEdit ? (
                  <select
                    value={m.role}
                    onChange={(e) => setRole(m, e.target.value)}
                    aria-label={`Rola ${m.fullName} w projekcie`}
                    className="shrink-0 rounded-lg border border-border bg-surface px-2 py-0.5 text-[11px] text-ink-soft outline-none focus:border-accent"
                  >
                    {PROJECT_MEMBER_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {PROJECT_MEMBER_ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Pill tone="neutral">{labelOf(PROJECT_MEMBER_ROLE_LABEL, m.role)}</Pill>
                )}

                {canEdit && (
                  <button
                    onClick={() => remove(m)}
                    title="Usuń z zespołu"
                    className="shrink-0 text-[11.5px] text-muted hover:text-crit"
                  >
                    usuń
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {addOpen && (
        <AddMemberDialog
          projectId={projectId}
          candidates={available}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            router.refresh();
          }}
        />
      )}
    </Card>
  );
}

function AddMemberDialog({
  projectId,
  candidates,
  onClose,
  onSaved,
}: {
  projectId: string;
  candidates: { id: string; fullName: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const text = (k: string) => String(form.get(k) ?? "").trim();
    const alloc = text("allocation");

    const res = await fetch("/api/project-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        userId: text("userId"),
        role: text("role"),
        allocation: alloc === "" ? null : Number(alloc.replace(",", ".")),
      }),
    });

    if (!res.ok) {
      setError(await readError(res, "Nie udało się dodać do zespołu."));
      setPending(false);
      return;
    }
    onSaved();
  }

  return (
    <Dialog title="Dodaj do zespołu" onClose={onClose}>
      <form onSubmit={save} className="mt-5 space-y-4">
        <label className="block">
          <span className={dialogLabel}>Osoba</span>
          <select name="userId" required className={dialogField} defaultValue="">
            <option value="" disabled>
              Wybierz…
            </option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={dialogLabel}>Rola w projekcie</span>
            <select name="role" className={dialogField} defaultValue="KONSULTANT">
              {PROJECT_MEMBER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {PROJECT_MEMBER_ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={dialogLabel}>Planowany udział (FTE)</span>
            <input
              name="allocation"
              inputMode="decimal"
              placeholder="np. 0,25"
              className={dialogField}
            />
          </label>
        </div>

        <p className="text-[12px] text-muted">
          Udział to ułamek etatu przeznaczony na ten projekt. Zostawiony pusty nie przeszkadza —
          skład zespołu ma sens także bez planowania czasu.
        </p>

        {error && (
          <p className="rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[13px] text-crit">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent-deep px-5 py-2.5 text-[14px] font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Dodawanie…" : "Dodaj"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-5 py-2.5 text-[14px] font-semibold text-ink-soft hover:bg-surface-2"
          >
            Anuluj
          </button>
        </div>
      </form>
    </Dialog>
  );
}
