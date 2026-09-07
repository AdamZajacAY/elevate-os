"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dialog, dialogField, dialogLabel, readError } from "@/components/crm/Dialog";
import { DateField } from "@/components/ui/DateField";
import { RISK_STATUSES, RISK_STATUS_LABEL, labelOf } from "@/lib/domain";
import { formatDate } from "@/lib/format";

export type RiskRow = {
  id: string;
  title: string;
  kind: string;
  description: string | null;
  impact: string;
  probability: string;
  mitigation: string | null;
  status: string;
  ownerId: string | null;
  ownerName: string | null;
  dueDate: string | null;
};

const LEVELS = ["NISKI", "SREDNI", "WYSOKI"] as const;
const LEVEL_LABEL: Record<string, string> = {
  NISKI: "Niski",
  SREDNI: "Średni",
  WYSOKI: "Wysoki",
};

/**
 * Rejestr ryzyk i problemów.
 *
 * Wpływ i prawdopodobieństwo nie są ozdobą: otwarte ryzyko o wysokim wpływie
 * przestawia RAG na amber, a wysoki wpływ razem z wysokim prawdopodobieństwem
 * — na red. Dlatego każda zmiana przelicza RAG po stronie serwera.
 */
export function Risks({
  projectId,
  risks,
  owners,
  canEdit,
}: {
  projectId: string;
  risks: RiskRow[];
  owners: { id: string; fullName: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ mode: "new" } | { mode: "edit"; item: RiskRow } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(item: RiskRow, status: string) {
    setError(null);
    const res = await fetch(`/api/risks/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setError(await readError(res, "Nie udało się zmienić statusu ryzyka."));
      return;
    }
    router.refresh();
  }

  const open = risks.filter((r) => r.status === "OPEN").length;

  return (
    <Card>
      <CardHeader
        title="Ryzyka i problemy"
        subtitle={
          risks.length === 0
            ? "Zasila status RAG projektu"
            : `${open} otwartych z ${risks.length} — zasila status RAG`
        }
        action={
          canEdit ? (
            <button
              onClick={() => setDialog({ mode: "new" })}
              className="text-[12.5px] font-semibold text-accent"
            >
              + Dodaj
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

        {risks.length === 0 ? (
          <EmptyState
            title="Rejestr ryzyk pusty"
            hint="Co może wywrócić ten projekt i co z tym robimy."
          />
        ) : (
          <ul className="space-y-1">
            {risks.map((r) => (
              <li key={r.id} className="rounded-xl px-2.5 py-2 hover:bg-surface-2">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => canEdit && setDialog({ mode: "edit", item: r })}
                    disabled={!canEdit}
                    className={`min-w-0 flex-1 truncate text-left text-[13.5px] ${
                      r.status === "OPEN" ? "text-ink" : "text-muted line-through"
                    } ${canEdit ? "hover:text-accent" : ""}`}
                  >
                    {r.title}
                  </button>
                  {r.kind === "PROBLEM" && <Pill tone="crit">problem</Pill>}
                  <Pill tone={r.impact === "WYSOKI" ? "crit" : r.impact === "SREDNI" ? "warn" : "neutral"}>
                    wpływ {LEVEL_LABEL[r.impact].toLowerCase()}
                  </Pill>
                  {canEdit ? (
                    <select
                      value={r.status}
                      onChange={(e) => setStatus(r, e.target.value)}
                      aria-label={`Status ryzyka ${r.title}`}
                      className="shrink-0 rounded-lg border border-border bg-surface px-2 py-0.5 text-[11px] text-ink-soft outline-none focus:border-accent"
                    >
                      {RISK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {RISK_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Pill tone={r.status === "OPEN" ? "warn" : "good"}>
                      {labelOf(RISK_STATUS_LABEL, r.status)}
                    </Pill>
                  )}
                </div>
                {r.mitigation && (
                  <p className="mt-1 text-[12px] text-muted">Mitygacja: {r.mitigation}</p>
                )}
                {(r.ownerName || r.dueDate) && (
                  <p className="mt-0.5 font-mono text-[10.5px] text-muted">
                    {[r.ownerName, r.dueDate ? formatDate(r.dueDate) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {dialog && (
        <RiskDialog
          projectId={projectId}
          owners={owners}
          item={dialog.mode === "edit" ? dialog.item : undefined}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            router.refresh();
          }}
        />
      )}
    </Card>
  );
}

function RiskDialog({
  projectId,
  owners,
  item,
  onClose,
  onSaved,
}: {
  projectId: string;
  owners: { id: string; fullName: string }[];
  item?: RiskRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!item;
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const text = (k: string) => String(form.get(k) ?? "").trim();

    const res = await fetch(isEdit ? `/api/risks/${item.id}` : "/api/risks", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(isEdit ? {} : { projectId }),
        title: text("title"),
        kind: text("kind"),
        description: text("description"),
        impact: text("impact"),
        probability: text("probability"),
        mitigation: text("mitigation"),
        ownerId: text("ownerId") || null,
        status: text("status"),
        dueDate: text("dueDate") || null,
      }),
    });

    if (!res.ok) {
      setError(await readError(res, "Nie udało się zapisać ryzyka."));
      setPending(false);
      return;
    }
    onSaved();
  }

  async function remove() {
    if (!item) return;
    setPending(true);
    const res = await fetch(`/api/risks/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError(await readError(res, "Nie udało się usunąć."));
      setPending(false);
      setConfirmDelete(false);
      return;
    }
    onSaved();
  }

  return (
    <Dialog title={isEdit ? `Edycja: ${item.title}` : "Nowe ryzyko"} onClose={onClose}>
      <form onSubmit={save} className="mt-5 space-y-4">
        <label className="block">
          <span className={dialogLabel}>Tytuł</span>
          <input
            name="title"
            required
            minLength={3}
            defaultValue={item?.title ?? ""}
            className={dialogField}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={dialogLabel}>Rodzaj</span>
            <select name="kind" className={dialogField} defaultValue={item?.kind ?? "RYZYKO"}>
              <option value="RYZYKO">Ryzyko — może się wydarzyć</option>
              <option value="PROBLEM">Problem — już się dzieje</option>
            </select>
          </label>
          <label className="block">
            <span className={dialogLabel}>Status</span>
            <select name="status" className={dialogField} defaultValue={item?.status ?? "OPEN"}>
              {RISK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {RISK_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={dialogLabel}>Wpływ</span>
            <select name="impact" className={dialogField} defaultValue={item?.impact ?? "SREDNI"}>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABEL[l]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={dialogLabel}>Prawdopodobieństwo</span>
            <select
              name="probability"
              className={dialogField}
              defaultValue={item?.probability ?? "SREDNI"}
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABEL[l]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={dialogLabel}>Właściciel</span>
            <select name="ownerId" className={dialogField} defaultValue={item?.ownerId ?? ""}>
              <option value="">nieprzypisany</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={dialogLabel}>Termin reakcji</span>
            <DateField
              name="dueDate"
              defaultValue={item?.dueDate ? item.dueDate.slice(0, 10) : ""}
              className={dialogField}
            />
          </label>
        </div>

        <label className="block">
          <span className={dialogLabel}>Plan mitygacji</span>
          <textarea
            name="mitigation"
            rows={2}
            placeholder="Co robimy, żeby to nie wybuchło"
            defaultValue={item?.mitigation ?? ""}
            className={dialogField}
          />
        </label>

        <label className="block">
          <span className={dialogLabel}>Opis</span>
          <textarea
            name="description"
            rows={2}
            defaultValue={item?.description ?? ""}
            className={dialogField}
          />
        </label>

        <p className="text-[12px] text-muted">
          Otwarte ryzyko o wysokim wpływie przestawia RAG projektu na amber; wysoki wpływ razem
          z wysokim prawdopodobieństwem — na red.
        </p>

        {error && (
          <p className="rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[13px] text-crit">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent-deep px-5 py-2.5 text-[14px] font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Zapisywanie…" : isEdit ? "Zapisz zmiany" : "Dodaj"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-5 py-2.5 text-[14px] font-semibold text-ink-soft hover:bg-surface-2"
          >
            Anuluj
          </button>
          {isEdit && (
            <span className="ml-auto">
              {confirmDelete ? (
                <button
                  type="button"
                  onClick={remove}
                  className="rounded-lg bg-crit px-4 py-2.5 text-[13px] font-bold text-white hover:opacity-90"
                >
                  Potwierdzam
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-lg px-4 py-2.5 text-[13px] font-semibold text-muted hover:text-crit"
                >
                  Usuń…
                </button>
              )}
            </span>
          )}
        </div>
      </form>
    </Dialog>
  );
}
