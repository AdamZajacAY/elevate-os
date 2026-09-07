"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import { readError } from "@/components/crm/Dialog";
import { formatDate } from "@/lib/format";

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const KIND_LABEL: Record<string, string> = {
  TERMIN: "Termin",
  OPOZNIENIE: "Opóźnienie",
  WZMIANKA: "Wzmianka",
  KAMIEN_MILOWY: "Kamień milowy",
  FOLLOW_UP: "Follow-up",
  PRZYPISANIE: "Przypisanie",
};

const KIND_TONE: Record<string, "accent" | "warn" | "crit" | "good" | "neutral"> = {
  TERMIN: "warn",
  OPOZNIENIE: "crit",
  WZMIANKA: "accent",
  KAMIEN_MILOWY: "accent",
  FOLLOW_UP: "warn",
  PRZYPISANIE: "good",
};

export function NotificationsClient({
  notifications,
  isAdmin,
  urgentDays,
}: {
  notifications: Notification[];
  isAdmin: boolean;
  urgentDays: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const unread = notifications.filter((n) => !n.readAt);

  async function markRead(id?: string) {
    setError(null);
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : { all: true }),
    });
    if (!res.ok) {
      setError(await readError(res, "Nie udało się oznaczyć powiadomienia."));
      return;
    }
    router.refresh();
  }

  /** Skan proaktywny — docelowo z harmonogramu, na razie ręcznie przez Administratora. */
  async function runScan() {
    setPending(true);
    setError(null);
    setScanResult(null);

    const res = await fetch("/api/notifications/scan", { method: "POST" });
    if (!res.ok) {
      setError(await readError(res, "Nie udało się uruchomić skanu."));
      setPending(false);
      return;
    }
    const r = (await res.json()) as {
      upcoming: number;
      overdue: number;
      milestones: number;
      silentClients: number;
    };
    const total = r.upcoming + r.overdue + r.milestones + r.silentClients;
    setScanResult(
      total === 0
        ? "Skan zakończony — nic nowego do zgłoszenia."
        : `Utworzono ${total}: terminy ${r.upcoming}, opóźnienia ${r.overdue}, kamienie ${r.milestones}, follow-upy ${r.silentClients}.`,
    );
    setPending(false);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-accent">Skrzynka</p>
          <h1 className="mt-1 font-display text-[28px] font-black tracking-tight text-ink">
            Powiadomienia
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            {unread.length === 0
              ? "Wszystko przeczytane."
              : `${unread.length} ${unread.length === 1 ? "nieprzeczytane" : "nieprzeczytanych"}`}
            {" · próg pilności: "}
            {urgentDays} dni
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {isAdmin && (
            <button
              onClick={runScan}
              disabled={pending}
              className="rounded-lg border border-border px-4 py-2 text-[13.5px] font-semibold text-ink-soft hover:bg-surface-2 disabled:opacity-50"
            >
              {pending ? "Skanowanie…" : "Uruchom skan"}
            </button>
          )}
          {unread.length > 0 && (
            <button
              onClick={() => markRead()}
              className="rounded-lg bg-accent-deep px-4 py-2 text-[13.5px] font-bold text-white hover:opacity-90"
            >
              Oznacz wszystkie
            </button>
          )}
        </div>
      </header>

      {error && (
        <p className="rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[13px] text-crit">
          {error}
        </p>
      )}
      {scanResult && (
        <p className="rounded-lg border border-good bg-good-soft px-3 py-2 text-[13px] text-good">
          {scanResult}
        </p>
      )}

      {notifications.length === 0 ? (
        <EmptyState
          title="Skrzynka pusta"
          hint="Powiadomienia pojawią się przy zbliżających się terminach i wzmiankach."
        />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`flex items-start gap-3 px-5 py-3.5 ${n.readAt ? "opacity-60" : ""}`}
              >
                <span className="mt-0.5 shrink-0">
                  <Pill tone={KIND_TONE[n.kind] ?? "neutral"} dot={!n.readAt}>
                    {KIND_LABEL[n.kind] ?? n.kind}
                  </Pill>
                </span>
                <div className="min-w-0 flex-1">
                  {n.link ? (
                    <Link
                      href={n.link}
                      onClick={() => !n.readAt && markRead(n.id)}
                      className="text-[13.5px] font-semibold text-ink hover:text-accent"
                    >
                      {n.title}
                    </Link>
                  ) : (
                    <p className="text-[13.5px] font-semibold text-ink">{n.title}</p>
                  )}
                  {n.body && <p className="mt-0.5 text-[12.5px] text-ink-soft">{n.body}</p>}
                  <p className="mt-0.5 font-mono text-[10.5px] text-muted">
                    {formatDate(n.createdAt)}
                  </p>
                </div>
                {!n.readAt && (
                  <button
                    onClick={() => markRead(n.id)}
                    className="shrink-0 text-[11.5px] font-semibold text-muted hover:text-accent"
                  >
                    przeczytane
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
