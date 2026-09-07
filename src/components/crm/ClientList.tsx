"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  CLIENT_STATUSES,
  CLIENT_STATUS_LABEL,
  CLIENT_SEGMENT_LABEL,
  labelOf,
} from "@/lib/domain";
import { formatDate, daysUntil } from "@/lib/format";
import { ClientDialog } from "@/components/crm/ClientDialog";

export type ClientRow = {
  id: string;
  name: string;
  industry: string | null;
  segment: string;
  status: string;
  city: string | null;
  nip: string | null;
  lastContactAt: string | null;
  contacts: number;
  projects: number;
  opportunities: number;
};

/** Po ilu dniach ciszy klient trafia do przypomnienia o kontakcie (spec 05). */
const SILENCE_THRESHOLD_DAYS = 30;

const STATUS_TONE: Record<string, "good" | "accent" | "warn" | "crit" | "neutral"> = {
  STALY: "good",
  AKTYWNY: "accent",
  PROSPEKT: "warn",
  NIEAKTYWNY: "neutral",
  UTRACONY: "crit",
};

export function ClientList({ clients }: { clients: ClientRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      if (status && c.status !== status) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.industry ?? "").toLowerCase().includes(q) ||
        (c.nip ?? "").includes(q)
      );
    });
  }, [clients, query, status]);

  // Klienci bez kontaktu od progu dni — nie licza sie utraceni ani nieaktywni.
  const silent = clients.filter((c) => {
    if (c.status === "UTRACONY" || c.status === "NIEAKTYWNY") return false;
    const days = daysUntil(c.lastContactAt);
    return days === null || days < -SILENCE_THRESHOLD_DAYS;
  });

  const inputClass =
    "rounded-lg border border-border bg-surface px-3 py-1.5 text-[13px] text-ink outline-none focus:border-accent";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj po nazwie, branży, NIP…"
          className={`${inputClass} min-w-[240px] flex-1`}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
          <option value="">Wszystkie statusy</option>
          {CLIENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CLIENT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <button
          onClick={() => setDialogOpen(true)}
          className="rounded-lg bg-accent-deep px-4 py-2 text-[13.5px] font-bold text-white hover:opacity-90"
        >
          Nowy klient
        </button>
      </div>

      {silent.length > 0 && (
        <div className="rounded-xl border border-warn bg-warn-soft px-4 py-3 text-[13px] text-warn">
          <strong className="font-semibold">Bez kontaktu ponad {SILENCE_THRESHOLD_DAYS} dni:</strong>{" "}
          {silent.map((c) => c.name).join(", ")}
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState title="Brak klientów w tym widoku" hint="Zmień filtry albo dodaj klienta." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left font-mono text-[10.5px] uppercase tracking-wider text-muted">
                <th className="px-4 py-3">Klient</th>
                <th className="px-4 py-3">Branża</th>
                <th className="px-4 py-3">Segment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Projekty</th>
                <th className="px-4 py-3 text-right">Szanse</th>
                <th className="px-4 py-3">Ostatni kontakt</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const days = daysUntil(c.lastContactAt);
                const stale = days === null || days < -SILENCE_THRESHOLD_DAYS;
                return (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <Link
                        href={`/crm/clients/${c.id}`}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {c.name}
                      </Link>
                      {c.city && (
                        <span className="ml-2 font-mono text-[10.5px] text-muted">{c.city}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{c.industry ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">
                      {labelOf(CLIENT_SEGMENT_LABEL, c.segment)}
                    </td>
                    <td className="px-4 py-3">
                      <Pill tone={STATUS_TONE[c.status] ?? "neutral"} dot>
                        {labelOf(CLIENT_STATUS_LABEL, c.status)}
                      </Pill>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[12px] text-ink">
                      {c.projects}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[12px] text-ink">
                      {c.opportunities}
                    </td>
                    <td
                      className={`px-4 py-3 font-mono text-[11.5px] ${
                        stale ? "text-warn" : "text-muted"
                      }`}
                    >
                      {formatDate(c.lastContactAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {dialogOpen && (
        <ClientDialog
          onClose={() => setDialogOpen(false)}
          onSaved={() => {
            setDialogOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
