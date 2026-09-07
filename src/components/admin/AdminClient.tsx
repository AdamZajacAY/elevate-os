"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import { readError } from "@/components/crm/Dialog";
import { ROLES, ROLE_LABEL } from "@/lib/domain";
import { formatMoney, formatDate } from "@/lib/format";
import { NewUserDialog } from "@/components/admin/NewUserDialog";
import { BackupsPanel } from "@/components/admin/BackupsPanel";
import { CalendarPanel } from "@/components/admin/CalendarPanel";
import { GdprPanel } from "@/components/admin/GdprPanel";

type UserRow = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  anonymized: boolean;
  position: string | null;
  fte: number;
  hourlyRate: number | null;
  lastLoginAt: string | null;
  ownedProjects: number;
  tasks: number;
};

type Label = {
  id: string;
  kind: string;
  value: string;
  label: string;
  color: string;
  isActive: boolean;
};

type AuditRow = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  userName: string;
  createdAt: string;
};

type Tab = "konta" | "slowniki" | "platforma" | "rodo" | "dziennik";

const TAB_LABEL: Record<Tab, string> = {
  konta: "Konta i role",
  slowniki: "Słowniki",
  platforma: "Platforma",
  rodo: "RODO",
  dziennik: "Dziennik audytu",
};

export function AdminClient({
  users,
  labels,
  auditLog,
  backups,
  gdprClients,
  gdprRequests,
  currentUserId,
}: {
  users: UserRow[];
  labels: Label[];
  auditLog: AuditRow[];
  backups: { name: string; sizeBytes: number; createdAt: string }[];
  gdprClients: { id: string; label: string; anonymized: boolean }[];
  gdprRequests: {
    id: string;
    kind: string;
    subjectType: string;
    subjectId: string;
    subjectLabel: string;
    status: string;
    note: string | null;
    createdAt: string;
  }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("konta");
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patchUser(id: string, patch: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      setError(await readError(res, "Nie udało się zapisać zmiany."));
      return;
    }
    router.refresh();
  }

  const activeAdmins = users.filter((u) => u.role === "ADMIN" && u.isActive).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-accent">Platforma</p>
          <h1 className="mt-1 font-display text-[28px] font-black tracking-tight text-ink">
            Administracja
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            {users.filter((u) => u.isActive).length} aktywnych kont · {activeAdmins}{" "}
            {activeAdmins === 1 ? "administrator" : "administratorów"}
          </p>
        </div>
        {tab === "konta" && (
          <button
            onClick={() => setNewUserOpen(true)}
            className="rounded-lg bg-accent-deep px-4 py-2 text-[13.5px] font-bold text-white hover:opacity-90"
          >
            Nowe konto
          </button>
        )}
      </header>

      <div className="flex rounded-lg border border-border bg-surface p-0.5 w-fit">
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-[6px] px-4 py-1.5 text-[13px] font-semibold transition-colors ${
              tab === t ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[13px] text-crit">
          {error}
        </p>
      )}

      {tab === "konta" && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left font-mono text-[10.5px] uppercase tracking-wider text-muted">
                <th className="px-4 py-3">Osoba</th>
                <th className="px-4 py-3">Rola</th>
                <th className="px-4 py-3 text-right">FTE</th>
                <th className="px-4 py-3 text-right">Stawka</th>
                <th className="px-4 py-3 text-right">Projekty</th>
                <th className="px-4 py-3">Ostatnie logowanie</th>
                <th className="px-4 py-3">Konto</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                // Ostatniego aktywnego administratora nie da sie wylaczyc ani zdegradowac.
                const isLastAdmin = u.role === "ADMIN" && u.isActive && activeAdmins <= 1;
                return (
                  <tr
                    key={u.id}
                    className={`border-b border-border last:border-0 hover:bg-surface-2 ${
                      u.isActive ? "" : "opacity-55"
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <span className="block font-medium text-ink">{u.fullName}</span>
                      <span className="block font-mono text-[10.5px] text-muted">{u.email}</span>
                      {u.position && (
                        <span className="block text-[11.5px] text-muted">{u.position}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={u.role}
                        disabled={isLastAdmin}
                        onChange={(e) => patchUser(u.id, { role: e.target.value })}
                        aria-label={`Rola konta ${u.fullName}`}
                        className="rounded-lg border border-border bg-surface px-2 py-1 text-[12px] text-ink outline-none focus:border-accent disabled:opacity-50"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] text-ink-soft">
                      {u.fte}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] text-ink-soft">
                      {u.hourlyRate ? `${formatMoney(u.hourlyRate)}/h` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] text-ink-soft">
                      {u.ownedProjects}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-muted">
                      {u.lastLoginAt ? formatDate(u.lastLoginAt) : "nigdy"}
                    </td>
                    <td className="px-4 py-2.5">
                      {isLastAdmin ? (
                        <Pill tone="crit">ostatni admin</Pill>
                      ) : u.id === currentUserId ? (
                        <Pill tone="accent">to Ty</Pill>
                      ) : (
                        <button
                          onClick={() => patchUser(u.id, { isActive: !u.isActive })}
                          className={`text-[11.5px] font-semibold ${
                            u.isActive ? "text-muted hover:text-crit" : "text-good"
                          }`}
                        >
                          {u.isActive ? "Dezaktywuj" : "Aktywuj"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "slowniki" && (
        <div className="space-y-4">
          <p className="text-[13px] text-muted">
            Etykiety i kolory wartości słownikowych. Zestaw wartości pochodzi z modelu domeny —
            tutaj zmieniasz to, jak są nazywane i oznaczane w interfejsie.
          </p>
          {[...new Set(labels.map((l) => l.kind))].map((kind) => (
            <Card key={kind}>
              <CardHeader title={kind} subtitle={`${labels.filter((l) => l.kind === kind).length} wartości`} />
              <ul className="divide-y divide-border">
                {labels
                  .filter((l) => l.kind === kind)
                  .map((l) => (
                    <li key={l.id} className="flex items-center gap-3 px-5 py-2.5">
                      <span
                        style={{ background: l.color }}
                        className="h-3.5 w-3.5 shrink-0 rounded-full border border-border"
                      />
                      <span className="min-w-0 flex-1 text-[13px] text-ink">{l.label}</span>
                      <span className="font-mono text-[10.5px] text-muted">{l.value}</span>
                      <span className="font-mono text-[10.5px] text-muted">{l.color}</span>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}
          {labels.length === 0 && <EmptyState title="Brak wpisów słownikowych" />}
        </div>
      )}

      {tab === "platforma" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <BackupsPanel initial={backups} />
          <CalendarPanel />
        </div>
      )}

      {tab === "rodo" && (
        <GdprPanel
          users={users.map((u) => ({
            id: u.id,
            label: `${u.fullName} (${u.email})`,
            anonymized: u.anonymized,
          }))}
          clients={gdprClients}
          requests={gdprRequests}
        />
      )}

      {tab === "dziennik" && (
        <Card className="overflow-x-auto">
          <CardHeader title="Dziennik audytu" subtitle="30 ostatnich operacji zapisu" />
          {auditLog.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Dziennik pusty" />
            </div>
          ) : (
            <table className="w-full min-w-[600px] text-[13px]">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left font-mono text-[10.5px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">Kiedy</th>
                  <th className="px-4 py-3">Kto</th>
                  <th className="px-4 py-3">Operacja</th>
                  <th className="px-4 py-3">Encja</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-mono text-[11px] text-muted">
                      {formatDate(a.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-ink-soft">{a.userName}</td>
                    <td className="px-4 py-2">
                      <span className="font-mono text-[11px] text-accent">{a.action}</span>
                    </td>
                    <td className="px-4 py-2 font-mono text-[11px] text-ink-soft">{a.entity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {newUserOpen && (
        <NewUserDialog
          onClose={() => setNewUserOpen(false)}
          onCreated={() => {
            setNewUserOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
