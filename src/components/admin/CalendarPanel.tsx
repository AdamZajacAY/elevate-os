"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { readError } from "@/components/crm/Dialog";

/**
 * Feed kalendarza (spec 09) — synchronizacja jednokierunkowa przez subskrypcję.
 * Adres zawiera osobisty token, więc pokazujemy go tylko właścicielowi i dajemy
 * możliwość unieważnienia.
 */
export function CalendarPanel() {
  const [token, setToken] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch("/api/calendar/token")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("brak tokenu"))))
      .then((d: { token: string }) => setToken(d.token))
      .catch(() => setError("Nie udało się pobrać adresu subskrypcji."));
  }, []);

  const url = token ? `${origin}/api/calendar?token=${token}` : "";
  const masked = token ? `${origin}/api/calendar?token=${"•".repeat(12)}` : "wczytywanie…";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Schowek bywa zablokowany — wtedy zostaje odsłonięcie adresu i zaznaczenie ręczne.
      setRevealed(true);
    }
  }

  async function rotate() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/calendar/token", { method: "POST" });
    if (!res.ok) {
      setError(await readError(res, "Nie udało się wygenerować nowego adresu."));
      setPending(false);
      return;
    }
    setToken(((await res.json()) as { token: string }).token);
    setRevealed(false);
    setPending(false);
  }

  return (
    <Card>
      <CardHeader
        title="Kalendarz"
        subtitle="Kamienie milowe, spotkania i terminy projektów poza narzędziem"
      />
      <div className="space-y-3 p-5">
        <p className="text-[13px] text-ink-soft">
          Subskrybuj ten adres w Kalendarzu Google, Outlooku albo Apple Calendar. Wydarzenia płyną
          wyłącznie z ELEVATE OS na zewnątrz — zmiany w kalendarzu nie wracają do systemu.
        </p>

        <code className="block overflow-x-auto whitespace-nowrap rounded-lg border border-border bg-bg px-3 py-2 font-mono text-[12px] text-ink">
          {revealed ? url : masked}
        </code>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={copy}
            disabled={!token}
            className="rounded-lg bg-accent-deep px-3.5 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-40"
          >
            {copied ? "Skopiowano" : "Kopiuj adres"}
          </button>
          <button
            onClick={() => setRevealed((v) => !v)}
            disabled={!token}
            className="rounded-lg border border-border px-3.5 py-2 text-[12.5px] font-semibold text-ink-soft hover:bg-surface-2 disabled:opacity-40"
          >
            {revealed ? "Ukryj" : "Pokaż"}
          </button>
          <button
            onClick={rotate}
            disabled={pending}
            className="rounded-lg border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted hover:bg-surface-2 hover:text-crit disabled:opacity-50"
          >
            {pending ? "Generowanie…" : "Unieważnij i wygeneruj nowy"}
          </button>
        </div>

        {error && (
          <p className="rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[12.5px] text-crit">
            {error}
          </p>
        )}

        <p className="text-[12px] text-muted">
          Adres zawiera osobisty token — kto go ma, widzi Twój kalendarz. Feed pokazuje wyłącznie
          projekty widoczne dla Twojej roli. Unieważnienie natychmiast psuje poprzednią subskrypcję.
        </p>
      </div>
    </Card>
  );
}
