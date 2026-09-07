"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import { readError } from "@/components/crm/Dialog";
import { formatDate } from "@/lib/format";

type GdprRequest = {
  id: string;
  kind: string;
  subjectType: string;
  subjectId: string;
  subjectLabel: string;
  status: string;
  note: string | null;
  createdAt: string;
};

type Subject = { id: string; label: string; anonymized: boolean };

/**
 * Realizacja praw podmiotow danych (RODO art. 15, 17, 20) plus retencja.
 * Wszystko w jednym miejscu, zeby dalo sie odpowiedziec na zadanie bez szukania
 * po ekranach — i zeby kazda operacja zostawila slad w rejestrze.
 */
export function GdprPanel({
  users,
  clients,
  requests,
}: {
  users: Subject[];
  clients: Subject[];
  requests: GdprRequest[];
}) {
  const router = useRouter();
  const [subjectType, setSubjectType] = useState<"USER" | "CLIENT">("USER");
  const [subjectId, setSubjectId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const list = subjectType === "USER" ? users : clients;
  const selected = list.find((s) => s.id === subjectId);

  function exportData() {
    if (!subjectId) return;
    // Pobranie idzie przez nawigacje, bo odpowiedz jest zalacznikiem.
    window.location.href = `/api/gdpr/export?subject=${subjectType}&id=${subjectId}`;
    setMessage("Eksport pobrany. Wpis trafił do rejestru żądań.");
    setTimeout(() => router.refresh(), 1500);
  }

  async function anonymize() {
    if (!subjectId) return;
    setPending(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/gdpr/anonymize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: subjectType, id: subjectId }),
    });

    if (!res.ok) {
      setError(await readError(res, "Anonimizacja nie powiodła się."));
      setPending(false);
      setConfirming(false);
      return;
    }
    setMessage("Dane zanonimizowane. Operacja jest nieodwracalna.");
    setSubjectId("");
    setConfirming(false);
    setPending(false);
    router.refresh();
  }

  async function cleanup() {
    setPending(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/gdpr/cleanup", { method: "POST" });
    if (!res.ok) {
      setError(await readError(res, "Sprzątanie nie powiodło się."));
      setPending(false);
      return;
    }
    const r = (await res.json()) as {
      loginAttempts: number;
      notifications: number;
      auditLog: number;
      clientsFlagged: number;
      clientsOverdue: string[];
    };
    setMessage(
      `Usunięto: próby logowania ${r.loginAttempts}, powiadomienia ${r.notifications}, ` +
        `wpisy audytu ${r.auditLog}. Oznaczono ${r.clientsFlagged} klientów datą końca retencji.` +
        (r.clientsOverdue.length > 0
          ? ` Do rozpatrzenia (okres minął): ${r.clientsOverdue.join(", ")}.`
          : ""),
    );
    setPending(false);
    router.refresh();
  }

  const select =
    "mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2 text-[14px] text-ink outline-none focus:border-accent";
  const label = "font-mono text-[10.5px] uppercase tracking-wider text-muted";

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Prawa podmiotów danych"
          subtitle="Dostęp i przenoszenie (art. 15 i 20) oraz usunięcie (art. 17)"
        />
        <div className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={label}>Rodzaj podmiotu</span>
              <select
                value={subjectType}
                onChange={(e) => {
                  setSubjectType(e.target.value as "USER" | "CLIENT");
                  setSubjectId("");
                  setConfirming(false);
                }}
                className={select}
              >
                <option value="USER">Konto pracownika</option>
                <option value="CLIENT">Klient i jego kontakty</option>
              </select>
            </label>

            <label className="block">
              <span className={label}>Podmiot</span>
              <select
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setConfirming(false);
                }}
                className={select}
              >
                <option value="">Wybierz…</option>
                {list.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                    {s.anonymized ? " — już zanonimizowany" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={exportData}
              disabled={!subjectId}
              className="rounded-lg bg-accent-deep px-4 py-2 text-[13px] font-bold text-white hover:opacity-90 disabled:opacity-40"
            >
              Pobierz dane (JSON)
            </button>

            {!confirming ? (
              <button
                onClick={() => setConfirming(true)}
                disabled={!subjectId || selected?.anonymized}
                className="rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-muted hover:bg-surface-2 hover:text-crit disabled:opacity-40"
              >
                Anonimizuj…
              </button>
            ) : (
              <>
                <button
                  onClick={anonymize}
                  disabled={pending}
                  className="rounded-lg bg-crit px-4 py-2 text-[13px] font-bold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? "Anonimizacja…" : `Potwierdzam: ${selected?.label ?? ""}`}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-ink-soft hover:bg-surface-2"
                >
                  Anuluj
                </button>
              </>
            )}
          </div>

          {confirming && (
            <p className="rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[12.5px] text-crit">
              Anonimizacja jest <strong>nieodwracalna</strong>. Dane osobowe zostaną zastąpione,
              a rekordy finansowe (wpisy czasu, wartości umów) zostaną bez możliwości powiązania
              z osobą — wymagają tego przepisy o rachunkowości.
            </p>
          )}

          {message && (
            <p className="rounded-lg border border-good bg-good-soft px-3 py-2 text-[12.5px] text-good">
              {message}
            </p>
          )}
          {error && (
            <p className="rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[12.5px] text-crit">
              {error}
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Retencja"
          subtitle="Usuwanie danych, których okres przechowywania minął (art. 5 ust. 1 lit. e)"
          action={
            <button
              onClick={cleanup}
              disabled={pending}
              className="rounded-lg border border-border px-3.5 py-1.5 text-[12.5px] font-semibold text-ink-soft hover:bg-surface-2 disabled:opacity-50"
            >
              {pending ? "Sprzątanie…" : "Uruchom sprzątanie"}
            </button>
          }
        />
        <ul className="space-y-1 p-5 text-[13px] text-ink-soft">
          <li>• Próby logowania — 30 dni (potrzebne na czas blokady i analizy incydentu)</li>
          <li>• Przeczytane powiadomienia — 30 dni</li>
          <li>• Dziennik audytu — 2 lata (odtworzenie historii zmian)</li>
          <li>• Dane klienta — 5 lat od zamknięcia ostatniego projektu, potem do rozpatrzenia</li>
        </ul>
      </Card>

      <Card>
        <CardHeader
          title="Rejestr żądań"
          subtitle="Dowód realizacji obowiązków w terminie (art. 12 ust. 3)"
        />
        <div className="p-3">
          {requests.length === 0 ? (
            <EmptyState title="Brak żądań" hint="Każdy eksport i anonimizacja trafią tutaj." />
          ) : (
            <ul className="space-y-1">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-surface-2"
                >
                  <Pill tone={r.kind === "ERASURE" ? "crit" : "accent"}>
                    {r.kind === "ERASURE" ? "Usunięcie" : "Dostęp"}
                  </Pill>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                    {r.subjectLabel}
                    <span className="ml-2 font-mono text-[10.5px] text-muted">
                      {r.subjectType === "USER" ? "konto" : "klient"}
                    </span>
                  </span>
                  {r.note && <span className="shrink-0 text-[11.5px] text-muted">{r.note}</span>}
                  <span className="shrink-0 font-mono text-[11px] text-muted">
                    {formatDate(r.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
