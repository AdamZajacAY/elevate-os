"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Pill, ragTone, RAG_BG } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dialog, dialogField, dialogLabel, readError } from "@/components/crm/Dialog";
import { RAG_STATUSES } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { DateField } from "@/components/ui/DateField";

type Report = {
  id: string;
  reportDate: string;
  ragStatus: string;
  summary: string;
  budgetNote: string | null;
  authorName: string;
};

/** Historia RAG w czasie — widac, czy projekt sie poprawia, czy osuwa. */
export function StatusReports({
  projectId,
  reports,
  currentRag,
  canWrite,
}: {
  projectId: string;
  reports: Report[];
  currentRag: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader
        title="Raporty statusowe"
        subtitle={`${reports.length} ${reports.length === 1 ? "raport" : "raportów"} — historia zdrowia projektu`}
        action={
          canWrite ? (
            <button onClick={() => setOpen(true)} className="text-[12.5px] font-semibold text-accent">
              + Nowy raport
            </button>
          ) : undefined
        }
      />
      <div className="p-3">
        {reports.length === 0 ? (
          <EmptyState
            title="Brak raportów"
            hint="Raport statusowy zapisuje ocenę RAG wraz z uzasadnieniem."
          />
        ) : (
          <>
            {/* Pasek historii RAG — najstarszy z lewej */}
            <div className="mb-3 flex items-center gap-1 px-2.5">
              {[...reports].reverse().map((r) => (
                <span
                  key={r.id}
                  title={`${formatDate(r.reportDate)} — ${r.ragStatus}`}
                  className={`h-2.5 flex-1 rounded-full ${RAG_BG[r.ragStatus] ?? "bg-border"}`}
                />
              ))}
            </div>

            <ul className="space-y-2">
              {reports.map((r) => (
                <li key={r.id} className="rounded-xl border border-border bg-surface-2 px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <Pill tone={ragTone(r.ragStatus)} dot>
                      {r.ragStatus}
                    </Pill>
                    <span className="font-mono text-[10.5px] text-muted">
                      {formatDate(r.reportDate)} · {r.authorName}
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] text-ink-soft">
                    {r.summary}
                  </p>
                  {r.budgetNote && (
                    <p className="mt-1 text-[12px] text-muted">Budżet: {r.budgetNote}</p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {open && (
        <NewReportDialog
          projectId={projectId}
          currentRag={currentRag}
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </Card>
  );
}

function NewReportDialog({
  projectId,
  currentRag,
  onClose,
  onCreated,
}: {
  projectId: string;
  currentRag: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [rag, setRag] = useState(currentRag);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/status-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        reportDate: String(form.get("reportDate") ?? ""),
        ragStatus: rag,
        summary: String(form.get("summary") ?? "").trim(),
        budgetNote: String(form.get("budgetNote") ?? "").trim(),
      }),
    });

    if (!res.ok) {
      setError(await readError(res, "Nie udało się zapisać raportu."));
      setPending(false);
      return;
    }
    onCreated();
  }

  return (
    <Dialog title="Nowy raport statusowy" onClose={onClose}>
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={dialogLabel}>Data raportu</span>
            <DateField
              
              name="reportDate"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className={dialogField}
            />
          </label>
          <label className="block">
            <span className={dialogLabel}>Ocena RAG</span>
            <select value={rag} onChange={(e) => setRag(e.target.value)} className={dialogField}>
              {RAG_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        {rag !== currentRag && (
          <p className="rounded-lg border border-warn bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
            System wylicza dla tego projektu <strong>{currentRag}</strong>. Twoja ocena różni się —
            rozjazd zostanie odnotowany w dzienniku audytu.
          </p>
        )}

        <label className="block">
          <span className={dialogLabel}>Podsumowanie</span>
          <textarea name="summary" required minLength={10} rows={4} className={dialogField} />
        </label>

        <label className="block">
          <span className={dialogLabel}>Uwagi budżetowe</span>
          <input name="budgetNote" className={dialogField} />
        </label>

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
            {pending ? "Zapisywanie…" : "Zapisz raport"}
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
